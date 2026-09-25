# Backend REST API

Backend-only de un SaaS multitenant de alojamiento. Next.js se usa exclusivamente para Route Handlers; Angular es el frontend independiente y se autentica con Supabase Auth.

## Stack

- Next.js 16 App Router + TypeScript estricto
- Supabase Auth (`@supabase/supabase-js`, `@supabase/server`)
- PostgreSQL directo con `pg`
- RLS mediante `withPostgresClient`
- Zod 4
- Vitest 5 y ESLint 9

No hay páginas, React UI, Tailwind, tRPC ni GraphQL.

## Requisitos

- Node.js 22 LTS o superior
- npm 10 o superior
- Un proyecto Supabase
- Una conexión PostgreSQL directa/session pooler para el runtime RLS-scoped

## Instalación

```powershell
node -v
npm -v
npm install
```

Copia `.env.example` a `.env.local` y completa los valores. Nunca subas `.env.local`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto usada server-side |
| `SUPABASE_PUBLISHABLE_KEY` | Credencial pública para el cliente scoped; RLS sigue aplicando |
| `SUPABASE_DB_URL` | Conexión `pg` para inyectar JWT claims y ejecutar como `authenticated` |
| `DATABASE_URL` | Rol administrativo para migraciones; aún no se usa en endpoints |
| `DIRECT_URL` / `DIRECT_DATABASE_URL` | Conexión directa reservada al CLI/migraciones y Prisma |
| `SUPABASE_SECRET_KEY` | Solo provisioning/administración; nunca en requests de usuario |
| `CORS_ALLOWED_ORIGINS` | Origins exactos separados por coma |
| `RUT_ENCRYPTION_KEY` | Cifrado server-side de RUT; se implementará con tenant CRUD |
| `RUT_LOOKUP_KEY` | HMAC de búsqueda exacta; nunca en Angular |
| `RUT_CURRENT_KEY_VERSION` | Versión activa de claves |

Las variables de backend no usan prefijo `NEXT_PUBLIC_`, aunque algunas sean publishable keys. Esto reduce el riesgo de incluirlas accidentalmente en un bundle.

## Supabase Auth

Angular inicia sesión con Supabase, conserva la sesión y refresca el access token. Next.js no recibe ni almacena refresh tokens:

```http
Authorization: Bearer <supabase-access-token>
```

`src/auth/authenticate-request.ts` usa primitivos oficiales actuales:

1. `verifyAuth` valida firma, issuer y expiración.
2. `createContextClient` crea un cliente RLS-scoped con el token.
3. `supabase.auth.getUser()` confirma el usuario y entrega `user.id`.

La API exige que el rol JWT sea `authenticated` y que `sub` coincida con `user.id`. Un token ausente, inválido o expirado produce `401`. Los fallos internos se sanitizan.

## Database y RLS

`src/lib/postgres/with-user-postgres.ts` compone la vía oficial directa de Supabase:

```text
JWT verificado
  → request.jwt.claims
  → SET LOCAL ROLE authenticated
  → query PostgreSQL
  → RLS
  → commit/rollback
```

La conexión y los claims son locales a la transacción y no se almacenan en variables globales.

Limitación actual: `withPostgresClient` es Alpha y ofrece una transacción por `query()`. No existe API para agrupar varios `query()` en una transacción. Los workflows multi-consulta atómicos deben implementarse con una función SQL única hasta que exista soporte multi-statement.

## Tenant architecture

Los schemas `client_*` representan tenants. Las tablas globales son:

- `public.tenants`
- `public.tenant_members`
- `public.tenant_config`

El cliente solicita un tenant mediante:

```http
X-Tenant-Id: <UUID>
```

No se acepta `X-Schema`. `src/tenancy/parse-tenant-id.ts` valida únicamente el UUID. El schema se resolverá consultando `public.tenants` y comprobando `public.tenant_members` bajo el contexto del usuario. `client_00000000` nunca será fallback.

`TenantContext` es inmutable y vive solo durante la request:

```ts
type TenantContext = Readonly<{
  tenantId: string;
  clientRut: string;
  schema: string;
  role: "owner" | "admin" | "member";
}>;
```

## Autenticación vs autorización

- Supabase Auth responde “¿quién es?”.
- `tenant_members` responde “¿a qué tenant pertenece y con qué rol?”.
- RLS vuelve a evaluar la pertenencia en PostgreSQL.
- La autorización de negocio se añadirá después; `member`, `admin` y `owner` no deben asumir capacidades idénticas.

## API

### Health público

```http
GET /api/public/health
```

```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

No expone versión de DB, proyecto, DSN ni migraciones.

### Identidad autenticada

```http
GET /api/protected/me
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "user@example.com",
    "phone": null
  }
}
```

No existe `GET /api/public/tenants`: descubrir empresas se considera información autenticada.

### Tenants del usuario

```http
GET /api/protected/tenants
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "rut": "00000000-0",
      "nombre": "Tenant de Prueba",
      "slug": "tenant-test",
      "role": "owner"
    }
  ]
}
```

La respuesta no incluye `schema_name`. La consulta se ejecuta en PostgreSQL bajo el contexto RLS del usuario.

Con RLS, un tenant ajeno, inactivo e inexistente se tratan deliberadamente igual: todos producen `404 TENANT_NOT_FOUND`. No se hace un lookup administrativo para revelar la existencia de una empresa.

## Bootstrap de usuarios

No se insertan filas manualmente en `auth.users`. Los scripts usan Supabase Auth Admin y luego `public.tenant_members` mediante una conexión administrativa.

1. Agrega `SUPABASE_SECRET_KEY` a `.env.local`; la key nunca se usa en Angular.
2. Obtén el UUID real de `public.tenants`.
3. Crea un owner nuevo:

```bash
export BOOTSTRAP_TENANT_ID="<tenant-uuid>"
export BOOTSTRAP_USER_EMAIL="owner@example.com"
read -s BOOTSTRAP_USER_PASSWORD
export BOOTSTRAP_USER_PASSWORD
npm run user:bootstrap-owner
```

El script crea el usuario con `email_confirm=true`, inserta la membership `owner` y elimina el usuario Auth si la vínculo falla.

Para vincular un usuario que ya existe en Auth:

```bash
export AUTH_USER_ID="<auth-user-uuid>"
export TENANT_ID="<tenant-uuid>"
export TENANT_ROLE="owner" # owner | admin | member
npm run user:link
```

## Provisioning de tenant

El schema se deriva del RUT; no se acepta como parámetro:

```bash
export TENANT_RUT="12345678-5"
export TENANT_NAME="Empresa Ejemplo"
export TENANT_SLUG="empresa-ejemplo"
export TENANT_TIMEZONE="America/Santiago"
export TENANT_OWNER_USER_ID="<auth-user-uuid>"
npm run tenant:provision
```

`npm run tenant:provision` es transaccional y realiza:

- validación del RUT y dígito verificador;
- derivación y validación de `client_<digitos>`;
- advisory lock por RUT;
- creación del schema;
- aplicación de `sql/templates/tenant_v001.sql`;
- grants, RLS y `FORCE RLS`;
- `public.tenants` y `public.tenant_config`;
- membership owner;
- registro en `public.tenant_schema_versions`.

Para validar sin escribir:

```bash
PROVISION_DRY_RUN=true npm run tenant:provision
```

## API de usuarios del tenant

Solo un `owner` autenticado puede crear usuarios:

```http
POST /api/protected/tenants/{tenantId}/users
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

```json
{
  "email": "member@example.com",
  "password": "a-strong-password",
  "role": "member",
  "emailConfirm": true
}
```

La operación usa Supabase Auth Admin server-side y después crea la membership. Si la membership falla, intenta eliminar el usuario Auth para compensar. Nunca devuelve access tokens ni la secret key.

## Prisma y schemas dinámicos

Prisma 7 estable se usará solo donde aporte valor: modelos globales, tipos y migraciones administrativas. No se enumerarán schemas tenant en Prisma Schema porque ese enfoque no escala con schemas creados dinámicamente.

El acceso tenant dinámico usará PostgreSQL/`pg`. Prisma y sus extensiones no proporcionan una API oficial y segura para combinar por request `search_path`, cambio de rol, claims JWT y una transacción Prisma.

No usar una conexión administrativa para requests de usuario: la guía Prisma/Supabase utiliza un rol con `BYPASSRLS`, útil para migraciones pero incompatible con la meta de mantener RLS real.

## Database SQL

- Snapshot actual preservado en `sql/current-schema.sql`.
- Auditoría en `sql/AUDIT.md`.
- Hardening de privilegios aplicado mediante `sql/migrations/20260924_security_privileges.sql`.
- `FORCE ROW LEVEL SECURITY` aplicado mediante `sql/migrations/20260924_force_rls.sql`.
- Versionado tenant aplicado mediante `sql/migrations/20260924_tenant_schema_versions.sql`.
- Template base: `sql/templates/tenant_v001.sql`.
- El snapshot no se ejecuta automáticamente.

Hallazgos originales principales: faltaban `REVOKE ... FROM PUBLIC`, grants mínimos, `FORCE RLS` y versionado. La auditoría ejecutada y sus correcciones quedan en `sql/AUDIT.md`.

## Migrations y provisioning

La migración de privilegios, `FORCE RLS` y versionado tenant ya fue aplicada. El template y el provisioner transaccional están implementados y validados; la convergencia de futuras versiones se hará mediante nuevos templates numerados y scripts de migración.

## Provisioning implementado

El provisioning usa:

- `public.tenant_schema_versions` para registrar versión/checksum;
- `sql/templates/tenant_v001.sql` como estructura base;
- `npm run tenant:provision` como entrypoint transaccional;
- RUT → `client_<digitos>` como única fuente del schema.

Los schemas se crean con identifiers escapados y el placeholder del template se reemplaza únicamente después de validar el RUT. El provisioner no acepta `schema_name` desde el usuario.

El template fue probado en una transacción con `ROLLBACK`: creó las 6 tablas y 24 policies, y no dejó el schema temporal.

## Bootstrap implementado

Los comandos para crear y vincular usuarios están en:

```text
scripts/bootstrap-tenant-owner.mjs
scripts/link-auth-user.mjs
```

La API de creación de usuarios está en:

```text
POST /api/protected/tenants/{tenantId}/users
```

La API requiere un JWT de un `owner`, una `SUPABASE_SECRET_KEY` server-side y valida el body con Zod. Supabase Auth Admin crea el usuario; la membership se crea después mediante privileged access. Si la membership falla, se intenta eliminar el usuario Auth.

## Testing

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm run db:audit
```

Tests RLS reales deben ejecutarse con usuarios de prueba y rol `authenticated`. Una prueba con `service_role` no demuestra que RLS bloquee acceso ajeno.

## Deployment

- Runtime Node.js; `pg` no funciona en isolates sin TCP.
- Pool pequeño por instancia; la documentación Supabase sugiere 1–4 en serverless.
- Variables server-only en el secret store del proveedor.
- `@supabase/server` se fija en versión exacta porque su middleware es Alpha.
- Health checks no incluyen detalles de dependencias.

## Future architecture

La separación por dominio permite extraer servicios, workers, cache y APIs externas más adelante. No se implementan microservicios en esta etapa.

## Estado actual

Implementado:

- backend-only;
- health público;
- `/api/protected/me`;
- contexto de auth y tenant;
- `TenantResolver` y repositorio PostgreSQL RLS-scoped;
- `/api/protected/tenants`;
- errores/respuestas REST;
- Adaptador RLS-scoped validado con conexión real, pendiente JWT emitido por Auth;
- `SUPABASE_SECRET_KEY` aún no está configurada, por lo que la API administrativa está pendiente de live test.
- Provisioning, bootstrap owner y API para crear usuarios adicionales;
- Requests `.http` para endpoints actuales y futuros;
- Tests base, incluyendo compensación de usuario Auth y tenant resolver.

Pendiente inmediato:

1. Crear un usuario en Supabase Auth para la prueba.
2. Asignar su membership explícita al tenant `client_00000000`.
3. Iniciar sesión y verificar `auth.uid()`/`user.id` con un JWT real.
4. Probar `/api/protected/tenants` y acceso a `client_00000000`.
5. Añadir el primer CRUD después de cerrar la prueba con JWT real.
## Prisma models

`prisma/schema.prisma` es un snapshot multi-schema estático y no se usa para resolver tenants dinámicos en runtime.

Modelos `public`:

- Tenant
- TenantConfig
- TenantMember
- TenantSchemaVersion

Modelos `client_00000000`:

- VoucherConfig
- Cliente
- Habitacion
- Voucher
- Reserva
- ReservaHuesped

Comandos:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
```

El cliente generado se escribe en `src/generated/prisma` y está ignorado por Git. Los tenants futuros siguen accediéndose con `pg` y RLS; no se añaden schemas Prisma por tenant.
### Limitación de introspección Prisma

`prisma db pull` requiere añadir el schema `auth` a `datasource.schemas` porque `public.tenant_members.user_id` referencia `auth.users`. El schema manual no incluye `auth` ni relación a `auth.users` para evitar modelar tablas gestionadas por Supabase Auth. `prisma validate` y `prisma generate` funcionan correctamente con el snapshot estático.