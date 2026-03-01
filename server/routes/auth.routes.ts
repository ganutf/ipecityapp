import { Router, Request, Response } from 'express';
import { privyAuthMiddleware, optionalPrivyAuthMiddleware, PrivyAuthRequest } from '../middleware/privyAuth';
import { storage } from '../storage';
import logger from '../logger';
import { PulseService } from '../services/PulseService';
import { neynar } from '../lib/neynarClient';
import type { PrivyLinkedAccount } from '@shared/types';

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

    // Check if member already exists
    let member = await storage.getMemberByPrivyId(privyId);

    if (!member) {
      // Create new member from Privy data
      logger.info('Creating new member from Privy', {
        privyId,
        email,
        walletAddress,
      });

      member = await storage.createMemberFromPrivy(privyId, email, walletAddress);
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
      // User is authenticated but not a member yet - auto-create
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
        // Return without member if creation fails
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

      // Sync wallet if member doesn't have one yet (only if not owned by another member)
      if (!member.walletAddress && privyWallet) {
        const existingWallet = await storage.getMemberWalletByAddress(privyWallet);
        if (!existingWallet || existingWallet.memberId === member.id) {
          logger.info('Syncing wallet from Privy to existing member', {
            memberId: member.id,
            wallet: privyWallet,
          });
          updates.walletAddress = privyWallet;
        } else {
          logger.warn('Skipping wallet sync - wallet belongs to another member', {
            memberId: member.id,
            wallet: privyWallet,
            ownerMemberId: existingWallet.memberId,
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        member = await storage.updateMember(member.id, updates);
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
    let ipeBalance = '0';
    let ipeBalanceRaw = '0';
    if (member.walletAddress) {
      try {
        const { getCachedBalances } = await import('../services/balanceCache');
        const balanceMap = await getCachedBalances([member.walletAddress]);
        const balanceData = balanceMap[member.walletAddress.toLowerCase()];
        if (balanceData) {
          ipeBalance = balanceData.balance;
          ipeBalanceRaw = balanceData.balanceRaw;
        }
      } catch (balanceError) {
        logger.warn('Failed to fetch balance in /me', {
          memberId: member.id,
          error: balanceError instanceof Error ? balanceError.message : String(balanceError),
        });
      }
    }

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
      expiresAt: new Date(getCurrentUTC().getTime() + 10 * 60 * 1000), // 10 minutes
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
    const memberId = parseInt(req.params.memberId);

    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Calculate stats
    let totalPoints = 0;
    let pulseStreak = 0;

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
        pulseStreak,
      },
    });
  } catch (error) {
    logger.error('Get member error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to get member' });
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

    const memberId = parseInt(req.params.memberId);

    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

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
    const { mainnet } = await import('viem/chains');

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

    const memberId = parseInt(req.params.memberId);

    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

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

    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

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

    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

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

    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid memberId' });
    }

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
  } catch (error) {
    logger.error('Unlink wallet error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to unlink wallet' });
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

    const memberId = parseInt(req.params.memberId);

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

    // Fetch cached IPE balances for all members
    let balanceMap: { [address: string]: any } = {};
    const addresses = members
      .map(m => m.walletAddress)
      .filter((addr): addr is string => Boolean(addr));

    if (addresses.length > 0) {
      try {
        const { getCachedBalances } = await import('../services/balanceCache');
        balanceMap = await getCachedBalances(addresses);
        logger.debug('Fetched cached balances', { count: Object.keys(balanceMap).length });
      } catch (balanceError) {
        logger.warn('Failed to fetch cached balances', {
          error: balanceError instanceof Error ? balanceError.message : String(balanceError),
        });
      }
    }

    // Fetch Farcaster profile data for members with FIDs
    let membersWithProfiles = members;
    const membersWithFids = members.filter(m => m.farcasterFid && m.farcasterFid > 0);

    if (membersWithFids.length > 0) {
      try {
        const fids = membersWithFids.map(m => m.farcasterFid!);
        const userResponse = await neynar.fetchBulkUsers({ fids });

        if (userResponse.users && userResponse.users.length > 0) {
          const profileMap = new Map();
          userResponse.users.forEach((user: any) => {
            profileMap.set(user.fid, {
              displayName: user.display_name,
              username: user.username,
              pfpUrl: user.pfp_url,
              bio: user.profile?.bio?.text,
            });
          });

          // Merge profile data and balance data with member data
          membersWithProfiles = members.map(member => {
            const profile = member.farcasterFid ? profileMap.get(member.farcasterFid) : null;
            const balance = member.walletAddress ? balanceMap[member.walletAddress.toLowerCase()] : null;

            return {
              ...member,
              displayName: profile?.displayName || member.ipeUsername || `Member ${member.id}`,
              username: profile?.username || member.ipeUsername,
              pfpUrl: profile?.pfpUrl,
              bio: profile?.bio || member.bio,
              ipeBalance: balance?.balance || '0',
              ipeBalanceRaw: balance?.balanceRaw || '0',
            };
          });
        }
      } catch (profileError) {
        logger.warn('Failed to fetch Farcaster profiles', {
          error: profileError instanceof Error ? profileError.message : String(profileError),
        });
        // Continue with member data, just add balance info
        membersWithProfiles = members.map(member => {
          const balance = member.walletAddress ? balanceMap[member.walletAddress.toLowerCase()] : null;
          return {
            ...member,
            displayName: member.ipeUsername || `Member ${member.id}`,
            username: member.ipeUsername,
            ipeBalance: balance?.balance || '0',
            ipeBalanceRaw: balance?.balanceRaw || '0',
          };
        });
      }
    } else {
      // No members with Farcaster FIDs, just add balance info
      membersWithProfiles = members.map(member => {
        const balance = member.walletAddress ? balanceMap[member.walletAddress.toLowerCase()] : null;
        return {
          ...member,
          displayName: member.ipeUsername || `Member ${member.id}`,
          username: member.ipeUsername,
          ipeBalance: balance?.balance || '0',
          ipeBalanceRaw: balance?.balanceRaw || '0',
        };
      });
    }

    res.json({ members: membersWithProfiles });
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

    const memberId = parseInt(req.params.memberId);
    if (isNaN(memberId)) {
      return res.status(400).json({ error: 'Invalid member ID' });
    }

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const totalPoints = await storage.calculateTotalPoints(memberId);
    const pulseStreak = await pulseService.calculateMemberStreak(memberId);

    // Fetch Farcaster profile if FID exists
    let profileData = null;
    if (member.farcasterFid && member.farcasterFid > 0) {
      try {
        const userResponse = await neynar.fetchBulkUsers({ fids: [member.farcasterFid] });
        if (userResponse.users && userResponse.users.length > 0) {
          const user = userResponse.users[0] as { display_name?: string; username?: string; pfp_url?: string; profile?: { bio?: { text?: string } } };
          profileData = {
            displayName: user.display_name,
            username: user.username,
            pfpUrl: user.pfp_url,
            bio: user.profile?.bio?.text,
          };
        }
      } catch (profileError) {
        logger.warn('Failed to fetch Farcaster profile', {
          memberId,
          fid: member.farcasterFid,
          error: profileError instanceof Error ? profileError.message : String(profileError),
        });
      }
    }

    // Fetch IPE balance if wallet exists
    let balanceData = null;
    if (member.walletAddress) {
      try {
        const { getCachedBalances } = await import('../services/balanceCache');
        const balanceMap = await getCachedBalances([member.walletAddress]);
        balanceData = balanceMap[member.walletAddress.toLowerCase()];
      } catch (balanceError) {
        logger.warn('Failed to fetch balance', {
          memberId,
          error: balanceError instanceof Error ? balanceError.message : String(balanceError),
        });
      }
    }

    const memberWithProfile = {
      ...member,
      totalPoints,
      pulseStreak,
      displayName: profileData?.displayName || member.ipeUsername || `Member ${member.id}`,
      username: profileData?.username || member.ipeUsername,
      pfpUrl: profileData?.pfpUrl,
      bio: profileData?.bio || member.bio,
      ipeBalance: balanceData?.balance || '0',
      ipeBalanceRaw: balanceData?.balanceRaw || '0',
    };

    res.json({ member: memberWithProfile });
  } catch (error) {
    logger.error('Get community member details error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch member details' });
  }
});

export default router;
