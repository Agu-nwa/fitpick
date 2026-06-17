export type SessionUser = {
  userId: string;
  email: string;
  role: "user" | "admin";
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  role: "user" | "admin";
  plan: "free" | "plus";
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
};
