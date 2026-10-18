# Catálogo Completo de Endpoints — Backend Planner Multi-Tenant

## Convención de IDs

Cada endpoint tiene un ID único con formato `EP-###` para facilitar su referencia en documentación, tickets y pruebas.

## Resumen por nivel de acceso

| Nivel | Autenticación | Tenant (`X-Tenant-RUT`) | API Key (`X-API-Key`) |
|-------|--------------|------------------------|----------------------|
| `public` | No | No | No |
| `protected` | Sí (JWT Bearer) | No | No |
| `protected` con tenant | Sí (JWT Bearer) | **Sí (obligatorio)** | No |
| `private` | Sí (JWT Bearer) | **Sí (obligatorio)** | Pendiente (API Key **por cliente**) |

> Los endpoints de reservas y habitaciones (EP-006..EP-015) usan `protected` con resolución de tenant (`withProtected(..., { withTenant: true })`): requieren JWT + `X-Tenant-RUT`. **Ningún endpoint valida API Key**: la validación será **por cliente** (una key por tenant) y está pendiente de implementar. El nivel `private` (`withPrivate`) queda definido en el middleware, sin rutas asignadas, reservado para cuando exista esa API Key por cliente.

---

## Endpoints v1 — Público (sin autenticación)

### EP-001 — Health Check Público
**GET** `/api/v1/public/health`

Verifica que el servicio esté operativo.

**Headers:** Ninguno.

**Respuesta (200):**
```json
{ "status": "ok" }
```

**Errores:** Ninguno esperado.

---

## Endpoints v1 — Protegidos (requieren JWT Bearer)

### EP-002 — Perfil del Usuario Autenticado
**GET** `/api/v1/protected/me`

Devuelve los datos del usuario autenticado en Supabase Auth.

**Headers:**
- `Authorization: Bearer <JWT>` (obligatorio)

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

**Errores:**
- `401 UNAUTHORIZED`: Token inválido, expirado o ausente.

---

### EP-003 — Listar Tenants del Usuario
**GET** `/api/v1/protected/tenants`

Lista los tenants a los que pertenece el usuario autenticado (con membresía activa).

**Headers:**
- `Authorization: Bearer <JWT>` (obligatorio)

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

**Errores:**
- `401 UNAUTHORIZED`: Token inválido.

---

### EP-004 — Detalle de un Tenant
**GET** `/api/v1/protected/tenants/[tenantId]`

Devuelve los detalles de un tenant específico al que pertenece el usuario.

**Headers:**
- `Authorization: Bearer <JWT>` (obligatorio)

**Parámetros de ruta:**
- `tenantId`: UUID del tenant.

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "rut": "12345678-9",
    "nombre": "Mi Empresa",
    "slug": "mi-empresa",
    "schema_name": "client_12345678",
    "timezone": "America/Santiago",
    "activo": true,
    "role": "owner"
  }
}
```

**Errores:**
- `401 UNAUTHORIZED`: Token inválido.
- `404 NOT_FOUND`: Tenant no encontrado o sin membresía.

---

### EP-005 — Usuarios de un Tenant
**GET** `/api/v1/protected/tenants/[tenantId]/users`

Lista los usuarios miembros de un tenant (solo para owner/admin).

**Headers:**
- `Authorization: Bearer <JWT>` (obligatorio)

**Parámetros de ruta:**
- `tenantId`: UUID del tenant.

**Respuesta (200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid",
      "email": "usuario@email.com",
      "role": "member",
      "createdAt": "2026-10-17T20:00:00Z"
    }
  ]
}
```

**Errores:**
- `401 UNAUTHORIZED`: Token inválido.
- `403 FORBIDDEN`: El usuario no es owner/admin del tenant.
- `404 NOT_FOUND`: Tenant no encontrado.

---

## Endpoints v1 — Reservas (Planner)

Nivel `protected` con resolución de tenant (`withProtected(..., { withTenant: true })`).

Requieren `Authorization: Bearer <JWT>` y `X-Tenant-RUT`. Si falta el header o el tenant no se resuelve → `400 VALIDATION_ERROR`. No se valida API Key (pendiente; será por cliente).

### EP-006 — Listar Reservas del Mes
**GET** `/api/v1/private/reservas`

Lista reservas del tenant con filtros opcionales.

**Headers:**
- `Authorization: Bearer <JWT>` (obligatorio)
- `X-Tenant-RUT: 12345678-9` (obligatorio)

**Query params:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `habitacionId` | UUID (opcional) | Filtrar por habitación |
| `estado` | string (opcional) | Filtrar por estado (pendiente, confirmada, cancelada) |
| `checkIn` | datetime (opcional) | Fecha mínima de check-in |
| `checkOut` | datetime (opcional) | Fecha máxima de check-in |
| `mes` | number 1-12 (opcional) | Mes para filtrar (requiere `anio`) |
| `anio` | number YYYY (opcional) | Año para filtrar (requiere `mes`) |
| `page` | number (opcional, default 1) | Página |
| `pageSize` | number (opcional, default 20) | Tamaño de página |

**Ejemplo:** `GET /api/v1/private/reservas?mes=10&anio=2026`

**Respuesta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "habitacionId": "uuid",
      "clienteId": "uuid",
      "voucherId": "uuid",
      "codigo": "RES-ABC12-XYZ78",
      "checkIn": "2026-10-20",
      "checkOut": "2026-10-22",
      "estado": "pendiente",
      "cantidadHuespedes": 2,
      "precioNoche": 50000,
      "subtotal": 100000,
      "descuento": 0,
      "impuestos": 0,
      "total": 100000,
      "moneda": "CLP",
      "notas": null,
      "createdAt": "2026-10-17T20:00:00Z",
      "updatedAt": "2026-10-17T20:00:00Z",
      "noches": 2,
      "precioPorNoche": 50000,
      "habitacion": { ... },
      "cliente": { ... },
      "huespedes": [ { ... } ]
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

**Errores:**
- `400 VALIDATION_ERROR`: Parámetros inválidos o tenant sin resolver (header ausente/no encontrado).
- `401 UNAUTHORIZED`: Token inválido o expirado.

---

### EP-007 — Crear Reserva
**POST** `/api/v1/private/reservas`

Registra una nueva reserva con validación de solapamiento de fechas.

**Headers:** Mismos que EP-006.

**Body:**
```json
{
  "habitacionId": "uuid",
  "clienteId": "uuid",
  "voucherId": "uuid",
  "checkIn": "2026-10-20",
  "checkOut": "2026-10-22",
  "cantidadHuespedes": 2,
  "precioNoche": 50000,
  "descuento": 0,
  "impuestos": 0,
  "moneda": "CLP",
  "notas": "Texto opcional",
  "huespedes": [
    { "nombre": "Juan", "apellido": "Pérez", "edad": 30 },
    { "nombre": "María", "apellido": "García", "edad": 28 }
  ]
}
```

**Validaciones:**
1. `checkOut` debe ser posterior a `checkIn`.
2. **Solapamiento**: no puede existir otra reserva en la misma habitación con estado `pendiente` o `confirmada` y fechas que se solapen.
3. Campos numéricos no negativos.

**Respuesta (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "codigo": "RES-ABC12-XYZ78",
    "noches": 2,
    "precioPorNoche": 50000,
    "subtotal": 100000,
    "total": 100000,
    ...
  }
}
```

**Errores:**
- `400 VALIDATION_ERROR`: Datos inválidos o fechas incorrectas.
- `401 UNAUTHORIZED`: Token inválido o expirado.
- `409 CONFLICT`: La habitación ya tiene una reserva en esas fechas.

---

### EP-008 — Obtener Reserva por ID
**GET** `/api/v1/private/reservas/:id`

Devuelve una reserva específica con sus relaciones (habitación, cliente, huéspedes, voucher).

**Headers:** Mismos que EP-006.

**Parámetros de ruta:**
- `id`: UUID de la reserva.

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "noches": 2,
    "precioPorNoche": 50000,
    "habitacion": { ... },
    "cliente": { ... },
    "voucher": { ... },
    "huespedes": [ { ... } ]
  }
}
```

**Errores:**
- `404 NOT_FOUND`: Reserva no encontrada.

---

### EP-009 — Modificar Reserva
**PATCH** `/api/v1/private/reservas/:id`

Modifica una reserva existente. Re-valida solapamiento si cambian fechas o habitación.

**Headers:** Mismos que EP-006.

**Body (todos los campos opcionales):**
```json
{
  "habitacionId": "uuid",
  "clienteId": "uuid",
  "voucherId": "uuid",
  "checkIn": "2026-10-21",
  "checkOut": "2026-10-23",
  "cantidadHuespedes": 2,
  "precioNoche": 50000,
  "descuento": 0,
  "impuestos": 0,
  "moneda": "CLP",
  "estado": "confirmada",
  "notas": "Texto actualizado",
  "huespedes": [
    { "nombre": "Juan", "apellido": "Pérez", "edad": 30 }
  ]
}
```

**Validaciones:**
1. Si se modifican fechas o habitación, se re-valida solapamiento excluyendo la reserva actual.
2. `checkOut` debe ser posterior a `checkIn`.
3. Se recalculan automáticamente `subtotal`, `descuento`, `impuestos`, `total`.

**Respuesta (200):** Objeto de la reserva actualizada.

**Errores:**
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT` (solapamiento)

---

### EP-010 — Eliminar Reserva
**DELETE** `/api/v1/private/reservas/:id`

Elimina físicamente una reserva (cascade elimina huéspedes asociados).

**Headers:** Mismos que EP-006.

**Parámetros de ruta:**
- `id`: UUID de la reserva.

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "uuid"
  }
}
```

**Errores:**
- `404 NOT_FOUND`: Reserva no encontrada.

---

## Endpoints v1 — Habitaciones

Nivel `protected` con resolución de tenant (`withProtected(..., { withTenant: true })`).

Requieren `Authorization: Bearer <JWT>` y `X-Tenant-RUT`. Si falta el header o el tenant no se resuelve → `400 VALIDATION_ERROR`. No se valida API Key (pendiente; será por cliente).

### EP-011 — Listar Habitaciones
**GET** `/api/v1/private/habitaciones`

Lista habitaciones del tenant con filtros opcionales.

**Headers:** Mismos que EP-006.

**Query params:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estado` | string (opcional) | Filtrar por estado (activa, inactiva) |
| `tipo` | string (opcional) | Filtrar por tipo (estándar, ejecutiva, suite, familiar) |
| `page` | number (opcional, default 1) | Página |
| `pageSize` | number (opcional, default 20) | Tamaño de página |

**Respuesta (200):**
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

**Errores:**
- `400 VALIDATION_ERROR`: Parámetros inválidos o tenant sin resolver.
- `401 UNAUTHORIZED`: Token inválido o expirado.

---

### EP-012 — Crear Habitación
**POST** `/api/v1/private/habitaciones`

Crea una nueva habitación en el tenant.

**Headers:** Mismos que EP-006.

**Body:**
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

**Validaciones:**
- `nombre` es obligatorio y único por tenant.
- `capacidad` debe ser ≥ 1.
- `precioNoche` no puede ser negativo.

**Respuesta (201):**
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

**Errores:**
- `400 VALIDATION_ERROR`: Datos inválidos o tenant sin resolver.
- `401 UNAUTHORIZED`: Token inválido o expirado.
- `409 CONFLICT`: Ya existe una habitación con ese nombre.

---

### EP-013 — Obtener Habitación por ID
**GET** `/api/v1/private/habitaciones/:id`

**Headers:** Mismos que EP-006.

**Parámetros de ruta:**
- `id`: UUID de la habitación.

**Respuesta (200):** Objeto de la habitación.

**Errores:**
- `404 NOT_FOUND`: Habitación no encontrada.

---

### EP-014 — Modificar Habitación
**PATCH** `/api/v1/private/habitaciones/:id`

**Headers:** Mismos que EP-006.

**Body (todos los campos opcionales):**
```json
{
  "nombre": "Habitación 101 Renovada",
  "precioNoche": 52000,
  "estado": "activa"
}
```

**Validaciones:**
- Si se cambia el nombre, debe ser único en el tenant.

**Respuesta (200):** Objeto de la habitación actualizada.

**Errores:**
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`: El nuevo nombre ya existe.

---

### EP-015 — Eliminar Habitación
**DELETE** `/api/v1/private/habitaciones/:id`

Elimina una habitación físicamente.

**Restricción:** No se puede eliminar si tiene reservas asociadas.

**Headers:** Mismos que EP-006.

**Parámetros de ruta:**
- `id`: UUID de la habitación.

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "uuid"
  }
}
```

**Errores:**
- `404 NOT_FOUND`: Habitación no encontrada.
- `409 CONFLICT`: Tiene reservas asociadas.

---

## Endpoints v2 — Placeholder (futura versión)

### EP-016 — Health Check v2
**GET** `/api/v2/public/health`

Placeholder para futura versión de la API.

**Respuesta (200):**
```json
{
  "status": "ok",
  "version": "v2"
}
```

---

## Endpoints Legados (sin versionar, mantener por compatibilidad)

Estos endpoints existen bajo rutas sin prefijo `/api/v1/`:

| ID | Método | Ruta | Nivel | Descripción |
|----|--------|------|-------|-------------|
| EP-L001 | GET | `/api/public/health` | public | Health check |
| EP-L002 | GET | `/api/protected/me` | protected | Perfil de usuario |
| EP-L003 | GET | `/api/protected/tenants` | protected | Listar tenants |
| EP-L004 | GET | `/api/protected/tenants/[tenantId]` | protected | Detalle de tenant |
| EP-L005 | GET | `/api/protected/tenants/[tenantId]/users` | protected | Usuarios de tenant |

> **Recomendación:** Usar los endpoints versionados bajo `/api/v1/...` para nueva integración. Los endpoints legados se mantienen por compatibilidad pero se recomienda migrar a v1.

---

## Matriz de Resumen

| ID | Método | Ruta | Nivel | Headers requeridos |
|----|--------|------|-------|-------------------|
| EP-001 | GET | `/api/v1/public/health` | public | — |
| EP-002 | GET | `/api/v1/protected/me` | protected | Authorization |
| EP-003 | GET | `/api/v1/protected/tenants` | protected | Authorization |
| EP-004 | GET | `/api/v1/protected/tenants/:id` | protected | Authorization |
| EP-005 | GET | `/api/v1/protected/tenants/:id/users` | protected | Authorization |
| EP-006 | GET | `/api/v1/private/reservas` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-007 | POST | `/api/v1/private/reservas` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-008 | GET | `/api/v1/private/reservas/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-009 | PATCH | `/api/v1/private/reservas/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-010 | DELETE | `/api/v1/private/reservas/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-011 | GET | `/api/v1/private/habitaciones` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-012 | POST | `/api/v1/private/habitaciones` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-013 | GET | `/api/v1/private/habitaciones/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-014 | PATCH | `/api/v1/private/habitaciones/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-015 | DELETE | `/api/v1/private/habitaciones/:id` | protected (tenant) | Authorization, X-Tenant-RUT |
| EP-016 | GET | `/api/v2/public/health` | public | — |

