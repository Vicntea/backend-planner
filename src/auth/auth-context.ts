export type AuthContext = Readonly<{
  userId: string;
  email: string | null;
  phone: string | null;
}>;
