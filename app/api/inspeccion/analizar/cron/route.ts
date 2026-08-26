import { sweepInspeccionesPendientes } from "@/lib/inspeccion/analisis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await sweepInspeccionesPendientes({ maxInspecciones: 3, maxFotos: 4 });
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("[inspeccion] cron de análisis falló", error);
    return Response.json({ error: "Fallo el barrido de análisis." }, { status: 500 });
  }
}

// Vercel Cron dispara GET; se acepta POST para gatillado manual.
export const GET = run;
export const POST = run;
