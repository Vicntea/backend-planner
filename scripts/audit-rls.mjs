import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
loadEnvConfig(process.cwd());

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required for db:audit");
}

const client = new Client({ connectionString, max: 1 });

async function inspectMetadata() {
  const connection = (
    await client.query(`
      select current_user, session_user, current_database() as database_name
    `)
  ).rows[0];

  const tables = (
    await client.query(`
      select
        n.nspname as schema_name,
        c.relname as table_name,
        pg_get_userbyid(c.relowner) as owner,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('public', 'client_00000000')
      order by n.nspname, c.relname
    `)
  ).rows;

  const functions = (
    await client.query(`
      select
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_userbyid(p.proowner) as owner,
        p.prosecdef as security_definer,
        p.provolatile as volatility,
        p.proconfig,
        p.proacl::text as privileges
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where (n.nspname = 'private'
        and p.proname in ('user_is_tenant_member', 'user_is_member_of_schema'))
        or (n.nspname = 'public' and p.proname = 'set_updated_at')
      order by n.nspname, p.proname
    `)
  ).rows;

  const grants = (
    await client.query(`
      select
        table_schema,
        table_name,
        grantee,
        string_agg(privilege_type, ',' order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema in ('public', 'client_00000000')
        and grantee in ('anon', 'authenticated')
      group by table_schema, table_name, grantee
      order by table_schema, table_name, grantee
    `)
  ).rows;

  const policies = (
    await client.query(`
      select schemaname, tablename, policyname, cmd, roles::text
      from pg_policies
      where schemaname in ('public', 'client_00000000')
      order by schemaname, tablename, policyname
    `)
  ).rows;

  const counts = (
    await client.query(`
      select
        (select count(*)::int from auth.users) as auth_users,
        (select count(*)::int from public.tenants) as tenants,
        (select count(*)::int from public.tenant_members) as memberships,
        (select count(*)::int from client_00000000.clientes) as initial_clientes
    `)
  ).rows[0];

  return { connection, tables, functions, grants, policyCount: policies.length, policies, counts };
}

async function verifyNegativeRls() {
  const fakeUserId = "00000000-0000-0000-0000-000000000001";
  await client.query("begin");

  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: fakeUserId, role: "authenticated" }),
    ]);

    const scoped = (
      await client.query(`
        select
          current_user as db_role,
          auth.uid()::text as auth_uid,
          (select count(*)::int from public.tenant_members) as memberships,
          (select count(*)::int from public.tenants) as tenants,
          (select count(*)::int from client_00000000.clientes) as clientes,
          (select count(*)::int from client_00000000.habitaciones) as habitaciones
      `)
    ).rows[0];

    let publicMutationDenied = false;
    try {
      await client.query("update public.tenants set nombre = nombre");
    } catch (error) {
      publicMutationDenied = error.code === "42501";
    }

    return {
      dbRole: scoped.db_role,
      uidMatches: scoped.auth_uid === fakeUserId,
      visibleMemberships: scoped.memberships,
      visibleTenants: scoped.tenants,
      visibleClientes: scoped.clientes,
      visibleHabitaciones: scoped.habitaciones,
      publicMutationDenied,
    };
  } finally {
    await client.query("rollback");
  }
}

async function verifyAnonymousDenied() {
  await client.query("begin");
  try {
    await client.query("set local role anon");
    try {
      await client.query("select count(*) from client_00000000.clientes");
      return false;
    } catch (error) {
      return error.code === "42501";
    }
  } finally {
    await client.query("rollback");
  }
}

try {
  await client.connect();
  const metadata = await inspectMetadata();
  const authenticatedWithoutMembership = await verifyNegativeRls();
  const anonTenantAccessDenied = await verifyAnonymousDenied();
  const afterRollback = (await client.query("select current_user")).rows[0].current_user;

  console.log(
    JSON.stringify(
      {
        metadata,
        rls: { authenticatedWithoutMembership, anonTenantAccessDenied, afterRollback },
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
