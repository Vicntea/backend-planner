# Auditoría del SQL actual

Fuente preservada en `sql/current-schema.sql`. No es una migración corregida ni debe ejecutarse como parte del runtime.

## Hallazgos

- `private.user_is_tenant_member(uuid)` y `private.user_is_member_of_schema(text)` usan `STABLE`, `SECURITY DEFINER` y `search_path = ''`; sus tablas/funciones están calificadas.
- No hay `REVOKE EXECUTE ... FROM PUBLIC`. PostgreSQL concede `EXECUTE` por defecto, por lo que el `GRANT` explícito a `authenticated` no vuelve la función exclusiva a ese rol.
- Solo existe `ENABLE ROW LEVEL SECURITY`; falta `FORCE ROW LEVEL SECURITY`. El propietario de una tabla o un rol con `BYPASSRLS` puede omitir sus policies.
- La migración no documenta grants sobre schemas, tablas, sequences o routines. El estado efectivo del proyecto Supabase debe inspeccionarse antes de depender de esos permisos.
- La policy de `public.tenant_members` permite a cada usuario leer únicamente sus propias membresías y rompe correctamente el ciclo con las funciones auxiliares.
- `idx_tenant_members_user` respalda la búsqueda por `auth.uid()`; el índice sobre `tenant_id` es redundante para los accesos actuales porque la PK ya empieza por `tenant_id`, aunque puede conservarse por/query plans futuros.
- Las policies del tenant inicial están acopladas a `'client_00000000'`. La plantilla futura debe usar una expresión equivalente basada en `current_schema`, o parametrizar el DDL generado.
- La exclusión GIST protege `pendiente` y `confirmada`. `cancelada`, `completada` y `no_show` quedan fuera; confirmar esta regla antes de cambiarla.
- No existe versionado de estructura tenant ni una garantía singleton para `voucher_config`.
- `schema_name` está protegido solo por una regexp generalmente válida. Falta validar el RUT, largura del identificador derivado y correspondencia entre RUT y schema.
- Las restricciones de fechas, capacidad, importes, edad y solapamiento están correctamente delegadas a PostgreSQL.

## Hardening pendiente

1. Ejecutar auditoría real de `pg_proc`, `pg_policies`, `information_schema.role_table_grants` y `information_schema.routine_privileges`.
2. Revocar `EXECUTE` de `PUBLIC` sobre funciones `SECURITY DEFINER` en la misma transacción de creación.
3. Decidir y documentar `FORCE RLS` por tabla; tener en cuenta las funciones `SECURITY DEFINER` que deben leer memberships.
4. Aplicar el principio de mínimo privilegio: `anon` sin acceso a datos; `authenticated` solo con operaciones requeridas.
5. Crear roles dedicados y distintos para runtime, migraciones y provisioning.
6. Añadir tests pgTAP/integración ejecutados como `authenticated`, nunca como `service_role`/administrador.
7. Crear una migración correctiva separada; no editar ni reejecutar este snapshot sobre la base actual.

## Estado de la auditoría en Supabase

- `ENABLE ROW LEVEL SECURITY` está presente en las 10 tablas.
- `FORCE ROW LEVEL SECURITY` está aplicado a las 10 tablas.
- Todas las tablas son propiedad de `postgres`.
- `user_is_tenant_member` y `user_is_member_of_schema` están corretamente calificadas, son `STABLE`, usan `SECURITY DEFINER` y `search_path = ''`.
- La migración de privilegios fue aplicada y corrigió grants de `anon`, tablas públicas y funciones.
- `authenticated` solo tiene `SELECT` sobre las tablas públicas.
- `authenticated` tiene DML sobre tablas de `client_00000000`; RLS filtra las filas.
- `anon` no tiene `USAGE` sobre `client_00000000` y no puede leer sus tablas.
- Un usuario autenticado ficticio sin membership obtuvo cero tenants, cero clientes y cero habitaciones.
- Una mutación sobre `public.tenants` como `authenticated` fue denegada por privilegios.
- `auth.uid()` reflejó correctamente el `sub` inyectado y el contexto desapareció tras `ROLLBACK`.

Limitaciones del test actual:

- `auth.users` contiene 0 usuarios.
- `public.tenant_members` contiene 0 memberships.
- No existe todavía un caso real de membership autorizada.
- No se pudo probar un JWT emitido por Supabase Auth porque no hay usuario con el que iniciar sesión.

Este documento evalúa la seguridad; no modifica la base de datos.
