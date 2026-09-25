import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
loadEnvConfig(process.cwd());

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const tenantId = required("BOOTSTRAP_TENANT_ID");
const email = required("BOOTSTRAP_USER_EMAIL").trim().toLowerCase();
const password = required("BOOTSTRAP_USER_PASSWORD");
const supabaseUrl = required("SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const directUrl = required("DIRECT_URL");

if (password.length < 12) throw new Error("BOOTSTRAP_USER_PASSWORD must contain at least 12 characters");

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const database = new Client({ connectionString: directUrl, max: 1 });
let createdUserId = null;

try {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Auth user creation failed");
  createdUserId = data.user.id;

  await database.connect();
  await database.query("begin");
  const tenant = await database.query(
    `select id from public.tenants where id = $1::uuid and activo = true for update`,
    [tenantId],
  );
  if (!tenant.rows[0]) throw new Error("Active tenant not found");

  await database.query(
    `insert into public.tenant_members (tenant_id, user_id, role) values ($1::uuid, $2::uuid, 'owner')`,
    [tenantId, createdUserId],
  );
  await database.query("commit");

  console.log(JSON.stringify({ created: true, userId: createdUserId, tenantId, role: "owner" }, null, 2));
} catch (error) {
  await database.query("rollback").catch(() => undefined);
  if (createdUserId) {
    await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
  }
  console.error(JSON.stringify({ created: false, message: error instanceof Error ? error.message : "Unknown error" }, null, 2));
  process.exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
}
