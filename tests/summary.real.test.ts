/*
 * Verifica el alcance real del Resumen contra la base configurada.
 * Ejecutar: npx tsx --tsconfig tests/tsconfig.json --env-file=.env.local tests/summary.real.test.ts
 */
import assert from "node:assert/strict";
import { getDbPool } from "@/lib/db/pool";
import { getSummary, type SummaryKpis } from "@/lib/channel/summary";
import { getCollections } from "@/lib/insurer/collections";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";

const db = getDbPool();
const period = { from: "2020-01-01", to: "2035-12-31" };
const expiry = { from: "2020-01-01", to: "2035-12-31" };
let passed = 0;
let temporaryInsurerId: string | null = null;

async function step(name: string, test: () => Promise<void>) {
  await test();
  passed++;
  console.log(`  ✓ ${name}`);
}

const cents = (value: number) => Math.round(value * 100);

function sameKpis(actual: SummaryKpis, expected: SummaryKpis) {
  assert.deepEqual(actual, expected);
}

async function main() {
  const insurer = (await db.query<{ insurer_id: string }>(
    `select p.aseguradora_id as insurer_id
     from producto p join canal ch on ch.id = p.canal_id
     where p.activo and ch.activo
     group by p.aseguradora_id having count(distinct ch.id) >= 1
     order by count(distinct ch.id) desc limit 1`,
  )).rows[0];
  assert.ok(insurer, "Falta una aseguradora con al menos un canal y producto activo");
  const channels = (await db.query<{ id: string }>(
    `select distinct ch.id from canal ch join producto p on p.canal_id = ch.id
     where ch.aseguradora_id = $1 and ch.activo and p.activo order by ch.id`,
    [insurer.insurer_id],
  )).rows;
  assert.ok(channels.length, "La aseguradora elegida no tiene canales activos");

  await step("el alcance aseguradora + canal coincide con el alcance del canal", async () => {
    const channelId = channels[0].id;
    const [insurerScope, channelScope] = await Promise.all([
      getSummary({ insurerId: insurer.insurer_id, channelId, productIds: [] }, period, expiry),
      getSummary({ insurerId: null, channelId, productIds: [] }, period, expiry),
    ]);
    sameKpis(insurerScope.current, channelScope.current);
    sameKpis(insurerScope.previous, channelScope.previous);
  });

  await step("todos los canales suman sus KPI de producción", async () => {
    const all = await getSummary({ insurerId: insurer.insurer_id, channelId: null, productIds: [] }, period, expiry);
    const each = await Promise.all(channels.map((channel) => getSummary({ insurerId: insurer.insurer_id, channelId: channel.id, productIds: [] }, period, expiry)));
    const sum = each.reduce<SummaryKpis>((total, summary) => ({
      vehicles: total.vehicles + summary.current.vehicles,
      clients: total.clients + summary.current.clients,
      commission: total.commission + summary.current.commission,
      premium: total.premium + summary.current.premium,
    }), { vehicles: 0, clients: 0, commission: 0, premium: 0 });
    // Clientes pueden repetirse entre canales; los KPI sumables son vehículos y dinero.
    assert.equal(all.current.vehicles, sum.vehicles);
    assert.equal(cents(all.current.commission), cents(sum.commission));
    assert.equal(cents(all.current.premium), cents(sum.premium));
  });

  await step("la cobranza del alcance devuelve sus cuatro tramos de mora", async () => {
    const collections = await getCollections({ insurerId: insurer.insurer_id, channelId: channels[0].id, productIds: [] }, period);
    assert.equal(collections.aging.length, 4);
    assert.ok(Number.isFinite(collections.kpis.collected));
    assert.ok(Number.isFinite(collections.kpis.receivable));
  });

  await step("un producto de otra aseguradora se descarta antes de construir el alcance", async () => {
    const foreign = await foreignProduct(insurer.insurer_id);
    const [clean, attempted] = await Promise.all([
      resolveInsurerSummaryScope(insurer.insurer_id, {}),
      resolveInsurerSummaryScope(insurer.insurer_id, { productos: [foreign.id] }),
    ]);
    assert.deepEqual(attempted.scope, clean.scope);
    const [expected, actual] = await Promise.all([
      getSummary(clean.scope, period, expiry),
      getSummary(attempted.scope, period, expiry),
    ]);
    sameKpis(actual.current, expected.current);
  });

  console.log(`\nOK: ${passed} pruebas de alcance del Resumen pasaron sobre la base real.`);
}

async function foreignProduct(insurerId: string) {
  const existing = (await db.query<{ id: string }>(`select id from producto where aseguradora_id <> $1 and activo limit 1`, [insurerId])).rows[0];
  if (existing) return existing;
  const ramo = (await db.query<{ id: string }>(`select id from ramo_base where activo limit 1`)).rows[0];
  assert.ok(ramo, "Falta un ramo base activo para preparar la prueba de aislamiento");
  const tag = `TEST-RESUMEN-${Date.now().toString(36).toUpperCase()}`;
  const insurer = (await db.query<{ id: string }>(
    `insert into aseguradora (nombre_comercial, razon_social, ruc) values ($1, $2, $3) returning id`,
    [tag, tag, `99${Date.now().toString().slice(-11)}`],
  )).rows[0];
  temporaryInsurerId = insurer.id;
  const channel = (await db.query<{ id: string }>(`insert into canal (aseguradora_id, nombre) values ($1, $2) returning id`, [insurer.id, tag])).rows[0];
  const insurerRamo = (await db.query<{ id: string }>(`insert into aseguradora_ramo (aseguradora_id, ramo_base_id) values ($1, $2) returning id`, [insurer.id, ramo.id])).rows[0];
  return (await db.query<{ id: string }>(
    `insert into producto (aseguradora_id, canal_id, aseguradora_ramo_id, nombre) values ($1, $2, $3, $4) returning id`,
    [insurer.id, channel.id, insurerRamo.id, tag],
  )).rows[0];
}

main()
  .catch((error) => { console.error("\nFALLÓ:", error); process.exitCode = 1; })
  .finally(async () => {
    try { if (temporaryInsurerId) await db.query(`delete from aseguradora where id = $1`, [temporaryInsurerId]); }
    finally { await db.end(); }
  });
