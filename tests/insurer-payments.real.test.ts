/*
 * Pagos de la aseguradora sobre la BASE REAL. Usa pagos REGISTRADO existentes de
 * la aseguradora demo; al final restaura su conciliación y borra la auditoría
 * creada por la prueba (también si falla).
 *
 * Ejecutar: npx tsx --tsconfig tests/tsconfig.json --env-file=.env.local tests/insurer-payments.real.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDbPool } from "@/lib/db/pool";
import { ReconcileError, getAllInsurerPayments, getInsurerPayments, reconcilePayments } from "@/lib/insurer/payments";
import type { InsurerPaymentFilters } from "@/lib/insurer/payment-types";

const db = getDbPool();
const startedAt = new Date().toISOString();
let passed = 0;
let actor: { insurerId: string; userId: string } | null = null;
let original: { id: string; conciliado_en: string | null; conciliado_por_id: string | null }[] = [];

async function step(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function rejects(fn: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(fn, (error) => error instanceof ReconcileError && pattern.test(error.message));
}

async function main() {
  const user = (await db.query<{ id: string; aseguradora_id: string }>(`select id, aseguradora_id from usuario where email = 'aseguradorademo@kuantix.com'`)).rows[0];
  assert.ok(user, "Falta el usuario aseguradorademo@kuantix.com");
  actor = { insurerId: user.aseguradora_id, userId: user.id };
  const insurerId = user.aseguradora_id;
  const filters: InsurerPaymentFilters = { from: "2000-01-01", to: "2999-12-31", channel: null, products: [], reconciliation: "TODOS", method: "TODOS" };
  const scope = { insurerId, channelId: null, productIds: [] as string[] };

  const all = await getAllInsurerPayments(scope, filters);
  assert.ok(all.length, "La aseguradora demo no tiene pagos registrados para probar");
  original = (await db.query(`select id, conciliado_en::text, conciliado_por_id::text from pago where id = any($1::uuid[])`, [all.map((r) => r.id)])).rows;
  const target = all[0];

  // Punto de partida: el pago objetivo sin conciliar.
  await db.query(`update pago set conciliado_en = null, conciliado_por_id = null where id = $1`, [target.id]);

  await step("la página y el Excel ven los mismos pagos y totales", async () => {
    const { summary, rows } = await getInsurerPayments(scope, filters, 1, 10_000);
    assert.equal(summary.total, all.length);
    assert.equal(rows.length, all.length);
    assert.equal(Math.round(summary.amount * 100), Math.round(all.reduce((t, r) => t + r.amount, 0) * 100));
  });

  await step("un canal o producto ajeno deja el filtro vacío", async () => {
    const none = await getInsurerPayments({ insurerId, channelId: randomUUID(), productIds: [] }, filters, 1, 50);
    assert.equal(none.summary.total, 0);
    const otherInsurer = await getInsurerPayments({ insurerId: randomUUID(), channelId: null, productIds: [] }, filters, 1, 50);
    assert.equal(otherInsurer.summary.total, 0);
  });

  await step("otra aseguradora no puede conciliar el pago", async () => {
    await rejects(() => reconcilePayments({ insurerId: randomUUID(), userId: user.id }, { reconcile: true, selection: { mode: "ids", ids: [target.id] }, expectedCount: 1 }), /No hay pagos por conciliar/);
  });

  await step("si el total confirmado no coincide, no cambia nada", async () => {
    await rejects(() => reconcilePayments(actor!, { reconcile: true, selection: { mode: "ids", ids: [target.id] }, expectedCount: 2 }), /cambiaron/);
    const row = (await db.query(`select conciliado_en from pago where id = $1`, [target.id])).rows[0];
    assert.equal(row.conciliado_en, null);
  });

  await step("concilia por ids, audita y aparece en el filtro de conciliados", async () => {
    assert.equal(await reconcilePayments(actor!, { reconcile: true, selection: { mode: "ids", ids: [target.id] }, expectedCount: 1 }), 1);
    const row = (await db.query(`select conciliado_en, conciliado_por_id from pago where id = $1`, [target.id])).rows[0];
    assert.ok(row.conciliado_en);
    assert.equal(row.conciliado_por_id, user.id);
    const audit = await db.query(`select 1 from auditoria where entidad = 'PAGO' and entidad_id = $1 and accion = 'EDICION' and creado_en >= $2`, [target.id, startedAt]);
    assert.equal(audit.rowCount, 1);
    const done = await getAllInsurerPayments(scope, { ...filters, reconciliation: "CONCILIADOS" });
    assert.ok(done.some((r) => r.id === target.id));
  });

  await step("conciliar de nuevo el mismo pago no lo cambia", async () => {
    await rejects(() => reconcilePayments(actor!, { reconcile: true, selection: { mode: "ids", ids: [target.id] }, expectedCount: 1 }), /No hay pagos por conciliar/);
  });

  await step("quitar la conciliación con todos los del filtro y exclusiones", async () => {
    const reconciled = (await getAllInsurerPayments(scope, { ...filters, reconciliation: "CONCILIADOS" })).map((r) => r.id);
    const exclude = reconciled.filter((id) => id !== target.id);
    assert.equal(await reconcilePayments(actor!, { reconcile: false, selection: { mode: "all", filters, exclude }, expectedCount: 1 }), 1);
    const row = (await db.query(`select conciliado_en, conciliado_por_id from pago where id = $1`, [target.id])).rows[0];
    assert.equal(row.conciliado_en, null);
    assert.equal(row.conciliado_por_id, null);
  });

  console.log(`\n${passed} comprobaciones OK`);
}

async function cleanup() {
  for (const row of original) {
    await db.query(`update pago set conciliado_en = $2::timestamptz, conciliado_por_id = $3::uuid where id = $1`, [row.id, row.conciliado_en, row.conciliado_por_id]);
  }
  if (actor) await db.query(`delete from auditoria where entidad = 'PAGO' and usuario_id = $1 and creado_en >= $2`, [actor.userId, startedAt]);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanup(); await db.end(); });
