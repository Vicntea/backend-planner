# Endpoints v1 — Protegidos

## Base URL
`GET /api/v1/protected/...`

## Autenticación
Obligatoria: header `Authorization: Bearer <JWT>` de Supabase Auth.

## Tenant
No se requiere `X-Tenant-RUT`. Operan sobre schema `public` (catálogo de tenants y membresías).

## Endpoints

### GET /api/v1/protected/me
Devuelve el perfil del usuario autenticado.

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "usuario@email.com",
    "phone": null
  }
}
```

### GET /api/v1/protected/tenants
Lista los tenants a los que pertenece el usuario autenticado.

**Respuesta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rut": "12345678-9",
      "nombre": "Mi Empresa",
      "slug": "mi-empresa",
      "role": "owner"
    }
  ]
}
```

### GET /api/v1/protected/tenants/[tenantId]
Devuelve detalles de un tenant específico al que pertenece el usuario.

### GET /api/v1/protected/tenants/[tenantId]/users
Lista los usuarios miembros de un tenant (solo owner/admin).

## Códigos de error
- `401 UNAUTHORIZED`: Token inválido o expirado.
- `403 FORBIDDEN`: Acceso denegado.
- `404 NOT_FOUND`: Recurso no encontrado.