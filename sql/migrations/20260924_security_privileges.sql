-- Hardening de privilegios. Revisar y ejecutar manualmente después de auditar
-- propietarios, grants efectivos y pruebas RLS en Supabase. No es idempotente
-- para futuras tablas añadidas a client_00000000.

begin;

-- El schema private solo se usa desde policies de authenticated.
revoke all on schema private from public;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function private.user_is_tenant_member(uuid) from public;
revoke all on function private.user_is_member_of_schema(text) from public;

grant usage on schema private to authenticated;
grant execute on function private.user_is_tenant_member(uuid) to authenticated;
grant execute on function private.user_is_member_of_schema(text) to authenticated;

-- Los datos autenticados nunca deben estar disponibles para anon y el rol
-- authenticated solo puede leer las tablas globales.
revoke all on table public.tenants from anon, authenticated;
revoke all on table public.tenant_config from anon, authenticated;
revoke all on table public.tenant_members from anon, authenticated;

grant select on table public.tenants to authenticated;
grant select on table public.tenant_config to authenticated;
grant select on table public.tenant_members to authenticated;

-- El schema tenant solo se usa después de resolver membership en public.
revoke all on schema client_00000000 from public;
grant usage on schema client_00000000 to authenticated;

revoke all on table client_00000000.voucher_config from anon, authenticated;
revoke all on table client_00000000.clientes from anon, authenticated;
revoke all on table client_00000000.habitaciones from anon, authenticated;
revoke all on table client_00000000.vouchers from anon, authenticated;
revoke all on table client_00000000.reservas from anon, authenticated;
revoke all on table client_00000000.reserva_huespedes from anon, authenticated;

grant select, insert, update, delete
on table client_00000000.voucher_config to authenticated;
grant select, insert, update, delete
on table client_00000000.clientes to authenticated;
grant select, insert, update, delete
on table client_00000000.habitaciones to authenticated;
grant select, insert, update, delete
on table client_00000000.vouchers to authenticated;
grant select, insert, update, delete
on table client_00000000.reservas to authenticated;
grant select, insert, update, delete
on table client_00000000.reserva_huespedes to authenticated;

commit;
