# Flujo de Resolución de Tenant

## Rutas actuales del planner (nivel `protected` con tenant)

Las rutas de reservas y habitaciones (`api/v1/private/*`) usan `withProtected(..., { withTenant: true })`, cuya resolución es **opcional**:

1. **Llega la request** con headers:
   - `Authorization: Bearer <JWT>` (obligatorio)
   - `X-Tenant-RUT: 12345678-9` (obligatorio en la práctica)

2. **`withUserPostgres`** valida el JWT de Supabase y entrega `auth` + `postgres`.

3. **`resolveTenantOptional(request, auth, postgres)`**:
   - Sin header `X-Tenant-RUT` → `null`.
   - Con header → consulta `resolveTenantByRut` (SQL abajo).
   - Sin registro válido → `null`.

4. Si hubo tenant → **`getTenantPrisma(schemaName)`** crea/reutiliza un `PrismaClient` con `search_path=client_<rut>,public` y se inyecta `context.tenant`/`context.prisma`.

5. Si no → el handler recibe `tenant`/`prisma` en `undefined` y lanza `ValidationError("X-Tenant-RUT es requerido")` → **`400 VALIDATION_ERROR`**.

> Nota: en este flujo **no se valida API Key** (será por cliente; pendiente de implementar) y un tenant no encontrado/miembro inválido también responde `400` (diferente de `withPrivate`, que responde `404`/`403`).

## Flujo `withPrivate` (nivel `private`, definido sin rutas asignadas)

## Paso a paso

1. **Llega la request** con headers:
   - `Authorization: Bearer <JWT>` (obligatorio)
   - `X-Tenant-RUT: 12345678-9` (obligatorio en `private`)

2. **`verifyRequest(request)`**: valida el JWT de Supabase y extrae `auth.userId`.

3. **`parseTenantRef(headers)`**: lee `X-Tenant-RUT`, valida formato `^\d{7,8}-[0-9K]$`.

4. **`resolveTenantByRut(auth, postgres, rut)`**:
   - Deriva `schemaName = client_<digits>`.
   - Consulta:
     ```sql
     SELECT t.id, t.rut, t.schema_name, tm.role
     FROM public.tenant_members tm
     INNER JOIN public.tenants t ON t.id = tm.tenant_id
     WHERE t.rut = $1
       AND t.schema_name = $2
       AND tm.user_id = $3::uuid
       AND t.activo = true
     LIMIT 1
     ```
   - Si no hay registro → `404 TENANT_NOT_FOUND`.

5. **`getTenantPrisma(schemaName)`**: crea o reutiliza un `PrismaClient` con `search_path=client_<rut>,public`.

6. **Handler ejecuta** con `context.prisma` apuntando al schema correcto.

> *Pendiente:* la API Key será **por cliente** (una key por tenant) y se validará dentro de `withPrivate` cuando se implemente; hoy no se valida ninguna.

## Si falta `X-Tenant-RUT`
- En `private` (`withPrivate`) y en las rutas del planner (`withProtected` + `withTenant`) → `400 VALIDATION_ERROR` ("X-Tenant-RUT es requerido").

## Sin fallback a `public`
Endpoints que requieren tenant nunca caen en schema `public` automáticamente. El schema `public` solo se usa en endpoints `public` o `protected` que no requieren tenant.