import fs from "node:fs";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Client } = pg;
loadEnvConfig(process.cwd());

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const TENANT_RUT = required("TENANT_RUT");
const DIRECT_URL = required("DIRECT_URL");

// Derivar schema del RUT
const match = /^(\d{7,8})-([0-9K])$/i.exec(TENANT_RUT);
if (!match) throw new Error("TENANT_RUT must use 12345678-9 format");
const schemaName = `client_${match[1]}`;

const database = new Client({ connectionString: DIRECT_URL, max: 1 });

try {
  await database.connect();
  await database.query("begin");

  // Verificar que el schema exista
  const schemaExists = await database.query(
    `select 1 from information_schema.schemas where schema_name = $1`,
    [schemaName]
  );
  if (!schemaExists.rows.length) {
    throw new Error(`Schema ${schemaName} no existe. Provisione el tenant primero.`);
  }

  const escapedSchema = database.escapeIdentifier(schemaName);

  // Insertar habitaciones template
  const habitaciones = [
    { nombre: "Habitación 101", tipo: "estándar", descripcion: "Habitación individual con vista al jardín", capacidad: 1, precioNoche: 45000, moneda: "CLP", estado: "activa" },
    { nombre: "Habitación 102", tipo: "estándar", descripcion: "Habitación doble con vista al jardín", capacidad: 2, precioNoche: 65000, moneda: "CLP", estado: "activa" },
    { nombre: "Habitación 201", tipo: "ejecutiva", descripcion: "Habitación ejecutiva con escritorio y wifi rápido", capacidad: 2, precioNoche: 85000, moneda: "CLP", estado: "activa" },
    { nombre: "Suite Presidencial", tipo: "suite", descripcion: "Suite de lujo con jacuzzi y sala de estar", capacidad: 4, precioNoche: 180000, moneda: "CLP", estado: "activa" },
    { nombre: "Habitación 301", tipo: "familiar", descripcion: "Habitación familiar para hasta 4 personas", capacidad: 4, precioNoche: 110000, moneda: "CLP", estado: "activa" },
  ];

  for (const h of habitaciones) {
    await database.query(
      `insert into ${escapedSchema}.habitaciones (nombre, tipo, descripcion, capacidad, precio_noche, moneda, estado)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (nombre) do nothing`,
      [h.nombre, h.tipo, h.descripcion, h.capacidad, h.precioNoche, h.moneda, h.estado]
    );
  }

  // Insertar clientes template
  const clientes = [
    { nombre: "Juan", apellido: "Pérez", email: "juan.perez@email.com", telefono: "+56912345678" },
    { nombre: "María", apellido: "García", email: "maria.garcia@email.com", telefono: "+56998765432" },
    { nombre: "Carlos", apellido: "Ruiz", email: "carlos.ruiz@email.com", telefono: "+56955551234" },
    { nombre: "Ana", apellido: "López", email: "ana.lopez@email.com", telefono: "+56977778888" },
  ];

  for (const c of clientes) {
    await database.query(
      `insert into ${escapedSchema}.clientes (nombre, apellido, email, telefono)
       values ($1, $2, $3, $4)`,
      [c.nombre, c.apellido, c.email, c.telefono]
    );
  }

  await database.query("commit");
  console.log(JSON.stringify({
    seeded: true,
    schema: schemaName,
    habitaciones: habitaciones.length,
    clientes: clientes.length,
  }, null, 2));
} catch (error) {
  await database.query("rollback").catch(() => undefined);
  console.error(JSON.stringify({
    seeded: false,
    message: error instanceof Error ? error.message : "Unknown error",
  }, null, 2));
  process.exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
}