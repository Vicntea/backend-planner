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

const updateHabitacionSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  tipo: z.string().max(50).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  capacidad: z.number().int().min(1).optional(),
  precioNoche: z.number().nonnegative().optional(),
  moneda: z.string().length(3).optional(),
  estado: z.string().optional(),
});

export const runtime = "nodejs";

function extractHabitacionId(url: URL): string | null {
  const match = url.pathname.match(/\/habitaciones\/([^/]+)$/);
  return match ? match[1] : null;
}

async function handleGet(request: Request, context: ProtectedHandlerContext, habitacionId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;

  const habitacion = await prisma.habitacion.findUnique({
    where: { id: habitacionId },
  });

  if (!habitacion) {
    throw new NotFoundError("Habitación no encontrada");
  }

  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");
  return successResponse(habitacion, { headers });
}

async function handlePatch(request: Request, context: ProtectedHandlerContext, habitacionId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;
  const body = await request.json();

  const parsed = updateHabitacionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Datos de habitación inválidos", parsed.error.issues);
  }

  const existing = await prisma.habitacion.findUnique({
    where: { id: habitacionId },
  });

  if (!existing) {
    throw new NotFoundError("Habitación no encontrada");
  }

  if (parsed.data.nombre && parsed.data.nombre !== existing.nombre) {
    const dup = await prisma.habitacion.findUnique({
      where: { nombre: parsed.data.nombre },
    });
    if (dup) {
      throw new ConflictError("Ya existe una habitación con ese nombre");
    }
  }

  const habitacion = await prisma.habitacion.update({
    where: { id: habitacionId },
    data: {
      nombre: parsed.data.nombre ?? existing.nombre,
      tipo: parsed.data.tipo !== undefined ? parsed.data.tipo : existing.tipo,
      descripcion: parsed.data.descripcion !== undefined ? parsed.data.descripcion : existing.descripcion,
      capacidad: parsed.data.capacidad ?? existing.capacidad,
      precioNoche: parsed.data.precioNoche ?? existing.precioNoche,
      moneda: parsed.data.moneda ?? existing.moneda,
      estado: parsed.data.estado ?? existing.estado,
    },
  });

  const headers = corsHeaders(request);
  return successResponse(habitacion, { headers });
}

async function handleDelete(request: Request, context: ProtectedHandlerContext, habitacionId: string): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;

  const existing = await prisma.habitacion.findUnique({
    where: { id: habitacionId },
    include: { reservas: true },
  });

  if (!existing) {
    throw new NotFoundError("Habitación no encontrada");
  }

  if (existing.reservas && existing.reservas.length > 0) {
    throw new ConflictError("No se puede eliminar una habitación que tiene reservas asociadas");
  }

  await prisma.habitacion.delete({
    where: { id: habitacionId },
  });

  const headers = corsHeaders(request);
  return successResponse({ deleted: true, id: habitacionId }, { headers });
}

export async function GET(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const habitacionId = extractHabitacionId(new URL(req.url));
    if (!habitacionId) {
      throw new ValidationError("ID de habitación requerido");
    }
    return handleGet(req, ctx, habitacionId);
  }, { withTenant: true })(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const habitacionId = extractHabitacionId(new URL(req.url));
    if (!habitacionId) {
      throw new ValidationError("ID de habitación requerido");
    }
    return handlePatch(req, ctx, habitacionId);
  }, { withTenant: true })(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return withProtected((req, ctx) => {
    const habitacionId = extractHabitacionId(new URL(req.url));
    if (!habitacionId) {
      throw new ValidationError("ID de habitación requerido");
    }
    return handleDelete(req, ctx, habitacionId);
  }, { withTenant: true })(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return executeRoute(request, async () => new Response(null, { status: 204 }));
}
