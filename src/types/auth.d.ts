import type { DefaultSession, DefaultUser } from 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id:          string;
      role:        Role;
      department:  string | null;
      designation: string | null;
      avatarUrl:   string | null;
      managerId:   string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role:        Role;
    department:  string | null;
    designation: string | null;
    avatarUrl:   string | null;
    managerId:   string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:          string;
    role:        Role;
    department:  string | null;
    designation: string | null;
    avatarUrl:   string | null;
    managerId:   string | null;
  }
}
