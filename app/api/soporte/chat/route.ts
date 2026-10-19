import type OpenAI from "openai";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { DEEPSEEK_MODEL, DeepSeekConfigError, deepseek } from "@/lib/soporte/deepseek";
import { buildSystemPrompt } from "@/lib/soporte/prompt";
import type { SupportRole } from "@/lib/soporte/conocimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(40),
});

// Límite simple por sesión (en memoria): 20 mensajes cada 10 minutos.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/**
 * Chat del asistente de soporte. No consulta la base de datos: el rol sale de la
 * sesión y el modelo solo recibe la guía estática del rol y la conversación.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "No autenticado." }, 401);
  let role: SupportRole;
  if (session.actorType === "USUARIO" && session.profileCode === "ADMIN_ASEGURADORA") role = "insurer";
  else if (session.actorType === "USUARIO" && session.profileCode === "USUARIO_CANAL") role = "channel";
  else return json({ error: "No autorizado." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Cuerpo de la solicitud inválido." }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos." }, 422);
  const history = parsed.data.messages.slice(-10);
  if (history.at(-1)?.role !== "user") return json({ error: "Datos inválidos." }, 422);

  if (rateLimited(session.id)) return json({ error: "Has enviado muchas consultas seguidas. Espera unos minutos e inténtalo de nuevo." }, 429);

  try {
    const completion = await deepseek().chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0.3,
      max_tokens: 600,
      messages: [{ role: "system", content: buildSystemPrompt(role) }, ...history],
      // deepseek-flash razona por defecto; para soporte basta la respuesta directa (más rápida y barata).
      thinking: { type: "disabled" },
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) return json({ error: "El asistente no devolvió respuesta." }, 502);
    return json({ reply }, 200);
  } catch (error) {
    if (error instanceof DeepSeekConfigError) console.error("[soporte] DEEPSEEK_API_KEY no configurada");
    else console.error("[soporte] error al consultar DeepSeek", error);
    return json({ error: "El asistente no está disponible en este momento." }, 502);
  }
}
