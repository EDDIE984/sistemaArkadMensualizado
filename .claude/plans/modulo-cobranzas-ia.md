# Módulo de gestión de cobranzas asistido por IA

## Estado (2026-08-26)

**Entregable inmediato: MOCKUP interactivo de demo — solo visual, sin backend, sin persistencia, descartable.**
Objetivo: mostrarle al cliente qué se puede hacer con IA como módulo adicional. Todo con datos
ficticios en el navegador; se borra después de la presentación.

**El plan de implementación completo (más abajo) queda EN PAUSA**, guardado para retomarlo y
depurarlo según la necesidad real del cliente una vez que dé feedback sobre el mockup.

**Copia durable de este plan:** al salir de plan mode se guarda una copia dentro del proyecto
en `.claude/plans/modulo-cobranzas-ia.md` (carpeta `.claude/` del repo Mensualizado), para
retomarlo desde ahí.

---

## Parte A — Mockup de demo (lo que se construye ahora)

### Formato
Un único **Artifact HTML self-contained** (theme oscuro estilo CONFIA: fondo `#071426`,
paneles `#102640`, acento `#8fcfff`), en español, **interactivo** (tabs navegables, botones
que revelan texto pre-escrito, chat con guión fijo, filtros que funcionan). Sin red, sin
`localStorage`, sin datos reales. Cargar la skill `artifact-design` antes de escribir el HTML.

### Pantallas (todas con datos inventados)

1. **Cartera en mora + generación de mensajes por segmento/tono**
   - Tabla de ~8 pólizas ficticias con pill de segmento (`AL DÍA` / `MORA TEMPRANA` /
     `MORA MEDIA` / `MORA AVANZADA`) y color por tono, días de mora, monto vencido, estado de gestión.
   - Filtro por segmento que funciona (mostrar/ocultar filas en JS).
   - Al abrir una póliza: panel de revisión con selector de **canal** (Email / WhatsApp / SMS)
     y **tono** (Amigable / Recordatorio / Formal / Urgente). Botón **"Generar con IA"** que,
     tras un breve spinner simulado, revela un `asunto` + `cuerpo` pre-escritos distintos por
     tono (3–4 variantes redactadas a mano). Campos editables (textarea) + botones
     **Editar / Aprobar / Enviar** que solo cambian el pill de estado visualmente.
   - Nota al pie: "Borrador generado por IA — requiere aprobación humana antes de enviarse."

2. **Chatbot conversacional del cliente**
   - Ventana de chat estilo WhatsApp. Guión fijo: cliente saluda → bot muestra **saldo y
     próxima cuota** → cliente pide **plan de pago** → bot ofrece 2 opciones (3 y 6 cuotas) →
     cliente elige → bot genera **link de pago simulado** y confirma.
   - Botones de respuesta rápida pre-definidos (el usuario hace clic y avanza el guión).
   - Aviso: "Demo — el pago y el plan no se procesan."

3. **Voicebot de cobranza (transcripción simulada)**
   - Transcripción de una llamada saliente: identificación → recordatorio de cuota vencida →
     cliente negocia fecha → bot registra promesa de pago → **escalamiento a agente humano**
     cuando el cliente se molesta.
   - Panel lateral con metadatos ficticios: duración, resultado (`Promesa de pago`),
     sentimiento detectado, "derivada a agente: sí".

4. **Análisis de sentimiento + interacciones**
   - Timeline de 5–6 interacciones (entrantes/salientes, Email/WhatsApp/Llamada) de una
     póliza, cada una con badge de sentimiento (`Positivo` / `Neutro` / `Negativo` /
     `Muy negativo`), score, y "señales" detectadas (chips).
   - Una interacción "si siguen molestando voy a cancelar el seguro" marcada
     `Muy negativo` + `Riesgo de cancelación: ALTO`.

5. **Dashboard predictivo + reportes**
   - KPIs: cartera total, monto vencido, % recuperación, pólizas en riesgo.
   - Gráfico de barras (SVG/divs) con **proyección de mora a 30 / 60 / 90 días**.
   - Lista de **alertas tempranas** (pólizas con sentimiento negativo o mora acelerada).
   - Botón "Descargar reporte" que abre un modal con una tabla resumen (no descarga archivo).

### Navegación
Barra lateral o tabs superiores con las 5 pantallas. Header con logo "CONFIA" y etiqueta
visible **"DEMO / Datos ficticios"**.

### Qué NO incluye el mockup
Persistencia, llamadas a OpenAI reales, envío real de correos/WhatsApp, autenticación,
integración con el esquema real. Es exclusivamente de presentación.

### Verificación del mockup
Abrir el Artifact; recorrer las 5 pantallas; confirmar que: el filtro de segmento funciona,
"Generar con IA" muestra textos distintos por tono, el chat avanza con los botones, la
transcripción del voicebot se lee completa, los badges de sentimiento se ven, y el dashboard
renderiza el gráfico 30/60/90 y las alertas. Revisar en tema claro y oscuro del visor.

---

## Parte B — Plan de implementación real (EN PAUSA — retomar tras feedback del cliente)

> Lo siguiente es el plan técnico completo para construir el módulo de verdad. No se ejecuta
> hasta que el cliente valide el mockup y se depuren los requisitos. Se conserva aquí íntegro.

## Context

El equipo quiere un módulo de cobranzas asistido por IA (mensajes personalizados por
segmento/tono, análisis de sentimiento, dashboard predictivo, reportes). El sistema hoy
tiene **solo el esqueleto de datos** de cobranza (`poliza`, `tabla_cobranza`, `pago`)
**sin ninguna lógica**: nada pasa una cuota a `VENCIDO`, no hay registro de pagos, no hay
transiciones de estado, ni scheduler, ni canal de WhatsApp/SMS. En cambio, el módulo de
Inspección con IA ya establece un patrón sólido y reutilizable: llamada LLM con JSON-schema
+ Zod, procesamiento por lotes disparado desde el navegador con claim/lease por fila, y un
panel de revisión human-in-the-loop (aprobar/rechazar con auditoría).

**Decisión de alcance (acordada con el usuario):** Fase 1 = **la capa de IA corriendo sobre
datos de cobranza SEMBRADOS**. El motor real (aging productivo, registro real de pagos,
transiciones `poliza.estado`, recargos, gracia, planes de pago) queda **fuera de alcance**:
se asume y se siembra su estado. Se diseña la **abstracción multi-canal desde ya** (EMAIL
real + WHATSAPP en modo demo), y un **PORT de pasarela de pago** definido pero sin
implementar (candidatos Datafast/Kushki/PayPhone, se cablea en Fase 2). **n8n no se adopta**:
se construye dentro de la app (Vercel Cron + route handlers + módulos `lib/`) exponiendo
endpoints/webhook limpios por si el equipo de ops quiere orquestar campañas con n8n luego.
**Voicebot: descartado en Fase 1** (servicio de telefonía externo, fase futura). **Chatbot
de cliente: diferido a Fase 2** (requiere motor real + pasarela).

Resultado esperado: un flujo demostrable end-to-end — cartera en mora sembrada → generar
borradores segmentados → revisar/editar/aprobar → enviar por email (WhatsApp simulado) →
analizar sentimiento de interacciones → dashboard 30/60/90 + alertas tempranas → reporte CSV.

## Prerequisito obligatorio

Antes de escribir route handlers / server actions, leer en `node_modules/next/dist/docs/`
(Next 16.3 tiene breaking changes vs training data — lo advierte `AGENTS.md`):
route handlers, route segment config (`runtime`, `maxDuration`, `dynamic`), route groups,
y la firma de Server Actions / `useActionState`. Anotar deltas de API (`params`/`searchParams`
async, `PageProps`).

## Patrones existentes a reutilizar (copiar, no reinventar)

| Necesidad | Fuente en el repo |
|---|---|
| LLM batch + claim/lease + never-throw | `lib/inspeccion/analisis.ts` (`analyzePhoto`, `analyzeInspeccionBatch`) |
| Route handler LLM disparado desde navegador | `app/api/inspeccion/analizar/route.ts` (`runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=300`) |
| Loop cliente en lotes | `components/inspeccion/inspeccion-workspace.tsx` (`kickAnalisis`, `for (i<20) fetch`) |
| Panel revisión (server actions) | `app/actions/inspeccion-revision.ts` (helpers `fail`/`ok`/`revalidate`/`guard`, dictamen con motivo obligatorio) |
| Panel revisión (cliente) | `components/insurer/inspeccion-revision.tsx` (`useActionState`, draft state re-sync por `serverKey`, flag `dirty`, tabs) |
| Lista + filtros + KPIs | `app/(insurer-admin)/aseguradora/inspecciones/page.tsx`, `components/insurer/inspeccion-filtros.tsx`, `lib/inspeccion/data.ts` (`loadInspeccionesListForInsurer`, `assertInsurerOwnsInspeccion`) |
| Auth + scope multi-tenant | `lib/auth/session.ts` (`requireInsurerAdmin`), scope vía `poliza → cotizacion.aseguradora_id === session.insurerId` |
| Auditoría | `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)` — sub-tipo en `datos_nuevos.accion` |
| Email | `lib/auth/email.ts` (`getMailConfig()` + nodemailer) — generalizar a `lib/mail/send.ts` |
| DB | `lib/db/pool.ts` (raw pg, `begin/commit/rollback`), `lib/supabase/admin.ts` (service-role) |
| Estado de acción | `lib/insurer/action-state.ts` (`InsurerActionState`, `initialInsurerState`) |
| Nav | `components/insurer/insurer-shell.tsx` (array `items`) |
| Convención migración | SQL manual contra BD hosteada, `YYYYMMDDHHMMSS_snake.sql`, dominios `text ... check (in (...))` (nunca enums PG), tablas sensibles con `enable row level security` + `revoke all from anon, authenticated` |

## Cambios de esquema (mínimos)

> **AGENTS.md:** actualizar `supabase/PLATAFORMA_SEGUROS_MODELO_ER.md` **primero** (regla de
> negocio nueva + bloques de entidad + vista), que el usuario apruebe el diff, y **luego** el SQL.

Migración `supabase/migrations/<ts>_cobranza_ia.sql`:

1. **Vista `v_poliza_cobranza`** (sin tabla) — fuente única de "estado de mora por póliza",
   calculada sobre `tabla_cobranza` + `pago` + `poliza` + `cotizacion` (para `aseguradora_id`).
   Una fila por póliza con: `poliza_id`, `aseguradora_id`, `cliente_id`, `numero_poliza`,
   `poliza_estado`, `cuotas_totales`, `cuotas_pagadas`,
   `cuotas_vencidas` (`estado='VENCIDO' or (estado='PENDIENTE' and fecha_vencimiento < current_date)`),
   `monto_vencido`, `saldo_total` (`sum(monto) filter (where estado <> 'PAGADO')`),
   `dias_mora` (`current_date - min(fecha_vencimiento)` de cuotas vencidas impagas, 0 si ninguna),
   `proxima_cuota_venc`, `ultimo_pago_en`, `pagos_total`, `pagos_a_tiempo`, `pagos_tardios`.
   Documentar que en Fase 1 `tabla_cobranza.estado='VENCIDO'` lo pone el seed (simula el aging
   job inexistente) y que el motor real reemplaza ese supuesto.

2. **Tabla `cobranza_mensaje`** — borrador + revisión + envío. Una fila por `(poliza_id, canal)`.
   Columnas clave: `canal` check `('EMAIL','WHATSAPP','SMS')`; `segmento` check
   `('AL_DIA','MORA_TEMPRANA','MORA_MEDIA','MORA_AVANZADA')`; `tono` check
   `('AMIGABLE','RECORDATORIO','FORMAL','URGENTE')`; snapshot `dias_mora`, `cuotas_vencidas`,
   `monto_adeudado`; salida LLM `asunto`, `cuerpo`; edición revisor `asunto_editado`,
   `cuerpo_editado` (null = usar LLM); `generacion_estado` check
   `('PENDIENTE','GENERANDO','GENERADO','ERROR')` + `generacion_error`, `generacion_iniciada_en`,
   `generado_en`, `prompt_version`, `modelo`; `estado` check
   `('BORRADOR','APROBADO','RECHAZADO','ENVIADO','FALLIDO')` + `revisado_por_usuario_id`,
   `revisado_en`, `revision_motivo`; envío `destino`, `proveedor`, `proveedor_ref`,
   `envio_error`, `enviado_en`; `creado_en`. `unique (poliza_id, canal)`.
   Índices en `poliza_id`, `generacion_estado`, `estado`.
   Regenerar = `UPDATE ... SET generacion_estado='PENDIENTE'` sobre la fila existente.
   *Trade-off aceptado:* `unique(poliza_id,canal)` no guarda historial de envíos → tabla
   `cobranza_envio` queda para Fase 1.5 si hace falta.

3. **Tabla `cobranza_interaccion`** — historial de contacto + sentimiento. `poliza_id`
   **NULLABLE** (webhook sin match) + `contacto` (teléfono/email origen); `canal` check
   `('EMAIL','WHATSAPP','SMS','LLAMADA','NOTA')`; `direccion` check `('ENTRANTE','SALIENTE')`;
   `cuerpo`, `ocurrido_en`; `origen` check `('SEED','SISTEMA','AGENTE','WEBHOOK')`;
   `cobranza_mensaje_id` FK nullable; salida IA `sentimiento` check
   `('POSITIVO','NEUTRO','NEGATIVO','MUY_NEGATIVO')`, `sentimiento_score` numeric(4,3) (-1..1),
   `riesgo_queja` / `riesgo_cancelacion` check `('BAJO','MEDIO','ALTO')`, `senales` jsonb (string[]);
   `sentimiento_estado` check `('PENDIENTE','ANALIZANDO','ANALIZADO','ERROR')` +
   `sentimiento_modelo`, `sentimiento_error`, `sentimiento_iniciado_en`, `sentimiento_analizado_en`.
   Índices en `poliza_id`, `sentimiento_estado`, `ocurrido_en`.

4. **RLS**: ambas tablas nuevas con `enable row level security` + `revoke all from anon,
   authenticated` (PII, cuerpos de mensaje, teléfonos de webhook, salidas de IA → mismo
   criterio que `inspeccion*`).

5. **Auditoría**: `auditoria.entidad` admite `'COBRANZA_MENSAJE'` y `'COBRANZA_INTERACCION'`;
   `accion` se mantiene `CREACION|EDICION|CAMBIO_ESTADO`, sub-tipo en `datos_nuevos.accion`
   (`PREPARACION`, `GENERACION`, `EDICION_REVISOR`, `APROBACION`, `RECHAZO`, `ENVIO`, `SENTIMIENTO`).

## `lib/cobranza/` — layout por responsabilidad

Módulos con IO llevan `import "server-only"`; los puros no.

```
lib/openai/client.ts    server-only  getOpenAI() singleton EXTRAÍDO de lib/inspeccion/analisis.ts
                                     (refactor: analisis.ts pasa a importarlo; ~6 líneas, 1 call-site)
lib/mail/send.ts         server-only  sendMail() genérico extraído de lib/auth/email.ts
                                     (refactor: auth/email.ts pasa a usarlo)
lib/cobranza/
  types.ts              puro         Segmento, Tono, Canal, SegmentacionInput/Result, *View, KPIs
  segmentos.ts          puro         segmentar(input) -> { segmento, tono }; UMBRALES, *_LABELS,
                                     TONO_INSTRUCCION (texto por tono inyectado al prompt)
  dashboard.ts          puro         proyectarCartera(rows, hoy) 30/60/90; construirAlertasTempranas(...)
  reportes.ts           puro         reporteCarteraCsv(items); resumenGerencial(...)
  data.ts               server-only  assertInsurerOwnsPoliza; loadCarteraEnMora(insurerId, filtro)
                                     {items,kpis}; loadPolizaCobranzaDetalle(session, polizaId);
                                     loadInteraccionesPoliza; loadCarteraParaDashboard
  service.ts            server-only  prepararGestion; generarMensajesPendientes({insurerId,max});
                                     guardarEdicionMensaje; aprobar/rechazarMensaje; enviarMensaje;
                                     registrarInteraccion  — todo con tx + auditoría
  ia/
    schemas.ts          puro         Zod + JSON_SCHEMA de generación y de sentimiento
    prompts.ts          puro         GENERACION_PROMPT + GENERACION_PROMPT_VERSION="gen-v1";
                                     SENTIMIENTO_PROMPT + SENTIMIENTO_PROMPT_VERSION="sent-v1"
    generar.ts          server-only  generarMensaje(ctx) -> {asunto,cuerpo}  (never-throw; no toca BD)
    sentimiento.ts      server-only  analizarInteraccion({interaccionId}) claim/lease never-throw;
                                     analizarPendientes({insurerId,polizaId?,max})
  canales/
    types.ts            puro         CanalAdapter, OutboundMessage, EnvioResult
    email.ts            server-only  emailAdapter (real, vía lib/mail/send.ts; try/catch -> EnvioResult)
    whatsapp.ts         server-only  whatsappAdapter: WHATSAPP_ENABLED!=='true' -> modo demo
                                     (console.info + { ok:true, proveedorRef:'demo-'+uuid })
    registry.ts         server-only  getCanalAdapter(canal); hueco SMS sin implementar
  pagos/
    gateway.ts          puro/IF      interface PaymentGateway + noopGateway + getPaymentGateway()
                                     (comentario: Datafast/Kushki/PayPhone, cablear Fase 2)
```

**Segmentación (`segmentos.ts`, núcleo 100% testeable):** `diasMora<=0 && cuotasVencidas==0`
→ `AL_DIA/AMIGABLE`; `1..15` días ó 1 cuota → `MORA_TEMPRANA/RECORDATORIO`; `16..45` ó 2 cuotas
→ `MORA_MEDIA/FORMAL`; `>45` ó `>=3` cuotas → `MORA_AVANZADA/URGENTE`. Ajuste por historial:
`pagosTotal>=3 && pagosTardios/pagosTotal>0.5` sube un escalón de **tono** (no de segmento).

## Route handlers y Server Actions

**`app/api/cobranza/`** — todos `runtime="nodejs"`, `dynamic="force-dynamic"`; los LLM `maxDuration=300`:

| Ruta | Método | Auth | Comportamiento |
|---|---|---|---|
| `generar/route.ts` | POST | sesión + `ADMIN_ASEGURADORA`+`insurerId` | `generarMensajesPendientes({insurerId, max})` con claims scoped por insurer; cliente hace loop. `{ generadas, pendientes, errores }` |
| `sentimiento/route.ts` | POST | idem | `analizarPendientes({insurerId, polizaId?, max})`; loop cliente |
| `reporte/route.ts` | GET | `requireInsurerAdmin` | `?tipo=cartera\|gerencial&desde&hasta&segmento` → CSV `text/csv` + `Content-Disposition: attachment` |
| `webhook/whatsapp/route.ts` | GET | `?hub.verify_token === WHATSAPP_VERIFY_TOKEN` | devuelve `hub.challenge` |
| `webhook/whatsapp/route.ts` | POST | header `X-Webhook-Secret === COBRANZA_WEBHOOK_SECRET` (comparación constante) | extrae `from`+`text`, resuelve `poliza_id` por match de `cliente.telefono` normalizado, `registrarInteraccion(ENTRANTE, origen='WEBHOOK', sentimiento_estado='PENDIENTE')`, `200` rápido |
| `cron/aging/route.ts` | GET | `Authorization: Bearer ${CRON_SECRET}` **o** `X-Webhook-Secret` | **Fase 1:** idempotente; por cada póliza en mora sin `cobranza_mensaje` EMAIL fresco para su segmento actual → `prepararGestion(canal:'EMAIL')` (deja `PENDIENTE`). NO genera ni envía |

`vercel.json` nuevo en la raíz: `{ "crons": [ { "path": "/api/cobranza/cron/aging", "schedule": "0 12 * * *" } ] }`

**`app/actions/cobranza-revision.ts`** (`"use server"`, espejo de `inspeccion-revision.ts`) —
todas: `requireInsurerAdmin()` + `assertInsurerOwnsPoliza` + Zod + auditoría +
`revalidatePath('/aseguradora/cobranza')` y `.../cobranza/${polizaId}`:
`prepararGestion(polizaId, canal)`, `regenerarMensaje(mensajeId)`,
`guardarEdicionMensaje(mensajeId, asunto, cuerpo)`, `aprobarMensaje(mensajeId, motivo?)`,
`rechazarMensaje(mensajeId, motivo min 3)`, `enviarMensaje(mensajeId)` (exige `APROBADO`),
`registrarNotaInteraccion(polizaId, direccion, cuerpo)`.

## UI — `app/(insurer-admin)/aseguradora/cobranza/`

Componentes cliente en `components/insurer/cobranza-*.tsx`. Reutiliza `AdminPage`,
`AdminPanel`, `Stat`, `Table` de `components/admin/admin-ui.tsx`.

- **`cobranza/page.tsx`** — Cartera en mora. Server component: `requireInsurerAdmin` →
  `await searchParams` → `loadCarteraEnMora`. KPIs (`Stat`): Pólizas en mora · Monto vencido
  total · Mora avanzada (#) · Borradores por revisar · Enviados (7 días).
  `components/insurer/cobranza-filtros.tsx` (copia de `inspeccion-filtros.tsx`): rango de
  fechas + `select` Segmento + `select` Estado de gestión + input `q` (nº póliza / cédula / placa).
  Tabla: Póliza · Cliente · Producto · Segmento (pill color por tono) · Días mora ·
  Cuotas venc. · Monto vencido · Gestión (pill). Fila → `/aseguradora/cobranza/${polizaId}`.
- **`cobranza/[polizaId]/page.tsx`** — Detalle + revisión. `loadPolizaCobranzaDetalle` con
  try/catch → `notFound()`. Renderiza `components/insurer/cobranza-revision.tsx`.
- **`components/insurer/cobranza-revision.tsx`** (cliente, espejo de `inspeccion-revision.tsx`):
  estado local `draft` por `mensajeId` re-sync por `serverKey` + flag `dirty`; `useActionState`
  por acción; `router.refresh()` en success. Barra de acciones: pill de estado + Guardar
  edición / Aprobar / Rechazar (panel de motivo obligatorio) / Enviar (solo si `APROBADO`).
  Tabs: **Resumen** (cliente/vehículo/póliza, segmento+tono badge, cuotas vencidas, monto,
  días mora, historial de pago, próxima cuota) · **Mensajes** (por canal EMAIL/WHATSAPP:
  `asunto`/`cuerpo` en `textarea` ligados al estado local, botón "Generar/Regenerar" que
  dispara el loop `fetch('/api/cobranza/generar')` + `router.refresh()`, muestra
  `generacion_estado`) · **Interacciones** (timeline de `cobranza_interaccion` con badges
  `sentimiento`/`riesgo_cancelacion`/`senales`, botón "Analizar sentimiento" loop
  `fetch('/api/cobranza/sentimiento', {polizaId})`, formulario "Agregar nota").
- **`cobranza/tablero/page.tsx`** — Dashboard predictivo + reportes. `loadCarteraParaDashboard`
  → `proyectarCartera` + `construirAlertasTempranas` + `resumenGerencial`. Proyección 30/60/90
  (barras con `div` si `dashboard-charts.tsx` no es genérico), lista de alertas tempranas
  (enlace al detalle), bloque "Resumen gerencial", botones de descarga → `/api/cobranza/reporte`.
- **Nav**: agregar a `components/insurer/insurer-shell.tsx` array `items`
  `{ href: "/aseguradora/cobranza", label: "Cobranzas", icon: ReceiptText }`.
- **`/mi-cuenta` "mi saldo": DIFERIDO a Fase 2** (los clientes sembrados no pueden loguear;
  el resto de superficie de cliente ya está en Fase 2). Si el demo lo exige es barato: 1
  server component read-only leyendo `v_poliza_cobranza` filtrado por `session.actorId`.

## Seed — `supabase/migrations/<ts>_cobranza_seed.sql`

`do $$ ... end $$;` como `20260811033316_seed_caso_prueba.sql`. Reutiliza "Aseguradora Demo",
su `producto` y `canal` (buscar por nombre). ~10 pólizas `POL-DEMO-COB-0001..0010`, cada una
con `cliente` + `vehiculo` + `cotizacion (estado='ACEPTADA')` + `poliza` + `tabla_cobranza`
(24–48 cuotas, `fecha_vencimiento` retro-fechada). No sembrar `amortizacion_mensual` (el
módulo no la usa). `cliente.email = onewayec81+cobNN@gmail.com` (buzón real para probar envío);
`cliente.telefono` formato EC `09XXXXXXXX` (match del webhook).

Distribución: **2 AL_DIA** (todas las cuotas pasadas `PAGADO` con filas `pago` a tiempo,
próxima `PENDIENTE` futura) · **3 MORA_TEMPRANA** (1 cuota vencida ~8–14 días `VENCIDO` sin
pago) · **3 MORA_MEDIA** (2 cuotas vencidas ~25–40 días, 1–2 pagos previos algunos tardíos) ·
**2 MORA_AVANZADA** (3–4 cuotas vencidas ~70–100 días, una con `poliza.estado='VENCIDA'`,
`pagos_tardios` alto). El seed **pone `tabla_cobranza.estado='VENCIDO'`** en las cuotas
vencidas impagas (simula el aging job).

`cobranza_interaccion`: 3–5 por póliza, `origen='SEED'`, `sentimiento_estado='PENDIENTE'`,
`ocurrido_en` en los últimos 60 días — recordatorios salientes neutrales, una respuesta
entrante cooperativa ("les pago el viernes"), y en las MORA_AVANZADA una entrante molesta
("si siguen molestando voy a cancelar el seguro") para alimentar sentimiento negativo + alerta.

`cobranza_mensaje`: sembrar skeletons `generacion_estado='PENDIENTE'`, `canal='EMAIL'`,
`estado='BORRADOR'` con snapshot para 3 pólizas (TEMPRANA, MEDIA, AVANZADA); el resto se crea
con "Preparar gestión". Idempotencia: `numero_poliza` fijos + `where not exists` /
`on conflict do nothing`; `raise notice` al final.

## Variables de entorno nuevas

`OPENAI_TEXT_MODEL` (p.ej. `gpt-4o-mini`) · `WHATSAPP_ENABLED` (ausente = demo) ·
`WHATSAPP_API_URL` / `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_VERIFY_TOKEN` ·
`COBRANZA_WEBHOOK_SECRET` · `CRON_SECRET` (Vercel lo inyecta) · `PAYMENT_GATEWAY` (default `noop`) ·
`COBRANZA_FROM_NAME` / `COBRANZA_REPLY_TO` (opcional). Se reutilizan `SMTP_*`, `APP_URL`,
`SUPABASE_*`, `DATABASE_URL`, `OPENAI_API_KEY`.

## Pasos ordenados (con checkpoints)

1. Leer docs de Next 16 (§Prerequisito). **Checkpoint 0:** anotar deltas de API.
2. **ER doc**: regla de negocio nueva + bloques `COBRANZA_MENSAJE`, `COBRANZA_INTERACCION`,
   vista `V_POLIZA_COBRANZA`; describir segmentación pura, tono, `CanalAdapter`, PORT de pagos,
   RLS, "informativo — no toca `poliza.estado` ni `pago`". **Checkpoint 1a: el usuario aprueba el diff.**
3. Migración `<ts>_cobranza_ia.sql` (vista + 2 tablas + índices + RLS/revoke). Aplicar.
   **Checkpoint 1b:** `\d` + `select count(*), avg(dias_mora) from v_poliza_cobranza;`
4. `lib/openai/client.ts` + refactor `lib/inspeccion/analisis.ts` para importarlo.
   **Checkpoint 4:** re-correr un análisis de inspección — sin regresión.
5. `lib/cobranza/types.ts` + `segmentos.ts` (puro). Script desechable en `scratchpad/` con
   `console.assert` (no hay test runner en el repo) para la tabla input→segmento/tono.
   **Checkpoint 5:** casos revisados vs. intención de negocio.
6. Seed `<ts>_cobranza_seed.sql`. Aplicar. **Checkpoint 3:** distribución de segmentos correcta.
7. `lib/cobranza/data.ts` + `cobranza/page.tsx` + `cobranza-filtros.tsx` + item de nav (solo
   lectura). **Checkpoint 6:** lista muestra cartera con segmentos/KPIs; filtros funcionan.
8. IA de generación: `ia/{schemas,prompts,generar}.ts`, `service.ts` (`prepararGestion` +
   `generarMensajesPendientes`), `app/api/cobranza/generar/route.ts`, acciones
   `prepararGestion`/`regenerarMensaje`, loop cliente. **Checkpoint 7:** generar borradores
   para 3 pólizas; validar JSON y diferencia de tono (TEMPRANA vs AVANZADA).
9. Panel de revisión: `app/actions/cobranza-revision.ts` (guardar/aprobar/rechazar),
   `cobranza/[polizaId]/page.tsx`, `cobranza-revision.tsx` (tabs Resumen + Mensajes).
   **Checkpoint 8:** editar → guardar (`dirty` se limpia) → aprobar/rechazar; filas en `auditoria`.
10. Canales + envío: `lib/mail/send.ts` (generalizar; refactor `lib/auth/email.ts`),
    `canales/{types,email,whatsapp,registry}.ts`, `service.enviarMensaje`, acción + botón.
    **Checkpoint 9:** aprobar → enviar EMAIL local → correo recibido + `cobranza_interaccion`
    SALIENTE + `estado='ENVIADO'`; WhatsApp en demo loguea.
11. Sentimiento: `ia/sentimiento.ts`, `app/api/cobranza/sentimiento/route.ts`, tab
    Interacciones + loop + acción `registrarNotaInteraccion`. **Checkpoint 10:** analizar
    interacciones sembradas; "voy a cancelar" → `MUY_NEGATIVO`, `riesgo_cancelacion='ALTO'`.
12. Dashboard: `lib/cobranza/dashboard.ts` + `cobranza/tablero/page.tsx`. **Checkpoint 11:**
    números cuadran con la lista; alertas incluyen sentimiento negativo + mora acelerada.
13. Reportes: `lib/cobranza/reportes.ts` + `app/api/cobranza/reporte/route.ts` + botones +
    resumen gerencial. **Checkpoint 12:** CSV abre en hoja de cálculo; totales cuadran.
14. Webhook + cron: `app/api/cobranza/webhook/whatsapp/route.ts` + `cron/aging/route.ts` +
    `vercel.json`. **Checkpoint 13:** `curl` al webhook → interacción; `curl` al cron con
    bearer → borradores `PENDIENTE`, idempotente.
15. PORT de pagos: `lib/cobranza/pagos/gateway.ts`. Sin UI. **Checkpoint 14:** typecheck.
16. Cierre: `npm run lint`, `npm run build`, E2E completo (§Verificación), re-chequeo del ER doc.

## Verificación end-to-end (local)

`npm run dev`; login como `ADMIN_ASEGURADORA` de "Aseguradora Demo".

1. `/aseguradora/cobranza`: cartera sembrada, KPIs, segmentos; filtrar por Segmento.
2. Póliza **MORA_MEDIA** → "Preparar gestión" → "Generar" → borrador con tono **FORMAL**.
   Póliza **MORA_TEMPRANA** → tono **RECORDATORIO/AMIGABLE**, claramente distinto.
3. Editar cuerpo → "Guardar edición" (`dirty` se limpia) → "Aprobar" → "Enviar" (EMAIL).
   Verificar buzón `onewayec81+cobNN@gmail.com`, `cobranza_mensaje.estado='ENVIADO'`,
   `cobranza_interaccion` SALIENTE, filas en `auditoria` (`GENERACION`, `EDICION`,
   `APROBACION`, `ENVIO`).
4. Tab **Interacciones** → "Analizar sentimiento" → badges se llenan; "voy a cancelar el
   seguro" → `MUY_NEGATIVO`, `riesgo_cancelacion='ALTO'`, `senales` con la frase.
5. `/aseguradora/cobranza/tablero` → proyección 30/60/90 + alertas tempranas que incluyen esa
   póliza (sentimiento negativo) y las de mora acelerada.
6. Descargar CSV (`/api/cobranza/reporte?tipo=cartera`) y ver el resumen gerencial.
7. WhatsApp inbound: `curl -X POST '.../api/cobranza/webhook/whatsapp' -H 'X-Webhook-Secret: …'
   -d '<payload inbound>'` → `cobranza_interaccion` ENTRANTE, `sentimiento_estado='PENDIENTE'`;
   correr loop de sentimiento. Aprobar+enviar un borrador **WHATSAPP** → consola muestra envío
   simulado (demo), `estado='ENVIADO'`.
8. Cron: `curl '.../api/cobranza/cron/aging' -H 'Authorization: Bearer $CRON_SECRET'` → prepara
   borradores idempotentemente (repetir no duplica).
9. `npm run build` limpio.

## Fuera de alcance / Fase 1.5+ (split explícito)

- Motor real de cobranza: aging productivo, registro real de `pago`, transiciones
  `poliza.estado`, recargos/interés por mora, días de gracia, planes de pago/refinanciación.
- WhatsApp real con media + callbacks de estado de entrega + tabla `cobranza_envio` (historial).
- Auto-envío sin humano para `AL_DIA`/`MORA_TEMPRANA` (Fase 1 exige aprobación humana siempre).
- Workflows reales de n8n (Fase 1 solo **expone** route handlers + webhook).
- Cron que genere/prepare borradores desatendido (Fase 1: el cron solo marca `PENDIENTE`).
- Programación/envío de reportes por correo a gerencia.
- Pasarela de pago real (Datafast/Kushki/PayPhone) — requiere motor real + registro de `pago` (Fase 2).
- Chatbot conversacional de cliente y vista "mi saldo" en `/mi-cuenta` (Fase 2).
- Voicebot de telefonía (servicio externo, fase futura — o descartado).
- Scoring predictivo con ML (Fase 1 es heurística por reglas).

## Riesgos

- **Costo/latencia LLM**: modelo barato, lotes ≤ 4–6, loop conducido por el navegador — mismo
  patrón que inspección.
- **Refactor de `lib/inspeccion/analisis.ts`** al extraer el singleton OpenAI: cambio mínimo,
  un solo call-site, verificado por Checkpoint 4. Alternativa blindada: duplicar el singleton
  en `lib/cobranza/ia/client.ts`.
- **Semántica de `dias_mora` / `estado='VENCIDO'`**: `v_poliza_cobranza` es stand-in de Fase 1;
  `segmentar()` es puro e independiente de la vista para sobrevivir al motor real.
- **Scope multi-tenant**: centralizar en `assertInsurerOwnsPoliza` + join obligatorio
  `poliza → cotizacion.aseguradora_id` en TODA query; nunca confiar en el `polizaId` del cliente.
- **Match teléfono→póliza del webhook** difuso: `cobranza_interaccion.poliza_id` NULLABLE +
  `contacto` para reconciliación posterior.
- **Secreto del webhook**: en header, no en query string (logs).
- **Vercel Cron solo en prod**: probar local por `curl`; confirmar manejo de `CRON_SECRET`.
