export type UserRole = 'ADMIN' | 'OPERATOR' | 'APPROVER';

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: SafeUserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<{ success: boolean; message?: string }>;
  refreshUser: () => Promise<SafeUserProfile | null>;
}
