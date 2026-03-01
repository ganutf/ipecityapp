/**
 * V2 Admin Routes — member management (approval, denial, type updates)
 * Mounted at /api/v2/admin
 */

import { Router, Response } from 'express';
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

const memberAdminService = new MemberAdminService(
  storage,
  process.env.JUSTANAME_API_KEY || '',
);

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

export default router;
