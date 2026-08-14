import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPrivateValue(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en el entorno del servidor.");
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export function hashPassword(password: string) {
  return hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}
