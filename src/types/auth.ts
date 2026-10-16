import type { Role } from '@prisma/client';

export type { Role };

export interface AuthUser {
  id:          string;
  email:       string;
  name:        string;
  role:        Role;
  department:  string | null;
  designation: string | null;
  avatarUrl:   string | null;
  managerId:   string | null;
}

export interface AuthSession {
  user: AuthUser;
  expires: string;
}
