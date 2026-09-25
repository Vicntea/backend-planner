begin;

create table if not exists public.tenant_schema_versions (
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    version integer not null check (version > 0),
    checksum varchar(64) not null check (checksum ~ '^[0-9a-f]{64}$'),
    applied_at timestamptz not null default now(),
    primary key (tenant_id, version)
);

alter table public.tenant_schema_versions enable row level security;
alter table public.tenant_schema_versions force row level security;

revoke all on table public.tenant_schema_versions from public, anon, authenticated;

insert into public.tenant_schema_versions (tenant_id, version, checksum)
select id, 1, 'b7a46c45b157b3d03b272d10b4e32e091ded29b0b058fe15f53b586487e8d8a0'
from public.tenants
where schema_name = 'client_00000000'
on conflict (tenant_id, version) do update
set checksum = excluded.checksum, applied_at = now();

commit;
