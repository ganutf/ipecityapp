/**
 * V2 Project Routes — read + create
 * Mounted at /api/v2/projects
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import { auditLoggerV2 } from '../middleware/privyAuth';
import { ProjectService } from '../services/ProjectService';
import { storage } from '../storage';
import { insertProjectSchema, updateProjectSchema } from '@shared/schema';
import { parseIntParam, handleServiceError } from '../lib/routeHelpers';
import { ValidationError } from '../lib/errors';

const router = Router();
const projectService = new ProjectService(storage);

/** GET /api/v2/projects — list all projects */
router.get('/', privyAuthMiddleware, async (_req, res) => {
  try {
    const projects = await projectService.listProjects();
    res.json({ projects });
  } catch (err) {
    handleServiceError(err, res, 'Failed to get projects');
  }
});

/** GET /api/v2/projects/by-member/:memberId — projects created by or with member as participant */
router.get(
  '/by-member/:memberId',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const memberId = parseIntParam(req, 'memberId');
      const projects = await projectService.listProjectsByMember(memberId);
      res.json({ projects });
    } catch (err) {
      handleServiceError(err, res, 'Failed to get member projects');
    }
  },
);

/** GET /api/v2/projects/:id — single project with creator + participants */
router.get(
  '/:id',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const id = parseIntParam(req, 'id');
      const result = await projectService.getProject(id);
      res.json(result);
    } catch (err) {
      handleServiceError(err, res, 'Failed to get project');
    }
  },
);

/** POST /api/v2/projects — create */
router.post(
  '/',
  privyAuthMiddleware,
  auditLoggerV2('CREATE_PROJECT'),
  validateRequest(insertProjectSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        throw new ValidationError('Authenticated member required');
      }
      const project = await projectService.createProject(req.member.id, req.body);
      res.status(201).json(project);
    } catch (err) {
      handleServiceError(err, res, 'Failed to create project');
    }
  },
);

/** PATCH /api/v2/projects/:id — update (creator or admin) */
router.patch(
  '/:id',
  privyAuthMiddleware,
  auditLoggerV2('UPDATE_PROJECT'),
  validateRequest(updateProjectSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        throw new ValidationError('Authenticated member required');
      }
      const id = parseIntParam(req, 'id');
      const project = await projectService.updateProject(req.member, id, req.body);
      res.json(project);
    } catch (err) {
      handleServiceError(err, res, 'Failed to update project');
    }
  },
);

/** DELETE /api/v2/projects/:id — delete (creator or admin) */
router.delete(
  '/:id',
  privyAuthMiddleware,
  auditLoggerV2('DELETE_PROJECT'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        throw new ValidationError('Authenticated member required');
      }
      const id = parseIntParam(req, 'id');
      await projectService.deleteProject(req.member, id);
      res.json({ success: true });
    } catch (err) {
      handleServiceError(err, res, 'Failed to delete project');
    }
  },
);

export default router;
