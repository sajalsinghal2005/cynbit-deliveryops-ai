import type { UserRole, SafeUserProfile } from './auth';

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

export interface ListUsersResponse {
  success: boolean;
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
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

export interface ListSessionsResponse {
  success: boolean;
  count: number;
  sessions: SafeSessionItem[];
  message?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
  temporaryPassword?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user: SafeUserProfile;
  temporaryPassword: string;
  message?: string;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
}

export interface UpdateUserResponse {
  success: boolean;
  user: SafeUserProfile;
  message?: string;
}

export interface SetStatusPayload {
  isActive: boolean;
}

export interface SetStatusResponse {
  success: boolean;
  user: SafeUserProfile;
  sessionsRevoked: number;
  message?: string;
}

export interface ResetPasswordPayload {
  newPassword?: string;
  revokeSessions?: boolean;
}

export interface ResetPasswordResponse {
  success: boolean;
  temporaryPassword: string;
  sessionsRevoked: number;
  message?: string;
}

export interface RevokeSessionResponse {
  success: boolean;
  isCurrentSession: boolean;
  message?: string;
}

export interface RevokeAllSessionsResponse {
  success: boolean;
  count: number;
  preservedCurrentSession: boolean;
  message?: string;
}
