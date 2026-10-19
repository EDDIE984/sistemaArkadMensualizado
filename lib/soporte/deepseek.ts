import "server-only";

import OpenAI from "openai";

/** DeepSeek expone una API compatible con OpenAI, así que reutilizamos su SDK. */
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export class DeepSeekConfigError extends Error {}

let _client: OpenAI | null = null;
export function deepseek(): OpenAI {
  if (!_client) {
    if (!process.env.DEEPSEEK_API_KEY) throw new DeepSeekConfigError("Falta DEEPSEEK_API_KEY en el entorno del servidor.");
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      timeout: 30_000,
      maxRetries: 1,
    });
  }
  return _client;
}
