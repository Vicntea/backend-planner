import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

nextEnv.loadEnvConfig(process.cwd());

const directUrl = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL or DIRECT_DATABASE_URL is required for Prisma CLI");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});
