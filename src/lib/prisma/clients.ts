import "server-only";

import { PrismaClient } from "@/generated/prisma/client";

import { getRlsDatabaseUrl } from "@/config/env";

const TENANT_SCHEMA_REGEX = /^client_[0-9]{7,8}$/;

export type TenantPrisma = ReturnType<typeof makeTenantPrisma>;

const prismaClients = new Map<string, PrismaClient>();

function buildTenantUrl(schemaName: string): string {
  const base = getRlsDatabaseUrl();
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}search_path=${schemaName},public`;
}

function makeTenantPrisma(schemaName: string): PrismaClient {
  if (!TENANT_SCHEMA_REGEX.test(schemaName)) {
    throw new Error(`Schema de tenant inválido: ${schemaName}`);
  }

  const existing = prismaClients.get(schemaName);
  if (existing) {
    return existing;
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: buildTenantUrl(schemaName),
      },
    } as any,
  } as any);

  prismaClients.set(schemaName, client);
  return client;
}

let publicClient: PrismaClient | null = null;

export function getPublicPrisma(): PrismaClient {
  if (!publicClient) {
    const base = getRlsDatabaseUrl();
    const separator = base.includes("?") ? "&" : "?";
    publicClient = new PrismaClient({
      datasources: {
        db: {
          url: `${base}${separator}search_path=public`,
        },
      } as any,
    } as any);
  }
  return publicClient;
}

export function getTenantPrisma(schemaName: string): PrismaClient {
  return makeTenantPrisma(schemaName);
}

export async function disconnectTenantPrisma(schemaName: string): Promise<void> {
  const client = prismaClients.get(schemaName);
  if (client) {
    await client.$disconnect();
    prismaClients.delete(schemaName);
  }
}

export async function disconnectAll(): Promise<void> {
  await Promise.all([...prismaClients.values()].map((c) => c.$disconnect()));
  prismaClients.clear();
  if (publicClient) {
    await publicClient.$disconnect();
    publicClient = null;
  }
}