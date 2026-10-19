"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Headset, MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";

/**
 * Asistente de soporte flotante (MOCKUP). El botón se puede arrastrar a cualquier
 * parte de la pantalla y abre un chat con respuestas simuladas; no hay backend ni IA real.
 */

type Scope = "insurer" | "channel";
type Message = { id: number; from: "bot" | "user"; text: string; support?: boolean };
type Pos = { x: number; y: number };

const SUPPORT_PHONE = "+593984035410";
const SUPPORT_PHONE_LABEL = "+593 98 403 5410";
const CALL_URL = `tel:${SUPPORT_PHONE}`;
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE.slice(1)}?text=${encodeURIComponent("Hola, necesito ayuda urgente con la plataforma Kuantiq.")}`;
const BUTTON = 56;
const MARGIN = 16;
const PANEL_W = 380;
const PANEL_H = 560;

const FAQ: Record<Scope, { q: string; keys: string[]; a: string }[]> = {
  insurer: [
    { q: "¿Cómo creo un producto?", keys: ["producto", "parametriz"], a: "Ve a Productos y pulsa «Nuevo producto». Define nombre, ramo y vigencia; luego entra al detalle para parametrizar coberturas, deducibles y tarifas. El producto solo se ofrece a los canales cuando está activo." },
    { q: "¿Cómo apruebo una inspección?", keys: ["inspecci", "foto", "daño"], a: "En Inspecciones abre la solicitud pendiente. Verás las fotos por posición y el análisis de daños de la IA. Puedes ajustar los hallazgos del técnico y luego pulsar «Aprobar» o «Rechazar» indicando el motivo." },
    { q: "¿Cómo emito una póliza pendiente?", keys: ["emit", "emisión", "pendiente", "póliza", "poliza"], a: "En Pendientes de emisión elige la cotización. Revisa el detalle del cálculo; si hace falta, recalcula la prima. Al confirmar, la póliza pasa a Pólizas emitidas y el canal recibe el certificado." },
    { q: "¿Cómo descargo el reporte de pagos?", keys: ["pago", "reporte", "excel", "descarg"], a: "En Pagos filtra por período y canal, y pulsa «Descargar Excel». El archivo incluye las cuotas cobradas, la prima neta y la comisión por canal." },
    { q: "¿Cómo creo un usuario de canal?", keys: ["usuario", "agente", "credencial", "contraseña"], a: "En Usuarios de canal abre «Nuevo usuario», asígnalo a uno de tus canales y define una contraseña temporal de al menos 10 caracteres. Puedes desactivarlo cuando quieras." },
  ],
  channel: [
    { q: "¿Cómo creo una orden de emisión?", keys: ["orden", "emisión", "cotiz", "nueva"], a: "En Órdenes de Emisión pulsa «Nueva». Ingresa los datos del cliente y del vehículo, elige el plan y envía la orden. La aseguradora la revisa y emite la póliza." },
    { q: "¿Cómo cancelo un certificado?", keys: ["cancel", "anular", "certificado"], a: "En Cancelaciones → Individual busca el certificado por número o cliente, indica el motivo y la fecha efectiva. El sistema calcula la nivelación de las cuotas antes de confirmar." },
    { q: "¿Qué es la carga masiva de cancelaciones?", keys: ["masiva", "excel", "carga", "archivo"], a: "Permite cancelar varios certificados a la vez subiendo un Excel con la plantilla del sistema. Antes de aplicar los cambios verás una validación fila por fila." },
    { q: "¿Dónde veo mis pagos?", keys: ["pago", "cuota", "cobro"], a: "En Pagos tienes las cuotas por período con su estado (pagada, pendiente, vencida) y los totales del mes." },
    { q: "¿Cómo uso la calculadora Tradicional?", keys: ["tradicional", "calculadora", "anual"], a: "En Tradicional ingresa el valor asegurado y las características del vehículo para estimar la prima anual de un seguro tradicional y compararla con el plan mensual." },
  ],
};

const FALLBACK = `Todavía estoy aprendiendo sobre ese tema 🤖. Pronto podré ayudarte con más consultas. Si es urgente, comunícate con soporte técnico al ${SUPPORT_PHONE_LABEL}.`;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
const clampPos = (p: Pos): Pos => ({ x: clamp(p.x, MARGIN, window.innerWidth - BUTTON - MARGIN), y: clamp(p.y, MARGIN, window.innerHeight - BUTTON - MARGIN) });
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function answer(scope: Scope, text: string) {
  const t = normalize(text);
  const hit = FAQ[scope].find((f) => normalize(f.q) === t) ?? FAQ[scope].find((f) => f.keys.some((k) => t.includes(normalize(k))));
  return hit?.a ?? FALLBACK;
}

export function SupportAssistant({ scope }: { scope: Scope }) {
  const storageKey = `kuantiq:support-pos:${scope}`;
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "bot", text: "¡Hola! Soy el asistente de Kuantiq. Elige una pregunta frecuente o escríbeme tu consulta." }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean; last?: Pos } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const save = useCallback((p: Pos) => { try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch {} }, [storageKey]);

  // Posición inicial (guardada o esquina inferior derecha) y reajuste al redimensionar.
  useEffect(() => {
    let initial: Pos = { x: window.innerWidth - BUTTON - 24, y: window.innerHeight - BUTTON - 24 };
    try { const raw = localStorage.getItem(storageKey); if (raw) initial = JSON.parse(raw) as Pos; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la posición depende de window/localStorage, solo disponibles en el cliente
    setPos(clampPos(initial));
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, typing, open]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    d.last = clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    setPos(d.last);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.moved) { if (d.last) save(d.last); } else setOpen((o) => !o);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const delta: Record<string, Pos> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const m = delta[e.key];
    if (m && pos) { e.preventDefault(); const p = clampPos({ x: pos.x + m.x, y: pos.y + m.y }); setPos(p); save(p); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text: q }]);
    setDraft("");
    setTyping(true);
    const reply = answer(scope, q);
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: nextId.current++, from: "bot", text: reply, support: reply === FALLBACK }]);
      setTyping(false);
    }, Math.min(1200, 400 + reply.length * 3));
  };

  if (!pos) return null;

  // El panel se abre hacia el lado con más espacio respecto al botón.
  const vw = window.innerWidth, vh = window.innerHeight;
  const panelW = Math.min(PANEL_W, vw - 2 * MARGIN);
  const panelH = Math.min(PANEL_H, vh - 2 * MARGIN);
  const left = clamp(pos.x + BUTTON / 2 > vw / 2 ? pos.x + BUTTON - panelW : pos.x, MARGIN, vw - panelW - MARGIN);
  const top = clamp(pos.y + BUTTON / 2 > vh / 2 ? pos.y - panelH - 12 : pos.y + BUTTON + 12, MARGIN, vh - panelH - MARGIN);

  return <>
    {open && <section role="dialog" aria-label="Asistente de soporte" style={{ left, top, width: panelW, height: panelH }} className="fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-line bg-white/95 text-ink shadow-2xl backdrop-blur-xl max-sm:inset-x-3! max-sm:top-auto! max-sm:bottom-3! max-sm:h-[min(85dvh,560px)]! max-sm:w-auto!">
      <header className="flex items-center gap-3 border-b border-line bg-ink px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand"><Bot className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Asistente Kuantiq</p><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand"><Sparkles className="size-3" />Beta · IA</p></div>
        <button type="button" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white" aria-label="Cerrar soporte"><X className="size-4" /></button>
      </header>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        <p className="flex gap-2"><Headset className="mt-0.5 size-4 shrink-0" /><span>Si deseas comunicarte de manera <strong>urgente</strong> con soporte técnico, <a href={CALL_URL} className="font-bold underline underline-offset-2">llámanos</a> o <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">escríbenos por WhatsApp</a> al <a href={CALL_URL} className="font-bold underline underline-offset-2 whitespace-nowrap">{SUPPORT_PHONE_LABEL}</a>.</span></p>
        <div className="mt-2 flex gap-2 pl-6">
          <a href={CALL_URL} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 font-bold hover:bg-amber-100"><Phone className="size-3.5" />Llamar</a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#25D366] px-3 font-bold text-white hover:bg-[#1ebe5a]"><MessageCircle className="size-3.5" />WhatsApp</a>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-surface-muted px-4 py-4">
        {messages.map((m) => <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${m.from === "user" ? "rounded-br-md bg-brand text-ink-strong" : "rounded-bl-md border border-line bg-white"}`}>{m.text}{m.support && <span className="mt-2.5 flex flex-wrap gap-2"><a href={CALL_URL} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold hover:bg-ink/5"><Phone className="size-3.5" />Llamar</a><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-bold text-white hover:bg-[#1ebe5a]"><MessageCircle className="size-3.5" />Escribir por WhatsApp</a></span>}</p></div>)}
        {typing && <div className="flex"><p className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-3" aria-label="El asistente está escribiendo">{[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink-subtle" style={{ animationDelay: `${d}ms` }} />)}</p></div>}
        <div className="pt-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Preguntas frecuentes</p>
          <div className="flex flex-wrap gap-2">{FAQ[scope].map((f) => <button key={f.q} type="button" disabled={typing} onClick={() => ask(f.q)} className="rounded-full border border-brand/30 bg-white px-3 py-1.5 text-left text-xs font-semibold text-brand-text hover:bg-brand/10 disabled:opacity-50">{f.q}</button>)}</div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} className="flex items-center gap-2 border-t border-line bg-white px-3 py-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe tu consulta…" aria-label="Escribe tu consulta" className="min-h-10 flex-1 rounded-full border border-line bg-surface-muted px-4 text-sm outline-none focus:border-brand" />
        <button type="submit" disabled={!draft.trim() || typing} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-ink-strong hover:bg-brand-strong disabled:opacity-40" aria-label="Enviar"><Send className="size-4" /></button>
      </form>
      <p className="bg-white pb-2 text-center text-[10px] text-ink-subtle">Mockup · Las respuestas son de demostración</p>
    </section>}

    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      style={{ left: pos.x, top: pos.y, width: BUTTON, height: BUTTON, touchAction: "none" }}
      className={`fixed z-50 flex select-none items-center justify-center rounded-full bg-brand text-ink-strong shadow-lg shadow-brand/30 ring-4 ring-white/70 transition-[transform,box-shadow] ${dragging ? "scale-110 cursor-grabbing shadow-2xl" : "cursor-grab hover:scale-105"}`}
      aria-label={open ? "Cerrar soporte" : "Abrir soporte (arrastra para moverlo)"}
      aria-expanded={open}
      title="Soporte · arrastra para moverlo"
    >
      {open ? <X className="size-6" /> : <Headset className="size-6" />}
      {!open && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">IA</span>}
    </button>
  </>;
}
