# Endpoints v1 — Público

## Base URL
`GET /api/v1/public/...`

## Autenticación
No requerida.

## Tenant
No se requiere `X-Tenant-RUT`. Se usa schema `public`.

## Endpoints

### GET /api/v1/public/health
Health check del servicio.

**Respuesta (200):**
```json
{
  "status": "ok"
}
```

**Códigos de respuesta:**
- `200`: Servicio operativo.

## Ejemplo de llamada
```bash
curl -X GET http://localhost:3000/api/v1/public/health
```