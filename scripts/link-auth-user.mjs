import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
loadEnvConfig(process.cwd());

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const authUserId = required("AUTH_USER_ID");
const tenantId = required("TENANT_ID");
const role = process.env.TENANT_ROLE ?? "owner";
if (!new Set(["owner", "admin", "member"]).has(role)) throw new Error("Invalid TENANT_ROLE");

const database = new Client({ connectionString: required("DIRECT_URL"), max: 1 });
try {
  await database.connect();
  await database.query("begin");
  const user = await database.query(
    `select exists(select 1 from auth.users where id = $1::uuid) as exists`,
    [authUserId],
  );
  const tenant = await database.query(
    `select exists(select 1 from public.tenants where id = $1::uuid and activo = true) as exists`,
    [tenantId],
  );
  if (!user.rows[0].exists) throw new Error("Auth user not found");
  if (!tenant.rows[0].exists) throw new Error("Active tenant not found");

  await database.query(
    `insert into public.tenant_members (tenant_id, user_id, role) values ($1::uuid, $2::uuid, $3)`,
    [tenantId, authUserId, role],
  );
  await database.query("commit");
  console.log(JSON.stringify({ linked: true, authUserId, tenantId, role }, null, 2));
} catch (error) {
  await database.query("rollback").catch(() => undefined);
  console.error(JSON.stringify({ linked: false, message: error instanceof Error ? error.message : "Unknown error" }, null, 2));
  process.exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
}
