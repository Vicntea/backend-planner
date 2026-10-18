# Endpoints v1 — Reservas (Planner)

## Base URL
`/api/v1/private/reservas`

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

## GET /api/v1/private/reservas

Listar reservas del tenant con filtros opcionales.

### Query params
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `habitacionId` | UUID (opcional) | Filtrar por habitación |
| `estado` | string (opcional) | Filtrar por estado (pendiente, confirmada, cancelada, etc.) |
| `checkIn` | datetime (opcional) | Rango de fecha de entrada |
| `checkOut` | datetime (opcional) | Rango de fecha de salida |
| `mes` | number 1-12 (opcional) | Mes para filtrar (requiere `anio`) |
| `anio` | number YYYY (opcional) | Año para filtrar (requiere `mes`) |
| `page` | number (opcional, default 1) | Página |
| `pageSize` | number (opcional, default 20) | Tamaño de página |

### Ejemplo: reservas de octubre 2026
```
GET /api/v1/private/reservas?mes=10&anio=2026
```

### Respuesta (200)
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

---

## POST /api/v1/private/reservas

Crear una nueva reserva.

### Body
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

### Validaciones
1. `checkOut` debe ser posterior a `checkIn`.
2. **Solapamiento**: no puede existir otra reserva en la misma habitación con estado `pendiente` o `confirmada` y fechas que se solapen. Si hay conflicto → `409 CONFLICT`.
3. Campos numéricos no pueden ser negativos.

### Respuesta (201)
Incluye campos `noches` (cantidad de días) y `precioPorNoche` además de todos los campos del modelo.

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "codigo": "RES-ABC12-XYZ78",
    "noches": 2,
    "precioPorNoche": 50000,
    ...
  }
}
```

### Errores
- `400 VALIDATION_ERROR`: Datos inválidos, fechas incorrectas o tenant sin resolver.
- `401 UNAUTHORIZED`: Token inválido o expirado.
- `409 CONFLICT`: La habitación ya tiene una reserva en esas fechas.

---

## GET /api/v1/private/reservas/:id

Obtener una reserva por ID con sus relaciones.

### Respuesta (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    ...
    "noches": 2,
    "precioPorNoche": 50000,
    "habitacion": { ... },
    "cliente": { ... },
    "voucher": { ... },
    "huespedes": [ { ... } ]
  }
}
```

### Errores
- `404 NOT_FOUND`: Reserva no encontrada.

---

## PATCH /api/v1/private/reservas/:id

Modificar una reserva existente.

### Body (todos los campos opcionales)
```json
{
  "habitacionId": "uuid",
  "checkIn": "2026-10-21",
  "checkOut": "2026-10-23",
  "estado": "confirmada",
  "huespedes": [
    { "nombre": "Juan", "apellido": "Pérez", "edad": 30 }
  ]
}
```

### Validaciones
1. Si se modifican fechas o habitación, se re-valida solapamiento excluyendo la reserva actual.
2. `checkOut` debe ser posterior a `checkIn`.
3. Se recalculan `subtotal`, `descuento`, `impuestos`, `total` automáticamente.

### Errores
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT` (solapamiento)

---

## DELETE /api/v1/private/reservas/:id

Eliminar una reserva físicamente (cascade elimina huéspedes asociados).

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
- `404 NOT_FOUND`: Reserva no encontrada.

---

## Ejemplo completo con cURL

```bash
# Crear reserva
curl -X POST http://localhost:3000/api/v1/private/reservas \
  -H "Authorization: Bearer <JWT>" \
  -H "X-Tenant-RUT: 12345678-9" \
  -H "Content-Type: application/json" \
  -d '{
    "habitacionId": "uuid-habitacion",
    "clienteId": "uuid-cliente",
    "checkIn": "2026-10-20",
    "checkOut": "2026-10-22",
    "cantidadHuespedes": 2,
    "precioNoche": 50000
  }'

# Listar reservas de un mes
curl -X GET "http://localhost:3000/api/v1/private/reservas?mes=10&anio=2026" \
  -H "Authorization: Bearer <JWT>" \
  -H "X-Tenant-RUT: 12345678-9"
```