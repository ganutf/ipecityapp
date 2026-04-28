/**
 * ProjectService - orchestrates project-related business operations.
 * Sits between the routes (controllers) and storage (data layer).
 */

import type { IStorage } from '../storage';
import type { InsertProject, Member, Project, UpdateProject } from '@shared/schema';
import { ACTIVE_MEMBER_STATUSES } from '@shared/constants';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';

export class ProjectService {
  constructor(private storage: IStorage) {}

  async createProject(
    creatorMemberId: number,
    input: InsertProject,
  ): Promise<Project> {
    if (!creatorMemberId || creatorMemberId <= 0) {
      throw new ValidationError(`Invalid creator id: ${creatorMemberId}`);
    }

    const { participantMemberIds = [], ...projectFields } = input as InsertProject & {
      participantMemberIds?: number[];
    };

    // Always include the creator
    const dedupedIds = Array.from(new Set([...participantMemberIds, creatorMemberId]));

    // Validate every participant resolves to an active member
    const otherIds = dedupedIds.filter((id) => id !== creatorMemberId);
    if (otherIds.length > 0) {
      const fetched = await Promise.all(otherIds.map((id) => this.storage.getMember(id)));
      fetched.forEach((member, idx) => {
        if (!member) {
          throw new ValidationError(`Participant ${otherIds[idx]} not found`);
        }
        if (!ACTIVE_MEMBER_STATUSES.includes(member.status as typeof ACTIVE_MEMBER_STATUSES[number])) {
          throw new ValidationError(`Participant ${otherIds[idx]} is not an active member`);
        }
      });
    }

    return this.storage.createProject(
      { ...projectFields, createdBy: creatorMemberId } as InsertProject & { createdBy: number },
      dedupedIds,
    );
  }

  async getProject(id: number): Promise<{ project: Project; creator: Member; participants: Member[] }> {
    const result = await this.storage.getProject(id);
    if (!result) throw new NotFoundError(`Project ${id} not found`);
    return result;
  }

  async listProjects() {
    return this.storage.listProjects();
  }

  async listProjectsByMember(memberId: number) {
    if (!memberId || memberId <= 0) {
      throw new ValidationError(`Invalid member id: ${memberId}`);
    }
    return this.storage.listProjectsByMember(memberId);
  }

  async updateProject(
    actor: Member,
    projectId: number,
    input: UpdateProject,
  ): Promise<Project> {
    const existing = await this.storage.getProject(projectId);
    if (!existing) throw new NotFoundError(`Project ${projectId} not found`);

    const isOwner = existing.project.createdBy === actor.id;
    const isAdmin = actor.memberType === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to edit this project');
    }

    const { participantMemberIds, ...projectFields } = input as UpdateProject & {
      participantMemberIds?: number[];
    };

    let dedupedIds: number[] | undefined;
    if (participantMemberIds !== undefined) {
      // Always include the creator (owner of the project, not the actor)
      dedupedIds = Array.from(
        new Set([...(participantMemberIds ?? []), existing.project.createdBy]),
      );

      const otherIds = dedupedIds.filter((id) => id !== existing.project.createdBy);
      if (otherIds.length > 0) {
        const fetched = await Promise.all(otherIds.map((id) => this.storage.getMember(id)));
        fetched.forEach((member, idx) => {
          if (!member) {
            throw new ValidationError(`Participant ${otherIds[idx]} not found`);
          }
          if (!ACTIVE_MEMBER_STATUSES.includes(member.status as typeof ACTIVE_MEMBER_STATUSES[number])) {
            throw new ValidationError(`Participant ${otherIds[idx]} is not an active member`);
          }
        });
      }
    }

    return this.storage.updateProject(projectId, projectFields, dedupedIds);
  }

  async deleteProject(actor: Member, projectId: number): Promise<void> {
    const existing = await this.storage.getProject(projectId);
    if (!existing) throw new NotFoundError(`Project ${projectId} not found`);

    const isOwner = existing.project.createdBy === actor.id;
    const isAdmin = actor.memberType === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to delete this project');
    }

    await this.storage.deleteProject(projectId);
  }
}
