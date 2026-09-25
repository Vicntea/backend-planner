-- Defense in depth: table owners are also subject to RLS unless the role has
-- BYPASSRLS. The Security Definer helpers are owned by postgres and continue to
-- work under the current project role configuration.
begin;

alter table public.tenants force row level security;
alter table public.tenant_config force row level security;
alter table public.tenant_members force row level security;

alter table client_00000000.voucher_config force row level security;
alter table client_00000000.clientes force row level security;
alter table client_00000000.habitaciones force row level security;
alter table client_00000000.vouchers force row level security;
alter table client_00000000.reservas force row level security;
alter table client_00000000.reserva_huespedes force row level security;

commit;
