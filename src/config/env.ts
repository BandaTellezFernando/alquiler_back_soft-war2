import * as dotenv from "dotenv";
dotenv.config();

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "front-servineo-nxn4.vercel.app",
  MONGODB_URI: required("MONGODB_URI"),
  MONGODB_USERS_DB: process.env.MONGODB_USERS_DB?.trim() || undefined,
} as const;