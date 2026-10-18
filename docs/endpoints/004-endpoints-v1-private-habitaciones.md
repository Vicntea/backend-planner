# Endpoints v1 — Habitaciones

## Base URL
`/api/v1/private/habitaciones`

## Nivel de acceso
**`protected` con resolución de tenant** (`withProtected(..., { withTenant: true })`).

## Autenticación
Obligatoria: header `Authorization: Bearer <JWT>` de Supabase Auth.

## Tenant
**Obligatorio:** header `X-Tenant-RUT` (formato `12345678-9`).
Si falta o el tenant no existe / el usuario no es miembro → `400 VALIDATION_ERROR`.

**API Key:** No se valida. La validación de API Key será **por cliente** (una por tenant) y está pendiente de implementar; no aplica a ningún endpoint actualmente.

Todas las consultas apuntan al schema `client_<digitsRUT>` vía `search_path`.

---

## GET /api/v1/private/habitaciones

Listar habitaciones del tenant.

### Query params
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estado` | string (opcional) | Filtrar por estado (activa, inactiva, etc.) |
| `tipo` | string (opcional) | Filtrar por tipo (estándar, ejecutiva, suite, familiar) |
| `page` | number (opcional, default 1) | Página |
| `pageSize` | number (opcional, default 20) | Tamaño de página |

### Respuesta (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Habitación 101",
      "tipo": "estándar",
      "descripcion": "Habitación individual con vista al jardín",
      "capacidad": 1,
      "precioNoche": 45000,
      "moneda": "CLP",
      "estado": "activa",
      "createdAt": "2026-10-17T20:00:00Z",
      "updatedAt": "2026-10-17T20:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## POST /api/v1/private/habitaciones

Crear una nueva habitación.

### Body
```json
{
  "nombre": "Habitación 101",
  "tipo": "estándar",
  "descripcion": "Habitación individual con vista al jardín",
  "capacidad": 1,
  "precioNoche": 45000,
  "moneda": "CLP",
  "estado": "activa"
}
```

### Validaciones
- `nombre` es obligatorio y único por tenant.
- `capacidad` debe ser ≥ 1.
- `precioNoche` no puede ser negativo.

### Respuesta (201)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Habitación 101",
    ...
  }
}
```

### Errores
- `400 VALIDATION_ERROR`: Datos inválidos o tenant sin resolver.
- `401 UNAUTHORIZED`: Token inválido o expirado.
- `409 CONFLICT`: Ya existe una habitación con ese nombre.

---

## GET /api/v1/private/habitaciones/:id

Obtener una habitación por ID.

### Respuesta (200)
Objeto de la habitación.

### Errores
- `404 NOT_FOUND`: Habitación no encontrada.

---

## PATCH /api/v1/private/habitaciones/:id

Modificar una habitación existente.

### Body (todos los campos opcionales)
```json
{
  "nombre": "Habitación 101 Renovada",
  "precioNoche": 52000,
  "estado": "activa"
}
```

### Errores
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`: Si el nuevo nombre ya existe.

---

## DELETE /api/v1/private/habitaciones/:id

Eliminar una habitación físicamente.

### Restricción
No se puede eliminar si tiene reservas asociadas (devuelve `409 CONFLICT`).

### Respuesta (200)
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "uuid"
  }
}
```

### Errores
- `404 NOT_FOUND`: Habitación no encontrada.
- `409 CONFLICT`: Tiene reservas asociadas.