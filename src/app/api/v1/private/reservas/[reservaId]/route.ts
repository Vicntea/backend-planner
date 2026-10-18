import { z } from "zod";

import { withProtected } from "@/lib/http/middleware";
import { corsHeaders, successResponse } from "@/lib/http/response";
import { executeRoute } from "@/lib/http/execute-route";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/api-error";
import type { ProtectedHandlerContext } from "@/lib/http/middleware";

const RESERVA_ESTADOS_SOLAPAMIENTO = ["pendiente", "confirmada"];

export const runtime = "nodejs";

async function handleGet(request: Request, context: ProtectedHandlerContext, reservaId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;
  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { habitacion: true, cliente: true, voucher: true, huespedes: true },
  });
  if (!reserva) {
    throw new NotFoundError("Reserva no encontrada");
  }
  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");
  return successResponse(reserva, { headers });
}

async function handlePatch(request: Request, context: ProtectedHandlerContext, reservaId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;
  const body = await request.json();

  const updateReservaSchema = z.object({
    habitacionId: z.string().uuid().optional(),
    clienteId: z.string().uuid().optional(),
    voucherId: z.string().uuid().optional().nullable(),
    checkIn: z.string().date().optional(),
    checkOut: z.string().date().optional(),
    cantidadHuespedes: z.number().int().min(1).optional(),
    precioNoche: z.number().nonnegative().optional(),
    descuento: z.number().nonnegative().optional(),
    impuestos: z.number().nonnegative().optional(),
    moneda: z.string().length(3).optional(),
    estado: z.string().optional(),
    notas: z.string().optional().nullable(),
    huespedes: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          nombre: z.string().min(1).max(100),
          apellido: z.string().max(100).optional().nullable(),
          edad: z.number().int().min(0).optional().nullable(),
        })
      )
      .optional(),
  });

  const parsed = updateReservaSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Datos de reserva inválidos", parsed.error.issues);
  }

  const existing = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { huespedes: true },
  });

  if (!existing) {
    throw new NotFoundError("Reserva no encontrada");
  }

  const checkIn = parsed.data.checkIn ? new Date(parsed.data.checkIn) : existing.checkIn;
  const checkOut = parsed.data.checkOut ? new Date(parsed.data.checkOut) : existing.checkOut;

  if (checkOut <= checkIn) {
    throw new ValidationError("La fecha de check-out debe ser posterior al check-in");
  }

  const habitacionId = parsed.data.habitacionId ?? existing.habitacionId;

  const solapamiento = await prisma.reserva.findFirst({
    where: {
      id: { not: reservaId },
      habitacionId,
      estado: { in: RESERVA_ESTADOS_SOLAPAMIENTO },
      checkIn: { lte: checkOut },
      checkOut: { gte: checkIn },
    },
  });

  if (solapamiento) {
    throw new ConflictError(
      "La habitación ya tiene una reserva en esas fechas (pendiente o confirmada)"
    );
  }

  const noches = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const precioNocheNum = typeof parsed.data.precioNoche === "number" ? parsed.data.precioNoche : Number(existing.precioNoche);
  const descuentoNum = typeof parsed.data.descuento === "number" ? parsed.data.descuento : Number(existing.descuento);
  const impuestosNum = typeof parsed.data.impuestos === "number" ? parsed.data.impuestos : Number(existing.impuestos);
  const subtotal = precioNocheNum * noches;
  const total = subtotal - descuentoNum + impuestosNum;

  const reserva = await prisma.reserva.update({
    where: { id: reservaId },
    data: {
      habitacionId,
      clienteId: parsed.data.clienteId ?? existing.clienteId,
      voucherId: parsed.data.voucherId !== undefined ? parsed.data.voucherId : existing.voucherId,
      checkIn,
      checkOut,
      cantidadHuespedes: parsed.data.cantidadHuespedes ?? existing.cantidadHuespedes,
      precioNoche: precioNocheNum,
      subtotal,
      descuento: descuentoNum,
      impuestos: impuestosNum,
      total,
      moneda: parsed.data.moneda ?? existing.moneda,
      estado: parsed.data.estado ?? existing.estado,
      notas: parsed.data.notas !== undefined ? parsed.data.notas : existing.notas,
      huespedes: parsed.data.huespedes
        ? {
            deleteMany: {},
            create: parsed.data.huespedes.map((h) => ({
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
  return successResponse(reserva, { headers });
}

async function handleDelete(request: Request, context: ProtectedHandlerContext, reservaId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;

  const existing = await prisma.reserva.findUnique({
    where: { id: reservaId },
  });

  if (!existing) {
    throw new NotFoundError("Reserva no encontrada");
  }

  await prisma.reserva.delete({
    where: { id: reservaId },
  });

  const headers = corsHeaders(request);
  return successResponse({ deleted: true, id: reservaId }, { headers });
}

function extractReservaId(url: URL): string | null {
  const match = url.pathname.match(/\/reservas\/([^/]+)$/);
  return match ? match[1] : null;
}

export async function GET(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const reservaId = extractReservaId(new URL(req.url));
    if (!reservaId) {
      throw new ValidationError("ID de reserva requerido");
    }
    return handleGet(req, ctx, reservaId);
  }, { withTenant: true })(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const reservaId = extractReservaId(new URL(req.url));
    if (!reservaId) {
      throw new ValidationError("ID de reserva requerido");
    }
    return handlePatch(req, ctx, reservaId);
  }, { withTenant: true })(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const reservaId = extractReservaId(new URL(req.url));
    if (!reservaId) {
      throw new ValidationError("ID de reserva requerido");
    }
    return handleDelete(req, ctx, reservaId);
  }, { withTenant: true })(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return executeRoute(request, async () => new Response(null, { status: 204 }));
}
