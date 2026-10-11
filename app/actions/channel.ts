"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireChannelUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createQuoteWithConnection, QuoteConfigurationError } from "@/lib/quotes/create-quote";
import { getDbPool } from "@/lib/db/pool";
import { certificateSignedUrl, deliverCertificate, deliverRefreshedCertificate, downloadCertificate, prepareCertificate, refreshCertificate, removeCertificateFiles, renderCertificatePreview, restoreCertificateFile } from "@/lib/certificates/issue";
import { loadCertificateData } from "@/lib/certificates/data";
import { CertificateDeliveryError, normalizeEcuadorPhone, sendCertificateEmail, sendCertificateWhatsApp, verifyEmailDomain, type DeliveryChannel } from "@/lib/certificates/send";
import { deletePendingChannelQuote, QuoteDeletionError } from "@/lib/quotes/delete-pending-quote";
import type { ChannelActionState } from "@/lib/channel/action-state";
import { clientSchema, dateOnly } from "@/lib/channel/schemas";
import { BULK_MAX_BYTES, loadBulkCatalog, parseBulkWorkbook, saveBulkOrders, validateBulkRows, verifyBulkEmails, type BulkRowResult } from "@/lib/channel/bulk-orders";
import type { QuoteActionState } from "@/lib/quotes/types";

export async function saveAssistedClient(_:ChannelActionState,formData:FormData):Promise<ChannelActionState>{const session=await requireChannelUser();const parsed=clientSchema.safeParse({name:formData.get("name"),identification:formData.get("identification"),email:formData.get("email"),phone:formData.get("phone"),cityId:formData.get("cityId"),birthDate:formData.get("birthDate"),gender:formData.get("gender"),maritalStatus:formData.get("maritalStatus"),address:formData.get("address")||""});if(!parsed.success)return{status:"error",message:"Revisa los datos del cliente.",fields:parsed.error.flatten().fieldErrors as Record<string,string[]>};const db=createAdminClient();const{data:existing}=await db.from("cliente").select("id,nombre_razon_social,email,identificacion").or(`identificacion.eq.${parsed.data.identification},email.ilike.${parsed.data.email}`).limit(1).maybeSingle();let clientId=existing?.id;if(!clientId){const{data,error}=await db.from("cliente").insert({tipo_cliente:"INDIVIDUAL",nombre_razon_social:parsed.data.name,identificacion:parsed.data.identification,email:parsed.data.email,password_hash:null,telefono:parsed.data.phone,ciudad_id:parsed.data.cityId,direccion:parsed.data.address||null,fecha_nacimiento:parsed.data.birthDate,genero:parsed.data.gender,estado_civil:parsed.data.maritalStatus.toUpperCase(),activo:true,estado_registro:"SIN_ACCESO"}).select("id").single();if(error)return{status:"error",message:error.code==="23505"?"Ya existe un cliente con esa identificación o correo.":"No pudimos registrar al cliente."};clientId=data.id;}const{error:linkError}=await db.from("canal_cliente").upsert({canal_id:session.channelId!,cliente_id:clientId,creado_por_usuario_id:session.actorId},{onConflict:"canal_id,cliente_id"});if(linkError)return{status:"error",message:"El cliente existe, pero no pudimos vincularlo con el canal."};await db.from("auditoria").insert({entidad:existing?"CANAL_CLIENTE":"CLIENTE",entidad_id:clientId,accion:"CREACION",datos_nuevos:{canal_id:session.channelId,origen:"CANAL",cliente_nuevo:!existing},usuario_id:session.actorId});revalidatePath("/canal/clientes");return{status:"success",message:existing?`Cliente existente vinculado: ${existing.nombre_razon_social}.`:"Cliente registrado y vinculado correctamente.",clientId};}

export async function linkExistingClient(formData:FormData){const session=await requireChannelUser();const parsed=z.object({clientId:z.string().uuid(),identification:z.string().min(5)}).safeParse({clientId:formData.get("clientId"),identification:formData.get("identification")});if(!parsed.success)return;const db=createAdminClient();const{data}=await db.from("cliente").select("id").eq("id",parsed.data.clientId).eq("identificacion",parsed.data.identification).maybeSingle();if(data)await db.from("canal_cliente").upsert({canal_id:session.channelId!,cliente_id:data.id,creado_por_usuario_id:session.actorId},{onConflict:"canal_id,cliente_id"});revalidatePath("/canal/clientes");redirect(`/canal/cotizaciones/nueva?cliente=${parsed.data.clientId}`);}

export type ClienteGlobalMatch={id:string;nombre:string;identificacion:string|null;email:string;linked:boolean};
// Búsqueda de coincidencia exacta por identificación o correo. Kuantix no expone el directorio global por nombre.
export async function buscarClienteGlobal(q:string):Promise<ClienteGlobalMatch|null>{const session=await requireChannelUser();const term=(q||"").trim();if(term.length<5)return null;const db=createAdminClient();const isEmail=term.includes("@");const{data:cliente}=isEmail?await db.from("cliente").select("id,nombre_razon_social,identificacion,email").ilike("email",term).maybeSingle():await db.from("cliente").select("id,nombre_razon_social,identificacion,email").eq("identificacion",term.replace(/\D/g,"")).maybeSingle();if(!cliente)return null;const{data:link}=await db.from("canal_cliente").select("cliente_id").eq("canal_id",session.channelId!).eq("cliente_id",cliente.id).maybeSingle();return{id:cliente.id,nombre:cliente.nombre_razon_social,identificacion:cliente.identificacion,email:cliente.email,linked:Boolean(link)};}

const quoteSchema=z.object({clientId:z.string().uuid(),productId:z.string().uuid(),vehicleMode:z.enum(["new","existing"]),existingVehicleId:z.string().uuid().optional().or(z.literal("")),vehicleTypeId:z.string().uuid().optional().or(z.literal("")),brand:z.string().trim().max(80).optional(),model:z.string().trim().max(80).optional(),year:z.coerce.number().int().min(1950).max(new Date().getFullYear()+1).optional(),color:z.string().trim().max(50).optional(),insuredValue:z.coerce.number().positive().max(5_000_000).optional(),vehicleStatus:z.enum(["NUEVO","USADO"]).optional(),use:z.enum(["COMERCIAL","PARTICULAR","CORPORATIVO"]).optional(),plate:z.string().trim().max(15).optional(),durationYears:z.coerce.number().int().min(1).max(5),startDate:z.string().date(),coverageIds:z.array(z.string().uuid()).min(1,"Selecciona al menos una cobertura.")}).superRefine((d,c)=>{if(d.vehicleMode==="existing"&&!d.existingVehicleId)c.addIssue({code:"custom",path:["existingVehicleId"],message:"Selecciona un vehículo."});if(d.vehicleMode==="new")for(const field of ["vehicleTypeId","brand","model","year","color","insuredValue","vehicleStatus","use"] as const)if(d[field]===undefined||d[field]==="")c.addIssue({code:"custom",path:[field],message:"Este campo es obligatorio."});const today=dateOnly(new Date()),max=dateOnly(new Date(Date.now()+90*86400000));if(d.startDate<today||d.startDate>max)c.addIssue({code:"custom",path:["startDate"],message:"La fecha debe estar entre hoy y los próximos 90 días."});});
type AssistedQuoteInput = Parameters<typeof createQuoteWithConnection>[1];

/** Valida el formulario del asistente del canal y arma la entrada del motor de cálculo. */
function parseAssistedQuote(formData: FormData, session: Awaited<ReturnType<typeof requireChannelUser>>): { input: AssistedQuoteInput } | { error: QuoteActionState } {
  const parsed = quoteSchema.safeParse({ clientId: formData.get("clientId"), productId: formData.get("productId"), vehicleMode: formData.get("vehicleMode"), existingVehicleId: formData.get("existingVehicleId") || "", vehicleTypeId: formData.get("vehicleTypeId") || "", brand: formData.get("brand") || "", model: formData.get("model") || "", year: formData.get("year") || undefined, color: formData.get("color") || "", insuredValue: formData.get("insuredValue") || undefined, vehicleStatus: formData.get("vehicleStatus") || undefined, use: formData.get("use") || undefined, plate: formData.get("plate") || "", durationYears: formData.get("durationYears"), startDate: formData.get("startDate"), coverageIds: formData.getAll("coverageIds") });
  if (!parsed.success) return { error: { status: "error", message: "Revisa los datos indicados para continuar.", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> } };
  const d = parsed.data;
  return { input: { clientId: d.clientId, productId: d.productId, existingVehicleId: d.vehicleMode === "existing" ? d.existingVehicleId || undefined : undefined, vehicleTypeId: d.vehicleTypeId || undefined, brand: d.brand, model: d.model, year: d.year, color: d.color, insuredValue: d.insuredValue, vehicleStatus: d.vehicleStatus, use: d.use, plate: d.plate, durationYears: d.durationYears, coverageIds: [...new Set(d.coverageIds)], coverageStartDate: d.startDate, assistedBy: { userId: session.actorId, insurerId: session.insurerId!, channelId: session.channelId! } } };
}

/**
 * Paso 1 del registro manual: calcula la Orden de Emisión y genera la vista
 * previa del certificado SIN guardar nada (la transacción se revierte).
 */
export async function previewAssistedQuote(_: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const session = await requireChannelUser();
  const parsed = parseAssistedQuote(formData, session);
  if ("error" in parsed) return parsed.error;
  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    const quoteId = await createQuoteWithConnection(conn, parsed.input);
    const { data, pdf } = await renderCertificatePreview(conn, quoteId);
    return {
      status: "preview",
      preview: { pdf: Buffer.from(pdf).toString("base64"), clientName: data.client.name, email: data.client.email, phone: normalizeEcuadorPhone(data.client.phone) },
    };
  } catch (error) {
    console.error("Error al calcular la Orden de Emisión", error);
    return { status: "error", message: error instanceof QuoteConfigurationError ? error.message : "No pudimos calcular la Orden de Emisión. No se guardó ningún dato." };
  } finally {
    await conn.query("rollback").catch(() => {});
    conn.release();
  }
}

export type FinalizeQuoteState =
  | { status: "error"; message: string }
  | { status: "sent"; quoteId: string; number: string; channel: DeliveryChannel; destination: string; pdf: string };

/**
 * Paso 2 del registro manual: crea la orden, emite el certificado y lo envía.
 * Solo se confirma (commit) si el envío fue exitoso (regla 17 del ER).
 */
export async function finalizeAssistedQuote(formData: FormData): Promise<FinalizeQuoteState> {
  const session = await requireChannelUser();
  const channel = formData.get("deliveryChannel");
  if (channel !== "CORREO" && channel !== "WHATSAPP") return { status: "error", message: "Elige cómo enviar el certificado." };
  const parsed = parseAssistedQuote(formData, session);
  if ("error" in parsed) return { status: "error", message: parsed.error.message ?? "Revisa los datos de la Orden de Emisión." };
  const conn = await getDbPool().connect();
  let uploaded: string | null = null;
  try {
    await conn.query("begin");
    const quoteId = await createQuoteWithConnection(conn, parsed.input);
    const cert = await prepareCertificate(conn, quoteId);
    uploaded = cert.path;
    const destination = channel === "CORREO" ? cert.data.client.email : cert.data.client.phone;
    if (!destination) throw new CertificateDeliveryError(channel === "CORREO" ? "El cliente no tiene correo registrado." : "El cliente no tiene teléfono registrado.");
    if (channel === "CORREO" && !(await verifyEmailDomain(destination))) throw new CertificateDeliveryError(`El dominio del correo ${destination} no recibe correos.`);
    const sent = await deliverCertificate(conn, cert, { channel, destination, userId: session.actorId });
    await conn.query("commit");
    uploaded = null;
    revalidatePath("/canal/cotizaciones");
    revalidatePath("/canal");
    return { status: "sent", quoteId, number: cert.data.number, channel, destination: sent.to, pdf: Buffer.from(cert.pdf).toString("base64") };
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    if (uploaded) await removeCertificateFiles([uploaded]);
    if (error instanceof CertificateDeliveryError || error instanceof QuoteConfigurationError) return { status: "error", message: `${error.message} No se guardó la Orden de Emisión.` };
    console.error("Error al registrar la Orden de Emisión", error);
    return { status: "error", message: "No pudimos registrar la Orden de Emisión. No se guardó ningún dato." };
  } finally {
    conn.release();
  }
}

const channelOrderEditSchema = clientSchema.extend({
  quoteId: z.string().uuid(),
  productId: z.string().uuid(),
  vehicleTypeId: z.string().uuid(),
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  color: z.string().trim().min(1).max(50),
  insuredValue: z.coerce.number().positive().max(5_000_000),
  vehicleStatus: z.enum(["NUEVO", "USADO"]),
  use: z.enum(["COMERCIAL", "PARTICULAR", "CORPORATIVO"]),
  plate: z.string().trim().max(15).optional(),
  durationYears: z.coerce.number().int().min(1).max(5),
  startDate: z.string().date(),
  coverageIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una cobertura."),
  deliveryChannel: z.enum(["CORREO", "WHATSAPP"]),
});

/**
 * Corrige una Orden de Emisión pendiente del propio canal y vuelve a entregar
 * su único certificado con la información recalculada.
 */
export async function updateChannelOrder(_: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const session = await requireChannelUser();
  const parsed = channelOrderEditSchema.safeParse({
    quoteId: formData.get("quoteId"), productId: formData.get("productId"), vehicleTypeId: formData.get("vehicleTypeId"),
    brand: formData.get("brand"), model: formData.get("model"), year: formData.get("year"), color: formData.get("color"),
    insuredValue: formData.get("insuredValue"), vehicleStatus: formData.get("vehicleStatus"), use: formData.get("use"), plate: formData.get("plate") || "",
    durationYears: formData.get("durationYears"), startDate: formData.get("startDate"), coverageIds: formData.getAll("coverageIds"),
    deliveryChannel: formData.get("deliveryChannel"), name: formData.get("name"), identification: formData.get("identification"),
    email: formData.get("email"), phone: formData.get("phone"), cityId: formData.get("cityId"), birthDate: formData.get("birthDate"),
    gender: formData.get("gender"), maritalStatus: formData.get("maritalStatus"), address: formData.get("address") || "",
  });
  if (!parsed.success) return { status: "error", message: "Revisa los datos de la Orden de Emisión.", fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const value = parsed.data;
  const conn = await getDbPool().connect();
  let uploadedPath: string | null = null;
  let restore: { path: string; pdf: Uint8Array } | null = null;
  try {
    await conn.query("begin");
    const access = await conn.query<{ cliente_id: string }>(
      `select c.cliente_id from cotizacion c
       join canal_cliente cc on cc.canal_id=c.canal_id and cc.cliente_id=c.cliente_id
       where c.id=$1 and c.canal_id=$2 and c.origen='CANAL' and c.estado='PENDIENTE'
         and not exists (select 1 from poliza p where p.cotizacion_id=c.id)
       for update`,
      [value.quoteId, session.channelId],
    );
    if (access.rowCount !== 1) throw new QuoteConfigurationError("La Orden de Emisión no está disponible para editar en este canal.");

    const client = await conn.query(
      `update cliente set nombre_razon_social=$2, identificacion=$3, email=$4, telefono=$5,
         ciudad_id=$6, direccion=nullif($7,''), fecha_nacimiento=$8::date, genero=$9,
         estado_civil=$10
       where id=$1 and activo=true
       returning id`,
      [access.rows[0].cliente_id, value.name, value.identification, value.email, value.phone, value.cityId, value.address || "", value.birthDate, value.gender, value.maritalStatus.toUpperCase()],
    );
    if (client.rowCount !== 1) throw new QuoteConfigurationError("No pudimos actualizar los datos del titular.");
    await conn.query(
      `insert into auditoria (entidad,entidad_id,accion,datos_nuevos,usuario_id)
       values ('CLIENTE',$1,'EDICION',jsonb_build_object('origen','CORRECCION_ORDEN_EMISION','cotizacion_id',$2::text),$3)`,
      [access.rows[0].cliente_id, value.quoteId, session.actorId],
    );

    await createQuoteWithConnection(conn, {
      clientId: "", productId: value.productId, vehicleTypeId: value.vehicleTypeId, brand: value.brand, model: value.model,
      year: value.year, color: value.color, insuredValue: value.insuredValue, vehicleStatus: value.vehicleStatus, use: value.use,
      plate: value.plate, durationYears: value.durationYears, coverageIds: [...new Set(value.coverageIds)], coverageStartDate: value.startDate,
      editQuoteId: value.quoteId, editInsurerId: session.insurerId!, editChannelId: session.channelId!, editUserId: session.actorId,
    });

    const existing = await conn.query<{ id: string; numero: string; storage_path: string }>(
      "select id,numero,storage_path from certificado_cobertura where cotizacion_id=$1 for update", [value.quoteId],
    );
    let certificate;
    if (existing.rowCount) {
      const current = existing.rows[0];
      const refreshed = await refreshCertificate(conn, { quoteId: value.quoteId, number: current.numero, path: current.storage_path });
      certificate = refreshed;
      if (refreshed.previousPdf) restore = { path: refreshed.path, pdf: refreshed.previousPdf };
    } else {
      certificate = await prepareCertificate(conn, value.quoteId);
      uploadedPath = certificate.path;
    }
    const destination = value.deliveryChannel === "CORREO" ? certificate.data.client.email : certificate.data.client.phone;
    if (!destination) throw new CertificateDeliveryError(value.deliveryChannel === "CORREO" ? "El cliente no tiene correo registrado." : "El cliente no tiene teléfono registrado.");
    if (value.deliveryChannel === "CORREO" && !(await verifyEmailDomain(destination))) throw new CertificateDeliveryError(`El dominio del correo ${destination} no recibe correos.`);
    const sent = existing.rowCount
      ? await deliverRefreshedCertificate(conn, certificate, { channel: value.deliveryChannel, destination, userId: session.actorId })
      : await deliverCertificate(conn, certificate, { channel: value.deliveryChannel, destination, userId: session.actorId });
    const certificateId = existing.rowCount
      ? existing.rows[0].id
      : (await conn.query<{ id: string }>("select id from certificado_cobertura where cotizacion_id=$1", [value.quoteId])).rows[0]?.id;
    if (!certificateId) throw new CertificateDeliveryError("No pudimos registrar el certificado actualizado.");
    await conn.query(
      `insert into auditoria (entidad,entidad_id,accion,datos_nuevos,usuario_id)
       values ('CERTIFICADO_COBERTURA',$1,'EDICION',jsonb_build_object('correccion_orden',true,'canal',$2::text,'destino',$3::text,'mensaje_id',$4::text),$5)`,
      [certificateId, value.deliveryChannel, sent.to, sent.messageId, session.actorId],
    );
    await conn.query("commit");
    uploadedPath = null;
    restore = null;
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    if (uploadedPath) await removeCertificateFiles([uploadedPath]);
    if (restore) await restoreCertificateFile(restore.path, restore.pdf);
    if (error instanceof QuoteConfigurationError || error instanceof CertificateDeliveryError) return { status: "error", message: `${error.message} No se guardó ningún cambio.` };
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "23505") return { status: "error", message: "La cédula/RUC o el correo ya pertenecen a otro cliente. No se guardó ningún cambio." };
    console.error("Error al corregir la Orden de Emisión", error);
    return { status: "error", message: "No pudimos actualizar la Orden de Emisión. No se guardó ningún cambio." };
  } finally {
    conn.release();
  }
  revalidatePath("/canal/cotizaciones");
  revalidatePath(`/canal/cotizaciones/${value.quoteId}`);
  revalidatePath("/canal/clientes");
  revalidatePath("/canal");
  redirect(`/canal/cotizaciones/${value.quoteId}?actualizada=1`);
}

// Borrado físico de una Orden de Emisión pendiente del canal (no se marca como RECHAZADA).
export async function deleteChannelQuote(_:ChannelActionState,formData:FormData):Promise<ChannelActionState>{
  const session=await requireChannelUser();
  const parsed=z.string().uuid().safeParse(formData.get("quoteId"));
  if(!parsed.success)return{status:"error",message:"Orden de Emisión inválida."};
  try{
    await deletePendingChannelQuote({quoteId:parsed.data,channelId:session.channelId!});
  }catch(error){
    if(error instanceof QuoteDeletionError)return{status:"error",message:error.message};
    console.error("Error al eliminar la Orden de Emisión",error);
    return{status:"error",message:"No pudimos eliminar la Orden de Emisión. Inténtalo nuevamente."};
  }
  revalidatePath("/canal/cotizaciones");
  revalidatePath("/canal");
  redirect("/canal/cotizaciones?eliminada=1");
}

// ── Carga masiva de Órdenes de Emisión ──────────────────────────────────────
export type BulkUploadState = { status: "idle" | "ready" | "error" | "saved"; message?: string; rows: BulkRowResult[]; alreadySent?: string[] };

const bulkScopeSchema = z.object({ productId: z.string().uuid() });

/** Valida reglas, catálogos y el cálculo completo de cada fila (transacción revertida). */
/** Toda la carga usa las coberturas activas del producto (no se eligen en pantalla). */
async function checkBulkRows(rows: BulkRowResult[], productId: string, save: boolean) {
  const session = await requireChannelUser();
  const scope = { insurerId: session.insurerId!, channelId: session.channelId!, userId: session.actorId };
  const catalog = await loadBulkCatalog(productId, scope);
  const coverageIds = catalog.coverages.map((c) => c.id);
  if (!coverageIds.length) throw new QuoteConfigurationError("El producto no tiene coberturas activas.");
  const validated = validateBulkRows(rows, catalog);
  const { resolved } = validated;
  // El certificado se envía por correo: el dominio debe poder recibir correos.
  const mailErrors = await verifyBulkEmails(validated.results.filter((r) => !r.errors.length).map((r) => ({ row: r.row, email: r.data.email.trim() })));
  const results = validated.results.map((r) => (mailErrors.has(r.row) ? { ...r, errors: [...r.errors, mailErrors.get(r.row)!] } : r));
  if (results.some((r) => r.errors.length)) return { results, saved: 0, alreadySent: [] as string[] };
  const numbers = results.map((r) => r.row);
  const { saved, errors, alreadySent } = await saveBulkOrders(numbers.map((n) => resolved.get(n)!), numbers, { productId, coverageIds, scope, dryRun: !save });
  return { results: results.map((r) => (errors.has(r.row) ? { ...r, errors: [errors.get(r.row)!] } : r)), saved, alreadySent };
}

export async function validateBulkUpload(_: BulkUploadState, formData: FormData): Promise<BulkUploadState> {
  const parsed = bulkScopeSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Selecciona el producto.", rows: [] };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { status: "error", message: "Selecciona el archivo de la plantilla.", rows: [] };
  if (file.size > BULK_MAX_BYTES) return { status: "error", message: "El archivo supera los 5 MB.", rows: [] };
  const { rows, error } = await parseBulkWorkbook(await file.arrayBuffer());
  if (error) return { status: "error", message: error, rows: [] };
  if (!rows.length) return { status: "error", message: "El archivo no tiene filas con datos.", rows: [] };
  try {
    const { results } = await checkBulkRows(rows, parsed.data.productId, false);
    const bad = results.filter((r) => r.errors.length).length;
    return { status: "ready", message: bad ? `${bad} de ${results.length} filas tienen errores.` : `${results.length} filas listas para guardar.`, rows: results };
  } catch (error) {
    if (error instanceof QuoteConfigurationError) return { status: "error", message: error.message, rows: [] };
    console.error("Error al validar la carga masiva", error);
    return { status: "error", message: "No pudimos validar el archivo. Inténtalo nuevamente.", rows: [] };
  }
}

export async function saveBulkUpload(input: { productId: string; rows: BulkRowResult[] }): Promise<BulkUploadState> {
  const parsed = bulkScopeSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Selecciona el producto.", rows: input.rows };
  if (!input.rows.length) return { status: "error", message: "No hay filas para guardar.", rows: [] };
  if (input.rows.length > 100) return { status: "error", message: "Máximo 100 filas por carga.", rows: input.rows };
  let saved = 0;
  try {
    const rows = input.rows.map((r) => ({ row: r.row, data: r.data, errors: [] }));
    const result = await checkBulkRows(rows, parsed.data.productId, true);
    if (!result.saved) {
      const bad = result.results.filter((r) => r.errors.length).length;
      return {
        status: "error",
        message: result.alreadySent.length
          ? `Falló el envío de un certificado y se revirtió toda la carga: no se guardó ninguna orden. ${result.alreadySent.length} clientes ya recibieron el correo; avísales que no es válido.`
          : `No se guardó ninguna orden: ${bad} ${bad === 1 ? "fila tiene" : "filas tienen"} errores.`,
        rows: result.results,
        alreadySent: result.alreadySent,
      };
    }
    saved = result.saved;
  } catch (error) {
    if (error instanceof QuoteConfigurationError) return { status: "error", message: error.message, rows: input.rows };
    console.error("Error al guardar la carga masiva", error);
    return { status: "error", message: "No pudimos guardar la carga. No se guardó ningún dato.", rows: input.rows };
  }
  revalidatePath("/canal/cotizaciones");
  revalidatePath("/canal");
  redirect(`/canal/cotizaciones?registradas=${saved}`);
}

// ── Reenvío del certificado (pantalla Clientes) ─────────────────────────────
export type ResendState = { status: "idle" } | { status: "error"; message: string } | { status: "sent"; channel: DeliveryChannel; destination: string };

/** Reenvía el certificado ya emitido de una Orden de Emisión del canal y lo registra en auditoría. */
export async function resendCertificate(quoteId: string, channel: DeliveryChannel): Promise<ResendState> {
  const session = await requireChannelUser();
  if (!z.string().uuid().safeParse(quoteId).success || (channel !== "CORREO" && channel !== "WHATSAPP")) return { status: "error", message: "Solicitud inválida." };
  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    const { rows } = await conn.query<{ id: string; numero: string; storage_path: string }>(
      `select cc.id, cc.numero, cc.storage_path from certificado_cobertura cc
       join cotizacion c on c.id = cc.cotizacion_id
       where c.id = $1 and c.canal_id = $2`,
      [quoteId, session.channelId],
    );
    if (!rows.length) throw new CertificateDeliveryError("La Orden de Emisión no tiene certificado.");
    const cert = rows[0];
    const data = await loadCertificateData(conn, quoteId, cert.numero);
    let sent: { messageId: string | null; to: string };
    if (channel === "CORREO") {
      const to = data.client.email;
      if (!to) throw new CertificateDeliveryError("El cliente no tiene correo registrado.");
      if (!(await verifyEmailDomain(to))) throw new CertificateDeliveryError(`El dominio del correo ${to} no recibe correos.`);
      const r = await sendCertificateEmail(to, data, await downloadCertificate(cert.storage_path));
      sent = { messageId: r.messageId, to };
    } else {
      if (!data.client.phone) throw new CertificateDeliveryError("El cliente no tiene teléfono registrado.");
      const url = await certificateSignedUrl(cert.storage_path, 7 * 24 * 3600);
      if (!url) throw new CertificateDeliveryError("No pudimos generar el enlace del PDF para WhatsApp.");
      sent = await sendCertificateWhatsApp(conn, data.client.phone, data, url);
    }
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
       values ('CERTIFICADO_COBERTURA', $1, 'EDICION', jsonb_build_object('reenvio', true, 'canal', $2::text, 'destino', $3::text, 'mensaje_id', $4::text), $5)`,
      [cert.id, channel, sent.to, sent.messageId, session.actorId],
    );
    await conn.query("commit");
    revalidatePath(`/canal/clientes/${quoteId}`);
    return { status: "sent", channel, destination: sent.to };
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    if (error instanceof CertificateDeliveryError) return { status: "error", message: error.message };
    console.error("Error al reenviar el certificado", error);
    return { status: "error", message: "No pudimos reenviar el certificado. Inténtalo nuevamente." };
  } finally {
    conn.release();
  }
}
