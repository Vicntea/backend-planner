import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ConflictError, InternalServerError } from "@/lib/errors/api-error";
import type { TenantRole } from "@/tenancy/tenant-context";

export type NewAuthUser = Readonly<{
  id: string;
  email: string | null;
}>;

export interface TenantIdentityAdmin {
  createUser(input: Readonly<{
    email: string;
    password: string;
    emailConfirm: boolean;
  }>): Promise<NewAuthUser>;
  addMembership(input: Readonly<{
    tenantId: string;
    userId: string;
    role: TenantRole;
  }>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export class SupabaseTenantIdentityAdmin implements TenantIdentityAdmin {
  constructor(private readonly supabase: SupabaseClient) {}

  async createUser(input: Readonly<{
    email: string;
    password: string;
    emailConfirm: boolean;
  }>): Promise<NewAuthUser> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: input.emailConfirm,
    });

    if (error || !data.user) {
      if (error?.status === 422 || error?.message.toLowerCase().includes("already")) {
        throw new ConflictError("A user with this email already exists");
      }
      throw new InternalServerError();
    }

    return this.mapUser(data.user);
  }

  async addMembership(input: Readonly<{
    tenantId: string;
    userId: string;
    role: TenantRole;
  }>): Promise<void> {
    const { error } = await this.supabase.from("tenant_members").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      role: input.role,
    });

    if (error) {
      throw new InternalServerError();
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new InternalServerError();
    }
  }

  private mapUser(user: User): NewAuthUser {
    return Object.freeze({ id: user.id, email: user.email ?? null });
  }
}
