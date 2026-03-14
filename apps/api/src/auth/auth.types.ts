export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  isActive: number | boolean;
  emailVerified: number | boolean;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export type AuthPayload = {
  sub: string;
  email: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
};
