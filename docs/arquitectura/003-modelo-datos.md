# Modelo de Datos

## Schema `public` (Catálogo)

| Tabla | Descripción |
|-------|-------------|
| `tenants` | Catálogo de tenants (id, rut, nombre, slug, schema_name, activo, etc.) |
| `tenant_config` | Configuración comercial por tenant |
| `tenant_members` | Relación usuario ↔ tenant con rol |
| `tenant_schema_versions` | Historial de versiones de schema aplicadas |

## Schema `client_<rut>` (Datos del Tenant)

Todas las tablas siguientes se replican en el schema de cada tenant con idéntica estructura:

| Tabla | Descripción |
|-------|-------------|
| `voucher_config` | Configuración de vouchers (logo, diseño, campos visibles) |
| `clientes` | Clientes del hotel/hostal (nombre, apellido, email, RUT cifrado) |
| `habitaciones` | Habitaciones disponibles (nombre, tipo, capacidad, precio, estado) |
| `vouchers` | Vouchers generados (base64) |
| `reservas` | Reservas principales (fechas, estado, totales, cliente, habitación) |
| `reserva_huespedes` | Huéspedes asociados a una reserva |

## Relaciones clave
- `Reserva` → `Habitacion` (many-to-one)
- `Reserva` → `Cliente` (many-to-one)
- `Reserva` → `Voucher` (many-to-one, opcional)
- `Reserva` → `ReservaHuesped` (one-to-many, cascade delete)
- `Tenant` → `TenantMember` (one-to-many)
- `Tenant` → `TenantConfig` (one-to-one)

## Índices y restricciones
- `reservas`: índice en `habitacionId`, `clienteId`, `checkIn/checkOut`, `estado`.
- `reservas`: constraint `EXCLUDE USING GIST` para evitar solapamiento de fechas en estados `pendiente`/`confirmada`.
- `clientes`: índice en `rut_lookup` (búsqueda exacta de RUT cifrado).