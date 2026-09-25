import { ApiError, ForbiddenError, InternalServerError } from "@/lib/errors/api-error";
import type { CreateTenantUserInput } from "@/tenancy/create-tenant-user.schema";
import type { TenantContext } from "@/tenancy/tenant-context";
import type {
  NewAuthUser,
  TenantIdentityAdmin,
} from "@/tenancy/tenant-identity-admin";

export type CreateTenantUserResult = Readonly<{
  userId: string;
  email: string | null;
  role: CreateTenantUserInput["role"];
}>;

export class CreateTenantUserService {
  constructor(private readonly admin: TenantIdentityAdmin) {}

  async execute(
    tenant: TenantContext,
    input: CreateTenantUserInput,
  ): Promise<CreateTenantUserResult> {
    if (tenant.role !== "owner") {
      throw new ForbiddenError("Only a tenant owner can create users");
    }

    let createdUser: NewAuthUser | null = null;

    try {
      createdUser = await this.admin.createUser({
        email: input.email,
        password: input.password,
        emailConfirm: input.emailConfirm,
      });
      await this.admin.addMembership({
        tenantId: tenant.tenantId,
        userId: createdUser.id,
        role: input.role,
      });

      return Object.freeze({
        userId: createdUser.id,
        email: createdUser.email,
        role: input.role,
      });
    } catch (error) {
      if (createdUser) {
        const userIdToDelete = createdUser.id;
        await this.admin.deleteUser(userIdToDelete).catch(() => {
          console.error("Compensating Auth user deletion failed", { userId: userIdToDelete });
        });
      }

      if (error instanceof ApiError) {
        throw error;
      }
      throw new InternalServerError();
    }
  }
}
