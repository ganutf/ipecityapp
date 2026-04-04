import { Router, Request, Response } from 'express';
import { privyAuthMiddleware, optionalPrivyAuthMiddleware, PrivyAuthRequest } from '../middleware/privyAuth';
import { storage } from '../storage';
import logger from '../logger';
import { PulseService } from '../services/PulseService';
import {
  fetchBalance,
  enrichBulkMembers,
  enrichSingleMember,
} from '../services/ProfileEnrichmentService';
import { parseIntParam, handleServiceError } from '../lib/routeHelpers';
import { TIMING } from '@shared/constants';
import type { PrivyLinkedAccount } from '@shared/types';
import type { Member } from '@shared/schema';

const router = Router();

// Create PulseService instance for community endpoints
const pulseService = new PulseService(storage);

/**
 * POST /api/v2/auth/login
 * Exchange Privy token for member data, creating member if needed
 */
router.post('/auth/login', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id: privyId } = req.privyUser;
    const { email, walletAddress } = req.body;

    // Check if member already exists by Privy ID
    let member = await storage.getMemberByPrivyId(privyId);

    if (!member) {
      // Try linking to existing member by email or wallet (handles migrated users)
      if (email) {
        member = await storage.getMemberByEmail(email);
      }
      if (!member && walletAddress) {
        member = await storage.getMemberByWalletAddress(walletAddress);
      }

      if (member) {
        // Link Privy ID to existing member
        member = await storage.updateMember(member.id, { privyId });
        logger.info('Privy account linked to existing member via /login', {
          memberId: member.id, privyId, email,
        });
      } else {
        // Create new member from Privy data
        logger.info('Creating new member from Privy', {
          privyId, email, walletAddress,
        });
        member = await storage.createMemberFromPrivy(privyId, email, walletAddress);
      }
    }

    res.json({
      isMember: true,
      status: member.status,
      member,
    });
  } catch (error) {
    logger.error('Error in /login', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to process login' });
  }
});

/**
 * GET /api/v2/auth/me
 * Get current user profile and member data
 * Auto-creates member record on first request if authenticated
 */
router.get('/auth/me', optionalPrivyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let member = req.member;

    // Parse identity token to get email/wallet (official Privy approach)
    // Identity token is sent by client in 'privy-id-token' header
    let privyEmail: string | undefined;
    let privyWallet: string | undefined;

    const idToken = req.headers['privy-id-token'] as string | undefined;
    logger.debug('Identity token check', {
      hasIdToken: !!idToken,
      idTokenLength: idToken?.length,
      privyUserId: req.privyUser.id,
    });

    if (idToken) {
      try {
        const { privy } = await import('../lib/privy');
        if (privy) {
          // Parse identity token - no extra API call needed!
          const privyUserData = await privy.users().get({ id_token: idToken });

          const linkedAccounts = (privyUserData.linked_accounts ?? []) as PrivyLinkedAccount[];
          logger.debug('Parsed identity token', {
            privyUserId: privyUserData.id,
            linkedAccounts: linkedAccounts.map(a => ({ type: a.type, address: a.address })),
          });

          // Extract email from linked accounts
          const emailAccount = linkedAccounts.find(account => account.type === 'email');
          privyEmail = emailAccount?.address;

          // Extract wallet from linked accounts - prefer external wallets
          // (matches client-side useActiveWallet which prefers external over embedded)
          const walletAccounts = linkedAccounts.filter(account => account.type === 'wallet');
          const externalWallet = walletAccounts.find(account => account.wallet_client_type !== 'privy');
          const embeddedWallet = walletAccounts.find(account => account.wallet_client_type === 'privy');
          privyWallet = (externalWallet ?? embeddedWallet)?.address;
        }
      } catch (parseError) {
        logger.warn('Could not parse identity token', {
          privyId: req.privyUser.id,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    }

    if (!member) {
      // No member found by privyId — try linking to existing member by email or wallet
      // This handles migrated users who don't have a privy_id yet
      let existingMember: Member | undefined;

      if (privyEmail) {
        existingMember = await storage.getMemberByEmail(privyEmail);
        if (existingMember) {
          logger.info('Found existing member by email, linking Privy account', {
            memberId: existingMember.id,
            email: privyEmail,
            privyId: req.privyUser.id,
          });
        }
      }

      if (!existingMember && privyWallet) {
        // Check member_wallets table for wallet ownership
        const walletOwner = await storage.getMemberByWalletAddress(privyWallet);
        if (walletOwner) {
          existingMember = walletOwner;
          logger.info('Found existing member by wallet, linking Privy account', {
            memberId: existingMember.id,
            wallet: privyWallet,
            privyId: req.privyUser.id,
          });
        }
      }

      if (existingMember) {
        // Link Privy ID to existing member
        member = await storage.updateMember(existingMember.id, {
          privyId: req.privyUser.id,
        });
        logger.info('Privy account linked to existing member', {
          memberId: member.id,
          privyId: req.privyUser.id,
        });
      } else {
        // No existing member found — auto-create new one
        logger.info('Auto-creating member for Privy user', {
          privyId: req.privyUser.id,
          email: privyEmail,
          wallet: privyWallet,
        });

        try {
          member = await storage.createMemberFromPrivy(
            req.privyUser.id,
            privyEmail,
            privyWallet
          );
          logger.info('Member auto-created successfully', {
            memberId: member.id,
            privyId: req.privyUser.id,
          });
        } catch (createError) {
          logger.error('Failed to auto-create member', {
            privyId: req.privyUser.id,
            error: createError instanceof Error ? createError.message : String(createError),
          });
          return res.json({
            isMember: false,
            status: null,
            member: null,
            memberId: null,
            privyUser: {
              id: req.privyUser.id,
              email: privyEmail,
              wallet: privyWallet,
            },
          });
        }
      }
    } else {
      // Member exists - sync missing data from Privy
      const updates: Record<string, any> = {};

      if (!member.email && privyEmail) {
        logger.info('Syncing email from Privy to existing member', {
          memberId: member.id,
          email: privyEmail,
        });
        updates.email = privyEmail;
        updates.emailVerified = true; // Privy already verified it
      }

      // Apply non-wallet updates first
      if (Object.keys(updates).length > 0) {
        member = await storage.updateMember(member.id, updates);
      }

      // Sync wallet through atomic method (ensures member_wallets row is created)
      if (!member.walletAddress && privyWallet) {
        try {
          member = await storage.updateMemberWalletAtomic(member.id, privyWallet);
          logger.info('Synced wallet from Privy to existing member', {
            memberId: member.id,
            wallet: privyWallet,
          });
        } catch (err) {
          logger.warn('Skipping wallet sync - wallet may belong to another member', {
            memberId: member.id,
            wallet: privyWallet,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Calculate stats if member exists
    let totalPoints = 0;
    let pulseStreak = 0;

    try {
      totalPoints = await storage.calculateTotalPoints(member.id);
      // Note: pulseService would need to be imported for streak calculation
      // pulseStreak = await pulseService.calculateMemberStreak(member.id);
    } catch (statsError) {
      logger.warn('Failed to calculate member stats', {
        memberId: member.id,
        error: statsError instanceof Error ? statsError.message : String(statsError),
      });
    }

    // Fetch IPE balance from backend cache (passport wallet only)
    const balanceData = member.walletAddress
      ? await fetchBalance(member.walletAddress)
      : null;
    const ipeBalance = balanceData?.balance || '0';
    const ipeBalanceRaw = balanceData?.balanceRaw || '0';

    res.json({
      isMember: true,
      memberId: member.id,  // Expose memberId at top level for easy access
      status: member.status,
      member: {
        ...member,
        totalPoints,
        pulseStreak,
        ipeBalance,
        ipeBalanceRaw,
      },
      privyUser: {
        id: req.privyUser.id,
        email: req.privyUser.email,
        wallet: req.privyUser.wallet,
      },
    });
  } catch (error) {
    logger.error('Error in /me', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * POST /api/v2/auth/logout
 * Clear any server-side session data
 */
router.post('/auth/logout', (req: Request, res: Response) => {
  // Privy handles token invalidation on the client side
  // This endpoint is for any server-side cleanup if needed
  res.json({ success: true });
});

/**
 * POST /api/v2/auth/request-email-verification
 * Request email verification using memberId (Privy flow)
 */
router.post('/auth/request-email-verification', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const { email } = req.body;
    const memberId = req.member.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Import email utilities dynamically to avoid circular dependencies
    const { generateVerificationCode, sendVerificationEmail, canSendEmails, getEmailConfig } = await import('../lib/email');
    const { getCurrentUTC } = await import('@shared/pulseUtils');

    // Check if email system can send emails
    if (!canSendEmails()) {
      const config = getEmailConfig();
      logger.error('Email system not configured', { config });
      return res.status(500).json({
        error: 'Email system not configured',
        details: config.testMode
          ? 'Test mode is enabled but not working properly'
          : 'RESEND_API_KEY is missing or invalid'
      });
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Enhanced logging for test mode
    const emailConfig = getEmailConfig();
    if (emailConfig.testMode) {
      logger.info('Email verification code (TEST MODE)', {
        email,
        code,
        memberId,
      });
      logger.info('');
      logger.info('=====================================');
      logger.info(`📧 EMAIL VERIFICATION CODE (TEST MODE)`);
      logger.info(`📧 Email: ${email}`);
      logger.info(`📧 Code: ${code}`);
      logger.info(`📧 Copy this code: ${code}`);
      logger.info('=====================================');
      logger.info('');
    }

    await storage.createEmailVerification({
      memberId,
      farcasterFid: req.member.farcasterFid || 0, // Legacy field, use 0 if no FID
      email,
      verificationCode: code,
      expiresAt: new Date(getCurrentUTC().getTime() + TIMING.EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000),
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, code);

    if (!emailSent) {
      const config = getEmailConfig();
      logger.error('Failed to send verification email', { config });
      return res.status(500).json({
        error: 'Failed to send verification email',
        details: config.testMode
          ? 'Test mode enabled - check server logs for email content'
          : 'Email service error - check API key and configuration'
      });
    }

    const config = getEmailConfig();
    res.json({
      success: true,
      memberId,
      message: config.testMode
        ? 'Verification code generated (test mode - check server logs)'
        : 'Verification code sent to your email'
    });
  } catch (error) {
    logger.error('Request email verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to request email verification' });
  }
});

/**
 * POST /api/v2/auth/verify-email
 * Verify email code using memberId (Privy flow)
 */
router.post('/auth/verify-email', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const { code } = req.body;
    const memberId = req.member.id;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    // Import timezone utility
    const { getCurrentUTC } = await import('@shared/pulseUtils');

    const verification = await storage.getEmailVerification(memberId, code);
    if (!verification) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (verification.expiresAt < getCurrentUTC()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    // Mark email as verified
    await storage.markEmailVerified(memberId);

    // Update member email and emailVerified flag (status stays as pending_id_verification)
    const updatedMember = await storage.updateMember(memberId, {
      email: verification.email,
      emailVerified: true,
    });

    res.json({
      success: true,
      memberId,
      message: 'Email verified successfully',
      member: updatedMember,
    });
  } catch (error) {
    logger.error('Verify email error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

/**
 * GET /api/v2/members/:memberId
 * Get member by ID (replaces /api/members/check/:farcasterFid)
 */
router.get('/members/:memberId', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    const memberId = parseIntParam(req, 'memberId');

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Calculate stats
    let totalPoints = 0;
    try {
      totalPoints = await storage.calculateTotalPoints(memberId);
    } catch (statsError) {
      logger.warn('Failed to calculate member stats', {
        memberId,
        error: statsError instanceof Error ? statsError.message : String(statsError),
      });
    }

    res.json({
      member: {
        ...member,
        totalPoints,
        pulseStreak: 0,
      },
    });
  } catch (err) {
    handleServiceError(err, res, 'Failed to get member');
  }
});

/**
 * POST /api/v2/auth/application/submit
 * Submit membership application using memberId (Privy flow)
 */
router.post('/auth/application/submit', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const { ipeUsername, bio, twitter, linkedin, instagram, profileTags, walletAddress } = req.body;
    const memberId = req.member.id;

    if (!ipeUsername) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Atomic check-and-update to prevent race conditions on username and wallet
    const updatedMember = await storage.submitApplicationAtomic(memberId, {
      ipeUsername,
      bio,
      twitter,
      linkedin,
      instagram,
      profileTags,
      walletAddress,
      status: 'pending_application_review',
    });

    logger.info('Application submitted', {
      memberId,
      ipeUsername,
    });

    res.json({
      success: true,
      memberId,
      message: 'Application submitted successfully',
      member: updatedMember,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    if (error instanceof Error && error.message === 'WALLET_ALREADY_LINKED') {
      return res.status(409).json({ error: 'This wallet is already linked to another account' });
    }
    logger.error('Application submit error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

/**
 * PATCH /api/v2/members/:memberId/profile
 * Update member profile using memberId
 */
router.patch('/members/:memberId/profile', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    // Ensure user can only update their own profile
    if (req.member.id !== memberId) {
      return res.status(403).json({ error: 'Cannot update another user profile' });
    }

    const { bio, twitter, linkedin, instagram, profileTags } = req.body;

    const updatedMember = await storage.updateMember(memberId, {
      bio,
      twitter,
      linkedin,
      instagram,
      profileTags,
    });

    logger.info('Profile updated', { memberId });

    res.json({
      success: true,
      memberId,
      member: updatedMember,
    });
  } catch (error) {
    logger.error('Profile update error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/v2/auth/passport/verify
 * Verify passport/ENS ownership using memberId (Privy flow)
 */
router.post('/auth/passport/verify', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const { ensName, walletAddress, message, signature } = req.body;
    const memberId = req.member.id;

    if (!ensName || !walletAddress || !message || !signature) {
      return res.status(400).json({ error: 'Missing required fields: ensName, walletAddress, message, signature' });
    }

    // Import viem for signature verification
    const { verifyMessage } = await import('viem');
    // Verify the signature
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update member with passport info and activate membership
    const updatedMember = await storage.updateMember(memberId, {
      ipePassport: ensName,
      status: 'active_member',
    });

    logger.info('Passport verified via signature', {
      memberId,
      ensName,
      walletAddress,
    });

    res.json({
      success: true,
      memberId,
      message: 'Passport verified successfully',
      member: updatedMember,
    });
  } catch (error) {
    logger.error('Passport verify error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to verify passport' });
  }
});

/**
 * POST /api/v2/auth/passport/accept
 * Accept subdomain and activate membership using memberId (Privy flow)
 */
router.post('/auth/passport/accept', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = req.member.id;
    const member = req.member;

    if (!member.ipeUsername) {
      return res.status(400).json({ error: 'No subdomain reserved for this member' });
    }

    if (member.status !== 'approved_application') {
      return res.status(400).json({ error: 'Member must be in approved_application status to accept passport' });
    }

    // Update member to active status with passport
    const updatedMember = await storage.updateMember(memberId, {
      ipePassport: `${member.ipeUsername}.ipecity.eth`,
      status: 'active_member',
    });

    logger.info('Passport accepted, member activated', {
      memberId,
      ipePassport: updatedMember.ipePassport,
    });

    res.json({
      success: true,
      memberId,
      message: 'Passport accepted, membership activated',
      member: updatedMember,
    });
  } catch (error) {
    logger.error('Passport accept error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to accept passport' });
  }
});

/**
 * PATCH /api/v2/members/:memberId/wallet
 * Update member's wallet address
 */
router.patch('/members/:memberId/wallet', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    // Ensure user can only update their own wallet
    if (req.member.id !== memberId) {
      return res.status(403).json({ error: 'Cannot update another user wallet' });
    }

    const { walletAddress } = req.body;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Atomic check-and-update to prevent race conditions
    const updatedMember = await storage.updateMemberWalletAtomic(memberId, walletAddress);

    logger.info('Wallet address updated', { memberId, walletAddress });

    res.json({
      success: true,
      memberId,
      member: updatedMember,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'WALLET_ALREADY_LINKED') {
      return res.status(409).json({ error: 'This wallet is already linked to another account' });
    }
    logger.error('Wallet update error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to update wallet address' });
  }
});

/**
 * GET /api/v2/members/:memberId/wallets
 * Get all wallets linked to a member
 */
router.get('/members/:memberId/wallets', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    // Only own wallets or admin
    if (req.member.id !== memberId && req.member.memberType !== 'admin') {
      return res.status(403).json({ error: 'Cannot view another user wallets' });
    }

    const wallets = await storage.getMemberWallets(memberId);
    res.json({ wallets });
  } catch (error) {
    logger.error('Get member wallets error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to get wallets' });
  }
});

/**
 * POST /api/v2/members/:memberId/wallets
 * Link a new wallet to the member. Returns 409 if wallet is already linked to another account.
 */
router.post('/members/:memberId/wallets', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    if (req.member.id !== memberId) {
      return res.status(403).json({ error: 'Cannot link wallets to another user' });
    }

    const { walletAddress, walletType, label } = req.body;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    if (!walletType || !['external', 'privy_embedded'].includes(walletType)) {
      return res.status(400).json({ error: 'Invalid wallet type' });
    }

    const wallet = await storage.linkMemberWallet({
      memberId,
      walletAddress,
      walletType,
      label: label || undefined,
    });

    logger.info('Wallet linked', { memberId, walletAddress: walletAddress.toLowerCase(), walletType });

    res.json({ success: true, wallet });
  } catch (error) {
    if (error instanceof Error && error.message === 'WALLET_ALREADY_LINKED') {
      return res.status(409).json({ error: 'This wallet is already linked to another account' });
    }
    logger.error('Link wallet error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

/**
 * DELETE /api/v2/members/:memberId/wallets/:walletAddress
 * Unlink a wallet from the member. Cannot unlink the passport wallet.
 */
router.delete('/members/:memberId/wallets/:walletAddress', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    if (req.member.id !== memberId) {
      return res.status(403).json({ error: 'Cannot unlink wallets from another user' });
    }

    const { walletAddress } = req.params;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/i)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Prevent unlinking the passport wallet
    if (req.member.walletAddress && req.member.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot unlink your passport wallet. Change your passport wallet first.' });
    }

    const deleted = await storage.unlinkMemberWallet(memberId, walletAddress);
    if (!deleted) {
      return res.status(404).json({ error: 'Wallet not found in your linked wallets' });
    }

    logger.info('Wallet unlinked', { memberId, walletAddress: walletAddress.toLowerCase() });

    res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'CANNOT_UNLINK_PASSPORT_WALLET') {
      return res.status(400).json({ error: 'Cannot unlink your passport wallet' });
    }
    handleServiceError(err, res, 'Failed to unlink wallet');
  }
});

/**
 * POST /api/v2/members/:memberId/upgrade-to-active
 * Upgrade member to active status when subdomain is found
 */
router.post('/members/:memberId/upgrade-to-active', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = parseIntParam(req, 'memberId');

    // Verify ownership - user can only upgrade their own account
    if (req.member.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden: Cannot upgrade another member' });
    }

    // Check if member has a wallet address
    if (!req.member.walletAddress) {
      return res.status(400).json({ error: 'No wallet address connected' });
    }

    // Import ENS lookup to verify domain ownership
    const { lookupEnsName } = await import('../lib/ensLookup');

    // Verify the wallet owns ipecity.eth domains
    const lookupResult = await lookupEnsName(req.member.walletAddress);
    if (!lookupResult.ensNames || lookupResult.ensNames.length === 0) {
      return res.status(400).json({ error: 'No ipecity.eth domain found for this wallet' });
    }

    // Use selectedDomain from request body if provided, otherwise use first found
    const { selectedDomain } = req.body || {};
    let subdomain: string;

    if (selectedDomain) {
      // Validate the selected domain is actually owned by this wallet
      if (!lookupResult.ensNames.includes(selectedDomain)) {
        return res.status(400).json({ error: `Domain ${selectedDomain} is not associated with this wallet` });
      }
      subdomain = selectedDomain;
    } else {
      subdomain = lookupResult.ensNames[0];
    }

    // Determine member type: ipecity.eth parent domain = admin
    const memberType = subdomain === 'ipecity.eth' ? 'admin' : 'explorer';

    // Upgrade member to active
    const updated = await storage.upgradeMemberToActive(memberId, subdomain, memberType);

    logger.info('Member upgraded to active', {
      memberId,
      ipePassport: subdomain,
    });

    res.json({
      success: true,
      member: updated,
    });
  } catch (error) {
    logger.error('Upgrade to active error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to upgrade member' });
  }
});

/**
 * POST /api/v2/farcaster/create-signer
 * Create a Farcaster signer for member (optional integration)
 */
router.post('/farcaster/create-signer', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser || !req.member) {
      return res.status(401).json({ error: 'Not authenticated or member not found' });
    }

    const memberId = req.member.id;

    // Import signer creation utilities
    const { getSignedKey } = await import('../lib/getSignedKey');

    // Create signer for the member
    const signerData = await getSignedKey(true); // true = sponsored

    logger.info('Farcaster signer created for member', {
      memberId,
      signerUuid: signerData.signer_uuid,
    });

    res.json({
      success: true,
      signer_uuid: signerData.signer_uuid,
      public_key: signerData.public_key,
      deep_link_url: signerData.deep_link_url,
      status: signerData.status,
    });
  } catch (error) {
    logger.error('Create Farcaster signer error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to create Farcaster signer' });
  }
});

/**
 * GET /api/v2/community/members
 * Get all active community members with stats (Privy auth)
 */
router.get('/community/members', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    logger.debug('GET_COMMUNITY_MEMBERS (Privy) - Request from member', {
      memberId: req.member?.id,
      privyId: req.privyUser.id,
    });

    const members = await storage.getActiveMembersWithStats(pulseService);
    logger.debug('Retrieved members count', { count: members.length });

    const enrichedMembers = await enrichBulkMembers(members);

    res.json({ members: enrichedMembers });
  } catch (error) {
    logger.error('Get community members error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch community members' });
  }
});

/**
 * GET /api/v2/community/members/:memberId
 * Get single community member details (Privy auth)
 */
router.get('/community/members/:memberId', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const memberId = parseIntParam(req, 'memberId');

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const totalPoints = await storage.calculateTotalPoints(memberId);
    const pulseStreak = await pulseService.calculateMemberStreak(memberId);

    const enrichedMember = await enrichSingleMember(member, { totalPoints, pulseStreak });

    res.json({ member: enrichedMember });
  } catch (err) {
    handleServiceError(err, res, 'Failed to fetch member details');
  }
});

export default router;
