import fs from "node:fs";
import crypto from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
loadEnvConfig(process.cwd());

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

function normalizeRut(value) {
  const match = /^(\d{7,8})-([0-9K])$/i.exec(value);
  if (!match) throw new Error("TENANT_RUT must use 12345678-9 or 1234567-9 format");
  const body = match[1];
  const expected = body.split("").reverse().reduce((sum, digit, index) => {
    const factor = (index % 6) + 2;
    return sum + Number(digit) * factor;
  }, 0);
  let check = 11 - (expected % 11);
  if (check === 11) check = 0;
  if (check === 10) check = "K";
  if (String(check) !== match[2].toUpperCase()) throw new Error("TENANT_RUT check digit is invalid");
  return { rut: `${body}-${String(check)}`, digits: body };
}

const input = {
  rut: normalizeRut(required("TENANT_RUT")),
  name: required("TENANT_NAME"),
  slug: required("TENANT_SLUG"),
  timezone: process.env.TENANT_TIMEZONE?.trim() || "America/Santiago",
  ownerUserId: required("TENANT_OWNER_USER_ID"),
};
if (input.name.length > 150) throw new Error("TENANT_NAME exceeds 150 characters");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 100) {
  throw new Error("TENANT_SLUG must contain lowercase letters, numbers and single hyphens");
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.ownerUserId)) {
  throw new Error("TENANT_OWNER_USER_ID must be a UUID");
}
try {
  new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format();
} catch {
  throw new Error("TENANT_TIMEZONE is invalid");
}

const schemaName = `client_${input.rut.digits}`;
if (!/^client_[0-9]{7,8}$/.test(schemaName)) throw new Error("Derived schema is invalid");
const templatePath = new URL("../sql/templates/tenant_v001.sql", import.meta.url);
const template = fs.readFileSync(templatePath, "utf8");
if (!template.includes("__TENANT_SCHEMA__")) throw new Error("Tenant template placeholder is missing");
const checksum = crypto.createHash("sha256").update(template).digest("hex");
const ddl = template.replaceAll("__TENANT_SCHEMA__", schemaName);

if (process.env.PROVISION_DRY_RUN === "true") {
  console.log(JSON.stringify({ valid: true, schemaName, checksum, version: 1 }, null, 2));
  process.exit(0);
}

const database = new Client({ connectionString: required("DIRECT_URL"), max: 1 });
const tables = ["voucher_config", "clientes", "habitaciones", "vouchers", "reservas", "reserva_huespedes"];
try {
  await database.connect();
  await database.query("begin");
  await database.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`provision:${input.rut.rut}`]);

  const ownerExists = await database.query(
    `select exists(select 1 from auth.users where id = $1::uuid) as exists`,
    [input.ownerUserId],
  );
  if (!ownerExists.rows[0].exists) throw new Error("Owner Auth user not found");
  const existing = await database.query(`select 1 from public.tenants where rut = $1 or schema_name = $2`, [input.rut.rut, schemaName]);
  if (existing.rows.length) throw new Error("Tenant RUT or schema already exists");

  await database.query(`create schema ${database.escapeIdentifier(schemaName)}`);
  const tenant = await database.query(
    `insert into public.tenants (rut, nombre, slug, schema_name, timezone)
     values ($1, $2, $3, $4, $5) returning id`,
    [input.rut.rut, input.name, input.slug, schemaName, input.timezone],
  );
  const tenantId = tenant.rows[0].id;
  await database.query(
    `insert into public.tenant_config (tenant_id, nombre_comercial)
     values ($1::uuid, $2)`,
    [tenantId, input.name],
  );
  await database.query(
    `insert into public.tenant_members (tenant_id, user_id, role)
     values ($1::uuid, $2::uuid, 'owner')`,
    [tenantId, input.ownerUserId],
  );
  await database.query(ddl);

  const escapedSchema = database.escapeIdentifier(schemaName);
  await database.query(`revoke all on schema ${escapedSchema} from public`);
  await database.query(`grant usage on schema ${escapedSchema} to authenticated`);
  for (const table of tables) {
    const relation = `${escapedSchema}.${database.escapeIdentifier(table)}`;
    await database.query(`revoke all on table ${relation} from anon, authenticated`);
    await database.query(`grant select, insert, update, delete on table ${relation} to authenticated`);
    await database.query(`alter table ${relation} force row level security`);
  }
  await database.query(
    `insert into public.tenant_schema_versions (tenant_id, version, checksum)
     values ($1::uuid, 1, $2)`,
    [tenantId, checksum],
  );
  await database.query("commit");
  console.log(JSON.stringify({ provisioned: true, tenantId, rut: input.rut.rut, schemaName, version: 1, checksum }, null, 2));
} catch (error) {
  await database.query("rollback").catch(() => undefined);
  console.error(JSON.stringify({ provisioned: false, message: error instanceof Error ? error.message : "Unknown error" }, null, 2));
  process.exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
}
