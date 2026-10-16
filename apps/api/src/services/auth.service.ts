import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import type { UserRole } from "@prisma/client";

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: SafeUserProfile;
  sessionToken?: string;
  csrfToken?: string;
  expiresAt?: Date;
}

export class AuthService {
  /**
   * Hashes a password with standard bcrypt (10 rounds).
   */
  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Securely compares password against stored bcrypt hash.
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a cryptographically strong random session token.
   */
  public generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generates a cryptographically strong random CSRF token.
   */
  public generateCsrfToken(): string {
    return crypto.randomBytes(24).toString("hex");
  }

  /**
   * Computes SHA-256 hash of a session token for secure database indexing and storage.
   */
  public hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Validates user credentials, creates a server-side session, and logs audit events.
   * Generic error messages are returned to prevent user enumeration attacks.
   */
  public async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const normalizedEmail = params.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Record failure attempt without exposing account non-existence
      await this.recordAuditLog({
        eventType: "USER_LOGIN_FAILURE",
        actor: normalizedEmail || "ANONYMOUS",
        payload: {
          attemptedEmail: normalizedEmail,
          reason: "INVALID_CREDENTIALS",
          ipAddress: params.ipAddress || "UNKNOWN",
        },
      });

      return {
        success: false,
        message: "Invalid email or password.",
      };
    }

    if (!user.isActive) {
      await this.recordAuditLog({
        eventType: "USER_LOGIN_FAILURE",
        actor: user.email,
        payload: {
          userId: user.id,
          reason: "ACCOUNT_DISABLED",
          ipAddress: params.ipAddress || "UNKNOWN",
        },
      });

      return {
        success: false,
        message: "Account is disabled. Please contact an administrator.",
      };
    }

    const passwordMatch = await this.verifyPassword(
      params.password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      await this.recordAuditLog({
        eventType: "USER_LOGIN_FAILURE",
        actor: user.email,
        payload: {
          userId: user.id,
          reason: "INVALID_CREDENTIALS",
          ipAddress: params.ipAddress || "UNKNOWN",
        },
      });

      return {
        success: false,
        message: "Invalid email or password.",
      };
    }

    // Generate secure session token and hash
    const rawSessionToken = this.generateSessionToken();
    const sessionTokenHash = this.hashToken(rawSessionToken);
    const csrfToken = this.generateCsrfToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        sessionTokenHash,
        userId: user.id,
        expiresAt,
        userAgent: params.userAgent?.slice(0, 255),
        ipAddress: params.ipAddress?.slice(0, 45),
      },
    });

    // Record login success
    await this.recordAuditLog({
      eventType: "USER_LOGIN_SUCCESS",
      actor: user.email,
      payload: {
        userId: user.id,
        role: user.role,
        ipAddress: params.ipAddress || "UNKNOWN",
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      sessionToken: rawSessionToken,
      csrfToken,
      expiresAt,
    };
  }

  /**
   * Invalidates active session from PostgreSQL and records audit trail.
   */
  public async logout(
    rawSessionToken?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!rawSessionToken) {
      return { success: true, message: "Logged out successfully." };
    }

    const sessionTokenHash = this.hashToken(rawSessionToken);

    try {
      const existingSession = await prisma.session.findUnique({
        where: { sessionTokenHash },
        include: { user: true },
      });

      if (existingSession) {
        await prisma.session.delete({
          where: { sessionTokenHash },
        });

        await this.recordAuditLog({
          eventType: "USER_LOGOUT",
          actor: existingSession.user.email,
          payload: {
            userId: existingSession.userId,
            ipAddress: ipAddress || "UNKNOWN",
          },
        });
      }
    } catch {
      // Session already invalidated or removed
    }

    return { success: true, message: "Logged out successfully." };
  }

  /**
   * Looks up active user by raw session cookie token.
   */
  public async getCurrentUser(
    rawSessionToken?: string,
  ): Promise<SafeUserProfile | null> {
    if (!rawSessionToken) return null;

    const sessionTokenHash = this.hashToken(rawSessionToken);

    const session = await prisma.session.findUnique({
      where: { sessionTokenHash },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Check user active status
    if (!session.user.isActive) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Update lastActiveAt periodically if older than 1 minute
    if (Date.now() - session.lastActiveAt.getTime() > 60 * 1000) {
      prisma.session
        .update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      isActive: session.user.isActive,
      createdAt: session.user.createdAt.toISOString(),
    };
  }

  /**
   * Helper to safely persist security audit events without throwing or blocking operations.
   */
  private async recordAuditLog(data: {
    eventType: string;
    actor: string;
    payload: Record<string, any>;
  }) {
    try {
      await prisma.auditEvent.create({
        data: {
          eventType: data.eventType,
          actor: data.actor,
          payload: data.payload,
        },
      });
    } catch (err) {
      console.error("Failed to write security audit record:", err);
    }
  }
}

export const authService = new AuthService();
