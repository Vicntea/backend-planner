import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { withProtected } from "@/lib/http/middleware";
import { corsHeaders, successResponse } from "@/lib/http/response";
import { executeRoute } from "@/lib/http/execute-route";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/api-error";
import type { ProtectedHandlerContext } from "@/lib/http/middleware";

const listReservasSchema = z.object({
  habitacionId: z.string().uuid().optional(),
  estado: z.string().optional(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  mes: z.string().regex(/^\d{1,2}$/).optional(),
  anio: z.string().regex(/^\d{4}$/).optional(),
  page: z.string().regex(/^\d+$/).default("1"),
  pageSize: z.string().regex(/^\d+$/).default("20"),
});

const createReservaSchema = z.object({
  habitacionId: z.string().uuid(),
  clienteId: z.string().uuid(),
  voucherId: z.string().uuid().optional().nullable(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  cantidadHuespedes: z.number().int().min(1).default(1),
  precioNoche: z.number().nonnegative().default(0),
  descuento: z.number().nonnegative().default(0),
  impuestos: z.number().nonnegative().default(0),
  moneda: z.string().length(3).default("CLP"),
  notas: z.string().optional().nullable(),
  huespedes: z
    .array(
      z.object({
        nombre: z.string().min(1).max(100),
        apellido: z.string().max(100).optional().nullable(),
        edad: z.number().int().min(0).optional().nullable(),
      })
    )
    .optional(),
});

const RESERVA_ESTADOS_SOLAPAMIENTO = ["pendiente", "confirmada"];

export const runtime = "nodejs";

async function handleList(request: Request, context: ProtectedHandlerContext): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma, tenant } = context;
  const url = new URL(request.url);
  const parsed = listReservasSchema.safeParse({
    habitacionId: url.searchParams.get("habitacionId") || undefined,
    estado: url.searchParams.get("estado") || undefined,
    checkIn: url.searchParams.get("checkIn") || undefined,
    checkOut: url.searchParams.get("checkOut") || undefined,
    page: url.searchParams.get("page") || "1",
    pageSize: url.searchParams.get("pageSize") || "20",
  });

  if (!parsed.success) {
    throw new ValidationError("Parámetros de consulta inválidos", parsed.error.issues);
  }

  const { habitacionId, estado, checkIn, checkOut, mes, anio, page, pageSize } = parsed.data;
  const skip = (Number(page) - 1) * Number(pageSize);

  const where: Prisma.ReservaWhereInput = {};
  if (habitacionId) where.habitacionId = habitacionId;
  if (estado) where.estado = estado;

  // Filtro por mes y año
  if (mes && anio) {
    const m = Number(mes);
    const a = Number(anio);
    const start = new Date(a, m - 1, 1);
    const end = new Date(a, m, 1); // primer día del mes siguiente
    where.checkIn = {
      gte: start,
      lt: end,
    };
  } else if (checkIn || checkOut) {
    where.checkIn = {};
    if (checkIn) where.checkIn.gte = new Date(checkIn);
    if (checkOut) where.checkIn.lte = new Date(checkOut);
  }

  const [reservas, total] = await prisma.$transaction([
    prisma.reserva.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { createdAt: "desc" },
      include: {
        habitacion: true,
        cliente: true,
        huespedes: true,
      },
    }),
    prisma.reserva.count({ where }),
  ]);

  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");

  return successResponse(
    {
      data: reservas,
      meta: { total, page: Number(page), pageSize: Number(pageSize) },
    },
    { headers }
  );
}

async function handleCreate(request: Request, context: ProtectedHandlerContext): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma, tenant } = context;
  const body = await request.json();

  const parsed = createReservaSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Datos de reserva inválidos", parsed.error.issues);
  }

  const { habitacionId, clienteId, voucherId, checkIn, checkOut, cantidadHuespedes, precioNoche, descuento, impuestos, moneda, notas, huespedes } = parsed.data;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkOutDate <= checkInDate) {
    throw new ValidationError("La fecha de check-out debe ser posterior al check-in");
  }

  // Validar solapamiento antes de insertar
  const solapamiento = await prisma.reserva.findFirst({
    where: {
      habitacionId,
      estado: { in: RESERVA_ESTADOS_SOLAPAMIENTO },
      checkIn: { lte: checkOutDate },
      checkOut: { gte: checkInDate },
    },
  });

  if (solapamiento) {
    throw new ConflictError(
      "La habitación ya tiene una reserva en esas fechas (pendiente o confirmada)"
    );
  }

  const noches = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
  const subtotal = precioNoche * noches;
  const total = subtotal - descuento + impuestos;

  const codigo = `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const reserva = await prisma.reserva.create({
    data: {
      habitacionId,
      clienteId,
      voucherId: voucherId ?? null,
      codigo,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      estado: "pendiente",
      cantidadHuespedes,
      precioNoche: precioNoche,
      subtotal,
      descuento,
      impuestos,
      total,
      moneda,
      notas: notas ?? null,
      huespedes: huespedes
        ? {
            create: huespedes.map((h) => ({
              nombre: h.nombre,
              apellido: h.apellido ?? null,
              edad: h.edad ?? null,
            })),
          }
        : undefined,
    },
    include: {
      habitacion: true,
      cliente: true,
      huespedes: true,
    },
  });

  const headers = corsHeaders(request);
  return successResponse(
    {
      ...reserva,
      noches,
      precioPorNoche: precioNoche,
    },
    { status: 201, headers }
  );
}

export async function GET(request: Request): Promise<Response> {
  return withProtected((req, ctx) => handleList(req, ctx), { withTenant: true })(request);
}

export async function POST(request: Request): Promise<Response> {
  return withProtected((req, ctx) => handleCreate(req, ctx), { withTenant: true })(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return executeRoute(request, async () => new Response(null, { status: 204 }));
}