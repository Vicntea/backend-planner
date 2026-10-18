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

const listHabitacionesSchema = z.object({
  estado: z.string().optional(),
  tipo: z.string().optional(),
  page: z.string().regex(/^\d+$/).default("1"),
  pageSize: z.string().regex(/^\d+$/).default("20"),
});

const createHabitacionSchema = z.object({
  nombre: z.string().min(1).max(100),
  tipo: z.string().max(50).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  capacidad: z.number().int().min(1).default(1),
  precioNoche: z.number().nonnegative().default(0),
  moneda: z.string().length(3).default("CLP"),
  estado: z.string().default("activa"),
});

export const runtime = "nodejs";

async function handleList(request: Request, context: ProtectedHandlerContext): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;
  const url = new URL(request.url);
  const parsed = listHabitacionesSchema.safeParse({
    estado: url.searchParams.get("estado") || undefined,
    tipo: url.searchParams.get("tipo") || undefined,
    page: url.searchParams.get("page") || "1",
    pageSize: url.searchParams.get("pageSize") || "20",
  });

  if (!parsed.success) {
    throw new ValidationError("Parámetros de consulta inválidos", parsed.error.issues);
  }

  const { estado, tipo, page, pageSize } = parsed.data;
  const skip = (Number(page) - 1) * Number(pageSize);

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;

  const [habitaciones, total] = await prisma.$transaction([
    prisma.habitacion.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { nombre: "asc" },
    }),
    prisma.habitacion.count({ where }),
  ]);

  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");

  return successResponse(
    {
      data: habitaciones,
      meta: { total, page: Number(page), pageSize: Number(pageSize) },
    },
    { headers }
  );
}

async function handleCreate(request: Request, context: ProtectedHandlerContext): Promise<Response> {
  if (!context.tenant || !context.prisma) {
    throw new ValidationError("X-Tenant-RUT es requerido");
  }
  const { prisma } = context;
  const body = await request.json();

  const parsed = createHabitacionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Datos de habitación inválidos", parsed.error.issues);
  }

  const { nombre, tipo, descripcion, capacidad, precioNoche, moneda, estado } = parsed.data;

  const existing = await prisma.habitacion.findUnique({
    where: { nombre },
  });

  if (existing) {
    throw new ConflictError("Ya existe una habitación con ese nombre");
  }

  const habitacion = await prisma.habitacion.create({
    data: {
      nombre,
      tipo: tipo ?? null,
      descripcion: descripcion ?? null,
      capacidad,
      precioNoche,
      moneda,
      estado,
    },
  });

  const headers = corsHeaders(request);
  return successResponse(habitacion, { status: 201, headers });
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
