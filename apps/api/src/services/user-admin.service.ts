import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { authService, type SafeUserProfile } from "./auth.service.js";
import type { UserRole, Prisma } from "@prisma/client";

export class AdminUserError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AdminUserError";
    this.statusCode = statusCode;
  }
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | "ALL";
  status?: "ACTIVE" | "INACTIVE" | "ALL";
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  activeSessionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  role: UserRole;
  temporaryPassword?: string;
}

export interface UpdateUserData {
  name?: string;
  role?: UserRole;
}

export interface SafeSessionItem {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
  device?: string;
  ipPreview?: string;
}

export class UserAdminService {
  /**
   * Generates a cryptographically strong temporary password.
   */
  public generateSecurePassword(): string {
    const randomBytes = crypto.randomBytes(9).toString("base64url");
    return `${randomBytes}!Aa9`;
  }

  /**
   * Formats actor string consistently as "Name (email)" or "email".
   */
  private formatActor(admin: SafeUserProfile): string {
    return admin.name ? `${admin.name} (${admin.email})` : admin.email;
  }

  /**
   * Concurrency-safe verification of the last active Administrator invariant.
   * Uses PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) within an interactive transaction
   * to guarantee that concurrent demotions/deactivations cannot leave 0 active administrators.
   */
  private async ensureNotLastActiveAdmin(
    tx: Prisma.TransactionClient,
    targetUserId: string,
    actionDesc: string
  ): Promise<void> {
    // Acquire exclusive row locks on all active admin records with deterministic ordering to prevent deadlocks
    const lockedActiveAdmins: { id: string }[] = await tx.$queryRaw`
      SELECT id FROM users 
      WHERE role = 'ADMIN'::"UserRole" AND "isActive" = true 
      ORDER BY id ASC
      FOR UPDATE
    `;

    const remainingAdmins = lockedActiveAdmins.filter((a) => a.id !== targetUserId);

    if (remainingAdmins.length === 0) {
      throw new AdminUserError(
        `Cannot ${actionDesc} the last active Administrator. System requires at least one active Administrator.`,
        400
      );
    }
  }

  /**
   * 1. List users with pagination, role/status filters, search, and active session counts.
   * Newest users first. Excludes passwordHash and sessionTokenHash.
   */
  public async listUsers(params: ListUsersParams): Promise<{
    users: AdminUserListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // Search by name or email
    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Role filter
    if (params.role && params.role !== "ALL") {
      where.role = params.role;
    }

    // Status filter
    if (params.status && params.status !== "ALL") {
      where.isActive = params.status === "ACTIVE";
    }

    const now = new Date();

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          sessions: {
            where: { expiresAt: { gt: now } },
            select: { id: true },
          },
        },
      }),
    ]);

    const formattedUsers: AdminUserListItem[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      activeSessionsCount: u.sessions.length,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single user safe profile.
   */
  public async getUserById(userId: string): Promise<AdminUserListItem> {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          where: { expiresAt: { gt: now } },
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      activeSessionsCount: user.sessions.length,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * 2. Create user with validated email, name, and role.
   * Hashes password, records audit log, and returns safe user + temporary password.
   */
  public async createUser(
    admin: SafeUserProfile,
    data: CreateUserData
  ): Promise<{ user: SafeUserProfile; temporaryPassword: string }> {
    const normalizedEmail = data.email.trim().toLowerCase();

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new AdminUserError(
        `A user account with email "${normalizedEmail}" already exists.`,
        409
      );
    }

    const tempPassword = data.temporaryPassword || this.generateSecurePassword();
    const passwordHash = await authService.hashPassword(tempPassword);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: data.role,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          eventType: "USER_CREATED",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: newUser.id,
            targetEmail: newUser.email,
            role: newUser.role,
            isActive: newUser.isActive,
          },
        },
      });

      return newUser;
    });

    return {
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        isActive: result.isActive,
        createdAt: result.createdAt.toISOString(),
      },
      temporaryPassword: tempPassword,
    };
  }

  /**
   * 3. Edit user profile and role.
   * Concurrency-safe against demoting the last active administrator.
   */
  public async updateUser(
    admin: SafeUserProfile,
    userId: string,
    data: UpdateUserData
  ): Promise<SafeUserProfile> {
    // Prevent acting admin from accidentally demoting themselves
    if (admin.id === userId && data.role && data.role !== "ADMIN") {
      throw new AdminUserError(
        "Administrators cannot demote their own account. Another administrator must perform this action.",
        400
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
      }

      const isDemotingAdmin =
        existing.role === "ADMIN" &&
        existing.isActive &&
        data.role !== undefined &&
        data.role !== "ADMIN";

      if (isDemotingAdmin) {
        await this.ensureNotLastActiveAdmin(tx, userId, "demote");
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          role: data.role !== undefined ? data.role : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          eventType: "USER_UPDATED",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: updated.id,
            targetEmail: updated.email,
            changes: {
              ...(data.name !== undefined && { previousName: existing.name, newName: updated.name }),
              ...(data.role !== undefined && { previousRole: existing.role, newRole: updated.role }),
            },
          },
        },
      });

      return updated;
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt.toISOString(),
    };
  }

  /**
   * 4. Activate or deactivate an account.
   * Deactivation revokes all active sessions atomically and is concurrency-protected
   * against deactivating the last active administrator.
   */
  public async setUserStatus(
    admin: SafeUserProfile,
    userId: string,
    isActive: boolean
  ): Promise<{ user: SafeUserProfile; sessionsRevoked: number }> {
    // Prevent administrator from deactivating themselves
    if (admin.id === userId && !isActive) {
      throw new AdminUserError(
        "Administrators cannot deactivate their own account. Another administrator must perform this action.",
        400
      );
    }

    let sessionsRevoked = 0;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
      }

      // If deactivating an active admin, enforce concurrency-safe last admin check
      if (!isActive && existing.role === "ADMIN" && existing.isActive) {
        await this.ensureNotLastActiveAdmin(tx, userId, "deactivate");
      }

      // Deactivation revokes all sessions atomically
      if (!isActive) {
        const deleted = await tx.session.deleteMany({
          where: { userId },
        });
        sessionsRevoked = deleted.count;
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          eventType: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: updated.id,
            targetEmail: updated.email,
            isActive: updated.isActive,
            sessionsRevoked,
          },
        },
      });

      return updated;
    });

    return {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt.toISOString(),
      },
      sessionsRevoked,
    };
  }

  /**
   * 5. Reset a user's password securely.
   * Accepts or generates temporary password, hashes it, revokes sessions by default,
   * and records an audit log without leaking any secret.
   */
  public async resetPassword(
    admin: SafeUserProfile,
    userId: string,
    options: {
      newPassword?: string;
      revokeSessions?: boolean;
      currentSessionToken?: string;
    } = {}
  ): Promise<{ temporaryPassword: string; sessionsRevoked: number }> {
    const tempPassword = options.newPassword || this.generateSecurePassword();
    const passwordHash = await authService.hashPassword(tempPassword);
    const shouldRevoke = options.revokeSessions !== false;

    let sessionsRevoked = 0;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
      }

      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      if (shouldRevoke) {
        // If an admin resets their own password, preserve their current session token if provided
        if (admin.id === userId && options.currentSessionToken) {
          const currentHash = authService.hashToken(options.currentSessionToken);
          const deleted = await tx.session.deleteMany({
            where: {
              userId,
              sessionTokenHash: { not: currentHash },
            },
          });
          sessionsRevoked = deleted.count;
        } else {
          const deleted = await tx.session.deleteMany({
            where: { userId },
          });
          sessionsRevoked = deleted.count;
        }
      }

      await tx.auditEvent.create({
        data: {
          eventType: "USER_PASSWORD_RESET",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: existing.id,
            targetEmail: existing.email,
            sessionsRevoked,
          },
        },
      });
    });

    return {
      temporaryPassword: tempPassword,
      sessionsRevoked,
    };
  }

  /**
   * 6. List a user's active sessions.
   * Returns safe metadata, excludes sessionTokenHash, and indicates isCurrent.
   */
  public async listUserSessions(
    userId: string,
    currentSessionToken?: string
  ): Promise<SafeSessionItem[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
    }

    const currentHash = currentSessionToken
      ? authService.hashToken(currentSessionToken)
      : null;

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        sessionTokenHash: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
    });

    return sessions.map((s) => {
      const isCurrent = currentHash !== null && s.sessionTokenHash === currentHash;

      // Extract high-level safe device representation without exposing raw strings unnecessarily
      let device = "Standard Browser";
      if (s.userAgent) {
        if (s.userAgent.includes("Chrome")) device = "Chrome";
        else if (s.userAgent.includes("Firefox")) device = "Firefox";
        else if (s.userAgent.includes("Safari")) device = "Safari";
        else if (s.userAgent.includes("Edge")) device = "Edge";
        else device = s.userAgent.slice(0, 40);
      }

      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.lastActiveAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent,
        device,
        ipPreview: s.ipAddress ? (s.ipAddress === "::1" ? "127.0.0.1" : s.ipAddress) : undefined,
      };
    });
  }

  /**
   * 7. Revoke a single active session belonging to target user.
   */
  public async revokeSession(
    admin: SafeUserProfile,
    userId: string,
    sessionId: string,
    currentSessionToken?: string
  ): Promise<{ isCurrentSession: boolean }> {
    const currentHash = currentSessionToken
      ? authService.hashToken(currentSessionToken)
      : null;

    return await prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: sessionId, userId },
        include: { user: { select: { id: true, email: true } } },
      });

      if (!session) {
        throw new AdminUserError(
          `Session "${sessionId}" was not found for user "${userId}".`,
          404
        );
      }

      const isCurrentSession =
        currentHash !== null && session.sessionTokenHash === currentHash;

      await tx.session.delete({
        where: { id: sessionId },
      });

      await tx.auditEvent.create({
        data: {
          eventType: "USER_SESSION_REVOKED",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: userId,
            targetEmail: session.user.email,
            sessionId,
            isCurrentSession,
          },
        },
      });

      return { isCurrentSession };
    });
  }

  /**
   * 8. Revoke all active sessions belonging to target user.
   * Supports preserving the admin's current session when self-managing.
   */
  public async revokeAllSessions(
    admin: SafeUserProfile,
    userId: string,
    options: {
      keepCurrentSession?: boolean;
      currentSessionToken?: string;
    } = {}
  ): Promise<{ count: number; preservedCurrentSession: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new AdminUserError(`User with ID "${userId}" was not found.`, 404);
    }

    const currentHash = options.currentSessionToken
      ? authService.hashToken(options.currentSessionToken)
      : null;

    const preserveCurrent =
      admin.id === userId &&
      options.keepCurrentSession !== false &&
      currentHash !== null;

    let revokedCount = 0;

    await prisma.$transaction(async (tx) => {
      const deleteWhere: Prisma.SessionWhereInput = { userId };
      if (preserveCurrent && currentHash) {
        deleteWhere.sessionTokenHash = { not: currentHash };
      }

      const deleted = await tx.session.deleteMany({
        where: deleteWhere,
      });

      revokedCount = deleted.count;

      await tx.auditEvent.create({
        data: {
          eventType: "USER_ALL_SESSIONS_REVOKED",
          actor: this.formatActor(admin),
          payload: {
            adminUserId: admin.id,
            targetUserId: userId,
            targetEmail: user.email,
            revokedCount,
            preservedCurrentSession: preserveCurrent,
          },
        },
      });
    });

    return { count: revokedCount, preservedCurrentSession: preserveCurrent };
  }
}

export const userAdminService = new UserAdminService();
