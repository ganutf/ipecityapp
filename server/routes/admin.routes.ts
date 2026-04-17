/**
 * V2 Admin Routes — member management (approval, denial, type updates, passport lifecycle)
 * Mounted at /api/v2/admin
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import {
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import { MemberAdminService } from '../services/MemberAdminService';
import { storage } from '../storage';
import { handleServiceError } from '../lib/routeHelpers';
import { approveMemberSchema, denyMemberSchema, updateMemberTypeSchema } from '@shared/schema';

const router = Router();

const memberAdminService = new MemberAdminService(storage);

// ============================================
// PASSPORT LIFECYCLE SCHEMAS
// ============================================

const revokePassportSchema = z.object({
  memberId: z.number().int().positive(),
});

const reinstatePassportSchema = z.object({
  memberId: z.number().int().positive(),
  expiresAt: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }).optional(),
});

const membershipExpirySchema = z.object({
  memberId: z.number().int().positive(),
  expiresAt: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }).nullable(),
});

// ============================================
// EXISTING ROUTES
// ============================================

/** GET /api/v2/admin/members */
router.get(
  '/members',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('GET_ALL_MEMBERS'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const members = await memberAdminService.getAllMembers();
      res.json({ members });
    } catch (err) {
      handleServiceError(err, res, 'Failed to get members');
    }
  },
);

/** GET /api/v2/admin/pending-members */
router.get(
  '/pending-members',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('GET_PENDING_MEMBERS'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const members = await memberAdminService.getPendingMembers();
      res.json({ members });
    } catch (err) {
      handleServiceError(err, res, 'Failed to get pending members');
    }
  },
);

/** POST /api/v2/admin/approve-member */
router.post(
  '/approve-member',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('APPROVE_MEMBER'),
  validateRequest(approveMemberSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId, ipeUsername, userWalletAddress, memberType } = req.body;
      const member = await memberAdminService.approveMember({
        memberId,
        ipeUsername,
        userWalletAddress,
        memberType,
      });
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to approve member');
    }
  },
);

/** POST /api/v2/admin/deny-member */
router.post(
  '/deny-member',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('DENY_MEMBER'),
  validateRequest(denyMemberSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId } = req.body;
      const member = await memberAdminService.denyMember(memberId);
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to deny member');
    }
  },
);

/** PATCH /api/v2/admin/update-member-type */
router.patch(
  '/update-member-type',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('UPDATE_MEMBER_TYPE'),
  validateRequest(updateMemberTypeSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId, memberType } = req.body;
      const member = await memberAdminService.updateMemberType(memberId, memberType);
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to update member type');
    }
  },
);

// ============================================
// PASSPORT LIFECYCLE ROUTES
// ============================================

/**
 * POST /api/v2/admin/revoke-passport
 * Revoke an active member's passport — reclaims ENS subdomain, status → passport_revoked.
 */
router.post(
  '/revoke-passport',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('REVOKE_PASSPORT'),
  validateRequest(revokePassportSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId } = req.body;
      const member = await memberAdminService.revokePassport(memberId);
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to revoke passport');
    }
  },
);

/**
 * POST /api/v2/admin/reinstate-passport
 * Reinstate a revoked member's passport — re-creates ENS subdomain, status → active_member.
 * Optionally sets a new membership expiry date.
 */
router.post(
  '/reinstate-passport',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('REINSTATE_PASSPORT'),
  validateRequest(reinstatePassportSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId, expiresAt } = req.body;
      const expiryDate = expiresAt ? new Date(expiresAt) : undefined;
      const member = await memberAdminService.reinstatePassport(memberId, expiryDate);
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to reinstate passport');
    }
  },
);

/**
 * PATCH /api/v2/admin/membership-expiry
 * Set or clear the membership expiry date for a member.
 * Pass expiresAt: null to make membership permanent.
 */
router.patch(
  '/membership-expiry',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('SET_MEMBERSHIP_EXPIRY'),
  validateRequest(membershipExpirySchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { memberId, expiresAt } = req.body;
      const expiryDate = expiresAt ? new Date(expiresAt) : null;
      const member = await memberAdminService.setMembershipExpiry(memberId, expiryDate);
      res.json({ success: true, member });
    } catch (err) {
      handleServiceError(err, res, 'Failed to set membership expiry');
    }
  },
);

export default router;
