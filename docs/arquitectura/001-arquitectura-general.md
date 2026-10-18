# Arquitectura General — Backend Planner Multi-Tenant

## Resumen
Backend construido con Next.js 16 (App Router), Prisma 7, PostgreSQL/Supabase y arquitectura multi-tenant por schemas de base de datos.

## Patrón de multi-tenant
Cada tenant tiene su propio schema en PostgreSQL con el nombre `client_<digitsRUT>` (ej. `client_12345678`). Todos los tenants comparten la misma estructura de modelos de datos (`Clientes`, `Habitaciones`, `Reservas`, etc.). La tabla `public.tenants` actúa como catálogo que mapea RUT → schema.

## Capas

### 1. API Layer (Next.js App Router)
Rutas bajo `src/app/api/v1/{nivel}/{recurso}/route.ts`.
Niveles: `public`, `protected`, `private`.

### 2. Middleware de Acceso
`src/lib/http/middleware.ts` define tres niveles:
- `withPublic`: sin auth, sin tenant.
- `withProtected`: auth obligatorio (Supabase JWT), sin tenant. Soporta la opción `{ withTenant: true }` para resolución **opcional** de tenant (usada por reservas/habitaciones): el handler recibe `context.tenant`/`context.prisma` opcionales y debe exigir `X-Tenant-RUT` → `400` si no se resuelve.
- `withPrivate`: auth + `X-Tenant-RUT` obligatorio + membresía validada + cliente Prisma del tenant. Actualmente sin rutas asignadas; queda reservado para cuando se implemente la API Key **por cliente** (una por tenant), aún pendiente.

### 3. Acceso a Datos (Prisma)
- `src/lib/prisma/clients.ts`: fábrica de clientes Prisma por schema usando `search_path`.
- Clientes cacheados por nombre de schema.
- Las consultas Prisma no califican nombres de tabla; PostgreSQL resuelve vía `search_path`.

### 4. Base de Datos
- Schema `public`: catálogo de tenants, configuración, miembros.
- Schema `client_<rut>`: datos operativos de cada tenant (clientes, habitaciones, reservas, etc.).
- RLS (Row Level Security) habilitado en tablas de tenant.
- Constraint `EXCLUDE USING GIST` para evitar solapamiento de reservas.

## Versionado de API
Todas las rutas operativas están bajo `api/v1/`. Existe carpeta `api/v2/` con placeholder para futura versión sin romper v1.

## Estructura de carpetas
```
src/
  app/api/v1/{public,protected,private}/...
  app/api/v2/public/health/route.ts
  lib/
    http/middleware.ts
    prisma/clients.ts
    postgres/with-user-postgres.ts
  tenancy/
    parse-tenant-ref.ts
    tenant-resolver.ts
    tenant-repository.ts
  generated/prisma/
```