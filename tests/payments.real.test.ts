/*
 * Pruebas de Pagos y Cancelaciones sobre la BASE REAL (tablas, restricciones y
 * claves foráneas reales; nada temporal). Crea pólizas de prueba marcadas con
 * "TEST-PAGOS-<run>" para el usuario canal demo, ejecuta el código real de
 * lib/payments y lib/policies, y al final borra todo lo creado (también si falla).
 *
 * Ejecutar: npx tsx --tsconfig tests/tsconfig.json --env-file=.env.local tests/payments.real.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDbPool } from "@/lib/db/pool";
import { blockedSql, payableSql, paymentScope } from "@/lib/payments/queries";
import { PaymentError, registerPayments } from "@/lib/payments/register";
import { CancellationError, cancelPolicy } from "@/lib/policies/cancel-policy";
import type { PaymentInput } from "@/lib/payments/types";

const db = getDbPool();
const run = Date.now().toString(36).toUpperCase();
const tag = `TEST-PAGOS-${run}`;
const created = { clients: [] as string[], vehicles: [] as string[], quotes: [] as string[], policies: [] as string[] };
let passed = 0;

async function step(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main() {
  const user = (await db.query<{ id: string; canal_id: string; aseguradora_id: string }>(
    `select id, canal_id, aseguradora_id from usuario where email = 'canaldemo@kuantix.com'`,
  )).rows[0];
  assert.ok(user, "Falta el usuario canaldemo@kuantix.com");
  const actor = { channelId: user.canal_id, insurerId: user.aseguradora_id, userId: user.id };
  const template = (await db.query(
    `select producto_id, ciudad_id, anios_vigencia, tasa_promedio, nivel_riesgo, cuota_fija_mensual, fecha_inicio_vigencia, fecha_fin_vigencia
     from cotizacion where canal_id = $1 and aseguradora_id = $2 and origen = 'CANAL' limit 1`, [actor.channelId, actor.insurerId],
  )).rows[0];
  assert.ok(template, "El canal demo no tiene cotizaciones para usar como plantilla");

  /** Póliza de prueba emitida el 10/01/2026 con 12 cuotas de $100 (vencen el 10 de feb-2026 a ene-2027). */
  async function policy(letter: string) {
    const client = (await db.query<{ id: string }>(
      `insert into cliente (tipo_cliente, nombre_razon_social, email, identificacion) values ('INDIVIDUAL', $1, $2, $3) returning id`,
      [`${tag} CLIENTE ${letter}`, `${tag.toLowerCase()}-${letter.toLowerCase()}@test.invalid`, `99${String(Date.now()).slice(-7)}${letter.charCodeAt(0) % 10}`],
    )).rows[0].id;
    created.clients.push(client);
    const vehicle = (await db.query<{ id: string }>(
      `insert into vehiculo (cliente_id, marca, modelo, valor_asegurado, estado_vh, uso, placa) values ($1, 'TEST', 'PAGOS', 20000, 'NUEVO', 'PARTICULAR', $2) returning id`,
      [client, `T${run.slice(-4)}${letter}`],
    )).rows[0].id;
    created.vehicles.push(vehicle);
    const quote = (await db.query<{ id: string }>(
      `insert into cotizacion (aseguradora_id, producto_id, cliente_id, vehiculo_id, ciudad_id, origen, anios_vigencia, tasa_promedio, nivel_riesgo,
                               cuota_fija_mensual, canal_id, usuario_id, fecha_inicio_vigencia, fecha_fin_vigencia, estado)
       values ($1, $2, $3, $4, $5, 'CANAL', $6, $7, $8, 100, $9, $10, $11, $12, 'ACEPTADA') returning id`,
      [actor.insurerId, template.producto_id, client, vehicle, template.ciudad_id, template.anios_vigencia, template.tasa_promedio,
        template.nivel_riesgo, actor.channelId, actor.userId, template.fecha_inicio_vigencia, template.fecha_fin_vigencia],
    )).rows[0].id;
    created.quotes.push(quote);
    const id = (await db.query<{ id: string }>(
      `insert into poliza (cotizacion_id, numero_poliza, fecha_emision, fecha_inicio_vigencia, fecha_fin_vigencia, estado)
       values ($1, $2, '2026-01-10', '2026-01-10', '2027-01-10', 'VIGENTE') returning id`, [quote, `${tag}-${letter}`],
    )).rows[0].id;
    created.policies.push(id);
    const cuotas = (await db.query<{ id: string; numero_cuota: number }>(
      `insert into tabla_cobranza (poliza_id, numero_cuota, fecha_vencimiento, monto)
       select $1, n, (date '2026-02-10' + make_interval(months => n - 1))::date, 100 from generate_series(1, 12) n
       returning id, numero_cuota`, [id],
    )).rows.sort((a, b) => a.numero_cuota - b.numero_cuota).map((r) => r.id);
    return { id, quote, cuota: (n: number) => cuotas[n - 1] };
  }
  const state = async (id: string) => (await db.query<{ estado: string }>(`select estado from tabla_cobranza where id = $1`, [id])).rows[0].estado;
  const paidCount = async (id: string) => Number((await db.query(`select count(*) from pago where cobranza_id = $1 and estado = 'REGISTRADO'`, [id])).rows[0].count);
  const base = { date: "2026-10-01", method: "TRANSFERENCIA" as const, reference: tag };
  const pay = (ids: string[], extra: Partial<PaymentInput> = {}, who = actor) =>
    registerPayments(who, { ...base, selection: { mode: "ids", ids }, expectedCount: ids.length, expectedCents: ids.length * 10000, ...extra });
  const rejects = async (p: Promise<unknown>, pattern: RegExp) => {
    await assert.rejects(p, (e: unknown) => e instanceof PaymentError && pattern.test(e.message));
  };

  const A = await policy("A");
  const B = await policy("B");
  console.log(`Datos de prueba creados en la base real (${tag}).`);

  await step("no permite pagar la cuota 3 sin la 1 y la 2", async () => {
    await rejects(pay([A.cuota(3)]), /en orden: primero debe pagarse la cuota 1/);
    assert.equal(await state(A.cuota(3)), "PENDIENTE");
  });
  await step("paga las cuotas 1 y 2 juntas: PAGO por cuota, estado PAGADO y auditoría", async () => {
    const r = await pay([A.cuota(2), A.cuota(1)]);
    assert.deepEqual(r, { count: 2, cents: 20000 });
    assert.equal(await state(A.cuota(1)), "PAGADO");
    assert.equal(await state(A.cuota(2)), "PAGADO");
    assert.equal(await state(A.cuota(3)), "PENDIENTE", "solo los meses seleccionados");
    const audit = await db.query(`select entidad, accion from auditoria where usuario_id = $1 and (entidad_id = any($2::uuid[]) or entidad_id in (select id from pago where cobranza_id = any($2::uuid[])))`,
      [actor.userId, [A.cuota(1), A.cuota(2)]]);
    assert.equal(audit.rows.filter((r) => r.entidad === "PAGO" && r.accion === "CREACION").length, 2);
    assert.equal(audit.rows.filter((r) => r.entidad === "TABLA_COBRANZA" && r.accion === "CAMBIO_ESTADO").length, 2);
  });
  await step("no duplica: volver a pagar la cuota 2 se rechaza", async () => {
    await rejects(pay([A.cuota(2)]), /pagadas, canceladas o ajenas/);
    assert.equal(await paidCount(A.cuota(2)), 1);
  });
  await step("no permite saltos dentro del lote (3 y 5 sin la 4)", async () => {
    await rejects(pay([A.cuota(3), A.cuota(5)]), /primero debe pagarse la cuota 4/);
    assert.equal(await state(A.cuota(3)), "PENDIENTE", "lote rechazado completo");
  });
  await step("fecha de pago: ni anterior a la emisión ni futura", async () => {
    await rejects(pay([A.cuota(3)], { date: "2026-01-09" }), /anterior a la emisión de la póliza/);
    await rejects(pay([A.cuota(3)], { date: "2999-01-01" }), /futura/);
    await pay([A.cuota(3)], { date: "2026-01-10" });
  });
  await step("rechaza cuotas de otro canal", async () => {
    await rejects(pay([A.cuota(4)], {}, { ...actor, channelId: randomUUID() }), /ajenas a tu canal/);
    assert.equal(await state(A.cuota(4)), "PENDIENTE");
  });
  await step("rechaza si el total esperado no coincide", async () => {
    await rejects(pay([A.cuota(4)], { expectedCents: 9999 }), /saldo cambió/);
  });
  await step("concurrencia: dos registros simultáneos de la misma cuota pagan una sola vez", async () => {
    const results = await Promise.allSettled([pay([A.cuota(4)]), pay([A.cuota(4)]), pay([A.cuota(4)])]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof PaymentError));
    assert.equal(await paidCount(A.cuota(4)), 1);
  });
  await step("pago por adelantado de cuotas futuras (5 a 10, vencen hasta nov-2026)", async () => {
    await pay([5, 6, 7, 8, 9, 10].map(A.cuota));
    assert.equal(await state(A.cuota(10)), "PAGADO");
  });
  await step("cancelación: no se puede cancelar desde un mes con cuotas pagadas", async () => {
    await assert.rejects(cancelPolicy({ policyId: A.id, month: "2026-09", origin: "INDIVIDUAL", channelId: actor.channelId, userId: actor.userId }), CancellationError);
    assert.equal(await state(A.cuota(8)), "PAGADO");
  });
  await step("cancelación: sí se cancela desde la cuota siguiente a la última pagada", async () => {
    const r = await cancelPolicy({ policyId: A.id, month: "2026-12", origin: "INDIVIDUAL", channelId: actor.channelId, userId: actor.userId });
    assert.equal(r.from, 11);
    assert.equal(await state(A.cuota(10)), "PAGADO");
    assert.equal(await state(A.cuota(11)), "CANCELADA");
    assert.equal(await state(A.cuota(12)), "CANCELADA");
  });
  await step("no se pagan cuotas canceladas (lote mixto se rechaza completo)", async () => {
    await rejects(pay([B.cuota(1), A.cuota(11)]), /pagadas, canceladas o ajenas/);
    assert.equal(await state(B.cuota(1)), "PENDIENTE");
  });

  const scopeCount = async (filters: { from: string; to: string; status: "POR_COBRAR" | "PENDIENTE" }) => {
    const s = paymentScope(actor.channelId, actor.insurerId, { ...filters, products: [] }, "2026-10-14");
    return (await db.query<{ payable: number; blocked: number }>(
      `select count(*) filter (where ${payableSql})::int as payable,
              count(*) filter (where t.estado in ('PENDIENTE','VENCIDO') and t.monto > payments.paid and ${blockedSql})::int as blocked
       ${s.from} and po.id = $8`, [...s.values, B.id],
    )).rows[0];
  };
  await step("filtro: cuotas con anteriores pendientes fuera del rango quedan bloqueadas", async () => {
    assert.deepEqual(await scopeCount({ from: "2026-04-01", to: "2027-01-31", status: "POR_COBRAR" }), { payable: 0, blocked: 10 });
    assert.deepEqual(await scopeCount({ from: "2026-02-01", to: "2027-01-31", status: "POR_COBRAR" }), { payable: 12, blocked: 0 });
    // Solo "pendientes" (no vencidas): las vencidas quedan fuera, así que las futuras se bloquean.
    assert.deepEqual(await scopeCount({ from: "2026-02-01", to: "2027-01-31", status: "PENDIENTE" }), { payable: 0, blocked: 3 });
  });

  const allB = (exclude: { policyId: string; from: number }[], count: number, cents: number) =>
    registerPayments(actor, { ...base, selection: { mode: "all", filters: { from: "2026-02-01", to: "2026-03-31", products: [template.producto_id], status: "POR_COBRAR" }, exclude }, expectedCount: count, expectedCents: cents });
  await step("todas las del filtro con exclusión: desmarcar no afecta el resto", async () => {
    // El filtro (feb–mar 2026) contiene B1 y B2. Se excluye B2: solo se paga B1.
    await rejects(allB([{ policyId: B.id, from: 2 }], 2, 20000), /selección cambió/);
    const r = await allB([{ policyId: B.id, from: 2 }], 1, 10000);
    assert.deepEqual(r, { count: 1, cents: 10000 });
    assert.equal(await state(B.cuota(1)), "PAGADO");
    assert.equal(await state(B.cuota(2)), "PENDIENTE");
  });
  await step("respeta abonos previos: paga solo el saldo", async () => {
    await db.query(`insert into pago (cobranza_id, monto_pagado, referencia, usuario_registro_id) values ($1, 40, $2, $3)`, [B.cuota(2), tag, actor.userId]);
    await pay([B.cuota(2)], { expectedCents: 6000 });
    const sum = (await db.query(`select sum(monto_pagado)::text s from pago where cobranza_id = $1 and estado = 'REGISTRADO'`, [B.cuota(2)])).rows[0].s;
    assert.equal(sum, "100.00");
  });
  await step("concurrencia pago vs cancelación de la misma póliza: el estado queda consistente", async () => {
    const [payment, cancellation] = await Promise.allSettled([
      pay([B.cuota(3)]),
      cancelPolicy({ policyId: B.id, month: "2026-04", origin: "INDIVIDUAL", channelId: actor.channelId, userId: actor.userId }),
    ]);
    assert.ok((payment.status === "fulfilled") !== (cancellation.status === "fulfilled"), "exactamente una operación gana");
    const s3 = await state(B.cuota(3));
    assert.equal(s3, payment.status === "fulfilled" ? "PAGADO" : "CANCELADA");
    assert.equal(await paidCount(B.cuota(3)), payment.status === "fulfilled" ? 1 : 0, "nunca hay pago sobre una cuota cancelada");
  });

  console.log(`\nOK: ${passed} pruebas pasaron sobre la base real.`);
}

async function cleanup() {
  const pol = created.policies;
  if (pol.length) {
    await db.query(
      `delete from auditoria where entidad_id in (
         select id from pago where cobranza_id in (select id from tabla_cobranza where poliza_id = any($1::uuid[]))
         union select id from tabla_cobranza where poliza_id = any($1::uuid[])
         union select id from cancelacion_poliza where poliza_id = any($1::uuid[])
         union select unnest($1::uuid[]))`, [pol],
    );
    await db.query(`delete from pago where cobranza_id in (select id from tabla_cobranza where poliza_id = any($1::uuid[]))`, [pol]);
    await db.query(`delete from poliza where id = any($1::uuid[])`, [pol]); // cascada: cuotas, cancelaciones, nivelación
  }
  if (created.quotes.length) await db.query(`delete from cotizacion where id = any($1::uuid[])`, [created.quotes]);
  if (created.vehicles.length) await db.query(`delete from vehiculo where id = any($1::uuid[])`, [created.vehicles]);
  if (created.clients.length) await db.query(`delete from cliente where id = any($1::uuid[])`, [created.clients]);
  const left = (await db.query(`select (select count(*) from poliza where numero_poliza like $1)::int + (select count(*) from cliente where nombre_razon_social like $1)::int as n`, [`${tag}%`])).rows[0].n;
  console.log(left === 0 ? `Limpieza completa: no quedan datos de ${tag}.` : `ATENCIÓN: quedaron ${left} registros de ${tag}.`);
}

main()
  .catch((error) => { console.error("\nFALLÓ:", error); process.exitCode = 1; })
  .finally(async () => {
    try { await cleanup(); } catch (error) { console.error("Error limpiando datos de prueba:", error); process.exitCode = 1; }
    await db.end();
  });
