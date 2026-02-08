import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Force override system env with local .env values
dotenv.config({ override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
