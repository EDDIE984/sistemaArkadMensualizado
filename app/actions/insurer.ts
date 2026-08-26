"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/crypto";
import { emitPolicy as runEmitPolicy, PolicyEmissionError } from "@/lib/policies/emit-policy";
import { createSelfServiceQuote, QuoteConfigurationError } from "@/lib/quotes/create-quote";
import type { InsurerActionState } from "@/lib/insurer/action-state";
import type { QuoteActionState } from "@/lib/quotes/types";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export async function saveChannel(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ id: optionalUuid, name: z.string().trim().min(2).max(100), description: z.string().trim().max(300).optional() }).safeParse({ id: formData.get("id") || "", name: formData.get("name"), description: formData.get("description") || "" });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const values = { aseguradora_id: session.insurerId!, nombre: parsed.data.name, descripcion: parsed.data.description || null };
  const db = createAdminClient();
  const result = parsed.data.id
    ? await db.from("canal").update(values).eq("id", parsed.data.id).eq("aseguradora_id", session.insurerId!)
    : await db.from("canal").insert(values);
  if (result.error) return failure(result.error.code === "23505" ? "Ya existe un canal con ese nombre." : "No pudimos guardar el canal.");
  revalidatePath("/aseguradora/canales"); return success("Canal guardado correctamente.");
}

export async function toggleChannel(formData: FormData) {
  const session = await requireInsurerAdmin(); const id = z.string().uuid().parse(formData.get("id")); const active = formData.get("active") === "true";
  await createAdminClient().from("canal").update({ activo: active }).eq("id", id).eq("aseguradora_id", session.insurerId!);
  revalidatePath("/aseguradora/canales");
}

export async function saveProduct(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ id: optionalUuid, name: z.string().trim().min(2).max(140), channelId: z.string().uuid(), branchId: z.string().uuid(), allCities: z.boolean(), commission: z.coerce.number().min(0).max(1).optional().default(0) }).safeParse({ id: formData.get("id") || "", name: formData.get("name"), channelId: formData.get("channelId"), branchId: formData.get("branchId"), allCities: formData.get("allCities") === "on", commission: formData.get("commission") ?? undefined });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const db = createAdminClient();
  const [{ data: channel }, { data: branch }] = await Promise.all([
    db.from("canal").select("id").eq("id", parsed.data.channelId).eq("aseguradora_id", session.insurerId!).eq("activo", true).maybeSingle(),
    db.from("aseguradora_ramo").select("id").eq("id", parsed.data.branchId).eq("aseguradora_id", session.insurerId!).eq("activo", true).maybeSingle(),
  ]);
  if (!channel || !branch) return failure("El canal o ramo no pertenece a tu aseguradora o está inactivo.");
  const values = { aseguradora_id: session.insurerId!, canal_id: channel.id, aseguradora_ramo_id: branch.id, nombre: parsed.data.name, aplica_todas_ciudades: parsed.data.allCities, comision_canal_pct: parsed.data.commission };
  const result = parsed.data.id
    ? await db.from("producto").update(values).eq("id", parsed.data.id).eq("aseguradora_id", session.insurerId!)
    : await db.from("producto").insert(values);
  if (result.error) return failure("No pudimos guardar el producto.");
  revalidatePath("/aseguradora/productos"); return success("Producto guardado correctamente.");
}

export async function toggleProduct(formData: FormData) {
  const session = await requireInsurerAdmin(); const id = z.string().uuid().parse(formData.get("id")); const active = formData.get("active") === "true";
  await createAdminClient().from("producto").update({ activo: active }).eq("id", id).eq("aseguradora_id", session.insurerId!);
  revalidatePath("/aseguradora/productos");
}

export async function emitPolicy(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ quoteId: z.string().uuid(), policyNumber: z.string().trim().min(3).max(40) })
    .safeParse({ quoteId: formData.get("quoteId"), policyNumber: formData.get("policyNumber") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  try {
    await runEmitPolicy({ quoteId: parsed.data.quoteId, policyNumber: parsed.data.policyNumber, insurerId: session.insurerId!, userId: session.actorId });
  } catch (error) {
    if (error instanceof PolicyEmissionError) return failure(error.message);
    console.error("Error al emitir póliza", error);
    return failure("No pudimos emitir la póliza. No se guardó ningún dato.");
  }
  revalidatePath("/aseguradora/operacion");
  revalidatePath("/aseguradora");
  return success("Póliza emitida y cronograma de cobranza generado.");
}

const recalcSchema = z.object({
  quoteId: z.string().uuid(),
  productId: z.string().uuid("Selecciona un producto."),
  vehicleTypeId: z.string().uuid("Selecciona el tipo de vehículo."),
  brand: z.string().trim().min(1, "Indica la marca.").max(80),
  model: z.string().trim().min(1, "Indica el modelo.").max(80),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  color: z.string().trim().min(1, "Indica el color.").max(50),
  insuredValue: z.coerce.number().positive().max(5_000_000),
  vehicleStatus: z.enum(["NUEVO", "USADO"]),
  use: z.enum(["COMERCIAL", "PARTICULAR", "CORPORATIVO"]),
  plate: z.string().trim().max(15).optional(),
  durationYears: z.coerce.number().int().min(1).max(5),
  startDate: z.string().date().optional().or(z.literal("")),
  coverageIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una cobertura."),
});

export async function recalculateQuote(_: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const session = await requireInsurerAdmin();
  const parsed = recalcSchema.safeParse({
    quoteId: formData.get("quoteId"),
    productId: formData.get("productId"),
    vehicleTypeId: formData.get("vehicleTypeId"),
    brand: formData.get("brand") || "",
    model: formData.get("model") || "",
    year: formData.get("year") || undefined,
    color: formData.get("color") || "",
    insuredValue: formData.get("insuredValue") || undefined,
    vehicleStatus: formData.get("vehicleStatus") || undefined,
    use: formData.get("use") || undefined,
    plate: formData.get("plate") || "",
    durationYears: formData.get("durationYears"),
    startDate: formData.get("startDate") || "",
    coverageIds: formData.getAll("coverageIds"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos indicados para recalcular.", fields: parsed.error.flatten().fieldErrors };
  }

  try {
    await createSelfServiceQuote({
      clientId: "",
      productId: parsed.data.productId,
      vehicleTypeId: parsed.data.vehicleTypeId,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      color: parsed.data.color,
      insuredValue: parsed.data.insuredValue,
      vehicleStatus: parsed.data.vehicleStatus,
      use: parsed.data.use,
      plate: parsed.data.plate,
      durationYears: parsed.data.durationYears,
      coverageIds: [...new Set(parsed.data.coverageIds)],
      coverageStartDate: parsed.data.startDate || undefined,
      editQuoteId: parsed.data.quoteId,
      editInsurerId: session.insurerId!,
      editUserId: session.actorId,
    });
  } catch (error) {
    if (error instanceof QuoteConfigurationError) return { status: "error", message: error.message };
    console.error("Error al recalcular cotización", error);
    return { status: "error", message: "No pudimos recalcular la cotización. No se guardó ningún cambio." };
  }

  revalidatePath("/aseguradora/operacion");
  revalidatePath("/aseguradora");
  redirect(`/aseguradora/operacion/${parsed.data.quoteId}/calculo?recalculado=1`);
}

export async function saveChannelUser(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ id: optionalUuid, name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email(), channelId: z.string().uuid(), password: z.string().min(10).max(128).optional().or(z.literal("")) }).safeParse({ id: formData.get("id") || "", name: formData.get("name"), email: formData.get("email"), channelId: formData.get("channelId"), password: formData.get("password") || "" });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  if (!parsed.data.id && !parsed.data.password) return failure("Define una contraseña temporal de al menos 10 caracteres.");
  const db = createAdminClient();
  const [{ data: channel }, { data: profile }] = await Promise.all([db.from("canal").select("id").eq("id", parsed.data.channelId).eq("aseguradora_id", session.insurerId!).maybeSingle(), db.from("perfil").select("id").eq("codigo", "USUARIO_CANAL").single()]);
  if (!channel || !profile) return failure("El canal seleccionado no pertenece a tu aseguradora.");
  const values: { nombre: string; email: string; canal_id: string; aseguradora_id: string; perfil_id: string; password_hash?: string } = { nombre: parsed.data.name, email: parsed.data.email, canal_id: channel.id, aseguradora_id: session.insurerId!, perfil_id: profile.id };
  if (parsed.data.password) values.password_hash = await hashPassword(parsed.data.password);
  const result = parsed.data.id
    ? await db.from("usuario").update(values).eq("id", parsed.data.id).eq("aseguradora_id", session.insurerId!).eq("perfil_id", profile.id)
    : await db.from("usuario").insert(values as typeof values & { password_hash: string });
  if (result.error) return failure(result.error.code === "23505" ? "Ese correo ya está registrado." : "No pudimos guardar el usuario.");
  revalidatePath("/aseguradora/agentes"); return success("Usuario de canal guardado correctamente.");
}

export async function toggleChannelUser(formData: FormData) {
  const session = await requireInsurerAdmin(); const id = z.string().uuid().parse(formData.get("id")); const active = formData.get("active") === "true";
  const db = createAdminClient(); const { data: profile } = await db.from("perfil").select("id").eq("codigo", "USUARIO_CANAL").single();
  if (profile) await db.from("usuario").update({ activo: active }).eq("id", id).eq("aseguradora_id", session.insurerId!).eq("perfil_id", profile.id);
  revalidatePath("/aseguradora/agentes");
}

export async function saveVehicleType(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin(); const parsed = z.object({ id: optionalUuid, productId: z.string().uuid(), description: z.string().trim().min(2).max(140) }).safeParse({ id: formData.get("id") || "", productId: formData.get("productId"), description: formData.get("description") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const db = createAdminClient(); const values = { producto_id: parsed.data.productId, descripcion: parsed.data.description };
  const result = parsed.data.id ? await db.from("tipo_vehiculo").update(values).eq("id", parsed.data.id).eq("producto_id", parsed.data.productId) : await db.from("tipo_vehiculo").insert(values);
  if (result.error) return failure("No pudimos guardar el tipo de vehículo."); revalidateProduct(parsed.data.productId); return success("Tipo de vehículo guardado.");
}

export async function saveRiskModel(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin(); const parsed = z.object({ id: optionalUuid, productId: z.string().uuid(), brand: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(120), level: z.coerce.number().int().min(1).max(3), justification: z.string().trim().max(500).optional() }).safeParse({ id: formData.get("id") || "", productId: formData.get("productId"), brand: formData.get("brand"), model: formData.get("model"), level: formData.get("level"), justification: formData.get("justification") || "" });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const values = { producto_id: parsed.data.productId, marca: parsed.data.brand.toUpperCase(), modelo: parsed.data.model.toUpperCase(), nivel_riesgo: parsed.data.level, justificacion: parsed.data.justification || null }; const db = createAdminClient();
  const result = parsed.data.id ? await db.from("riesgo_modelo").update(values).eq("id", parsed.data.id).eq("producto_id", parsed.data.productId) : await db.from("riesgo_modelo").insert(values);
  if (result.error) return failure("No pudimos guardar la marca y modelo."); revalidateProduct(parsed.data.productId); return success("Marca y modelo guardados.");
}

export async function saveRiskRate(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin(); const parsed = z.object({ id: optionalUuid, productId: z.string().uuid(), level: z.coerce.number().int().min(1).max(3), rate: z.coerce.number().min(0).max(1) }).safeParse({ id: formData.get("id") || "", productId: formData.get("productId"), level: formData.get("level"), rate: formData.get("rate") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const values = { producto_id: parsed.data.productId, nivel_riesgo: parsed.data.level, tasa: parsed.data.rate }; const db = createAdminClient();
  const result = parsed.data.id ? await db.from("tasa_por_nivel_riesgo").update(values).eq("id", parsed.data.id).eq("producto_id", parsed.data.productId) : await db.from("tasa_por_nivel_riesgo").insert(values);
  if (result.error) return failure(result.error.code === "23505" ? "Ya existe una tasa para ese nivel." : "No pudimos guardar la tasa."); revalidateProduct(parsed.data.productId); return success("Tasa guardada.");
}

export async function saveMonthlyParameters(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ productId: z.string().uuid(), bank: z.coerce.number().min(0).max(1), rural: z.coerce.number().min(0).max(1), issuance: z.coerce.number().min(0).max(1000), vat: z.coerce.number().min(0).max(1) }).safeParse({ productId: formData.get("productId"), bank: formData.get("bank"), rural: formData.get("rural"), issuance: formData.get("issuance"), vat: formData.get("vat") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const { error } = await createAdminClient().from("parametro_modelo_mensual").upsert({ producto_id: parsed.data.productId, super_bancos_pct: parsed.data.bank, seguro_campesino_pct: parsed.data.rural, derechos_emision_valor: parsed.data.issuance, iva_pct: parsed.data.vat }, { onConflict: "producto_id" });
  if (error) return failure("No pudimos guardar los parámetros mensuales."); revalidateProduct(parsed.data.productId); return success("Parámetros mensuales guardados.");
}

export async function saveAnnualRate(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ productId: z.string().uuid(), year: z.coerce.number().int().min(2).max(5), rate: z.coerce.number().min(0).max(1) }).safeParse({ productId: formData.get("productId"), year: formData.get("year"), rate: formData.get("rate") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const { error } = await createAdminClient().from("tasa_anual_producto").upsert({ producto_id: parsed.data.productId, numero_anio: parsed.data.year, tasa: parsed.data.rate }, { onConflict: "producto_id,numero_anio" });
  if (error) return failure("No pudimos guardar la tasa anual."); revalidateProduct(parsed.data.productId); return success(`Tasa del año ${parsed.data.year} guardada.`);
}

export async function saveDepreciation(_: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin();
  const parsed = z.object({ productId: z.string().uuid(), type: z.enum(["NUEVO_1ER_ANIO","NUEVO_DESDE_2DO","USADO_1ER_ANIO","USADO_DESDE_2DO"]), percentage: z.coerce.number().min(0).max(1) }).safeParse({ productId: formData.get("productId"), type: formData.get("type"), percentage: formData.get("percentage") });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); if (!await ownsProduct(parsed.data.productId, session.insurerId!)) return failure("Producto no autorizado.");
  const { error } = await createAdminClient().from("tabla_depreciacion").upsert({ producto_id: parsed.data.productId, tipo: parsed.data.type, porcentaje: parsed.data.percentage }, { onConflict: "producto_id,tipo" });
  if (error) return failure("No pudimos guardar la depreciación."); revalidateProduct(parsed.data.productId); return success("Depreciación guardada.");
}

type RiskKind = "ciudad" | "genero" | "uso" | "color" | "estado_civil" | "edad" | "monto";
export async function saveRiskParameter(kind: RiskKind, _: InsurerActionState, formData: FormData): Promise<InsurerActionState> {
  const session = await requireInsurerAdmin(); const productId = z.string().uuid().safeParse(formData.get("productId")); const level = z.coerce.number().int().min(1).max(3).safeParse(formData.get("level"));
  if (!productId.success || !level.success) return failure("Revisa el producto y el nivel de riesgo."); if (!await ownsProduct(productId.data, session.insurerId!)) return failure("Producto no autorizado.");
  const base = { producto_id: productId.data, nivel_riesgo: level.data }; let table: "riesgo_ciudad"|"riesgo_genero"|"riesgo_uso"|"riesgo_color"|"riesgo_estado_civil"|"riesgo_edad"|"riesgo_monto_asegurado"; let values: Record<string, unknown>; let conflict: string;
  try {
    if (kind === "ciudad") { table="riesgo_ciudad"; values={...base,ciudad_id:z.string().uuid().parse(formData.get("cityId")),justificacion:null}; conflict="producto_id,ciudad_id"; }
    else if (kind === "genero") { table="riesgo_genero"; values={...base,genero:z.enum(["HOMBRE","MUJER"]).parse(formData.get("value")),porcentaje_participacion:z.coerce.number().min(0).max(100).parse(formData.get("participation"))}; conflict="producto_id,genero"; }
    else if (kind === "uso") { table="riesgo_uso"; values={...base,uso:z.enum(["COMERCIAL","PARTICULAR","CORPORATIVO"]).parse(formData.get("value"))}; conflict="producto_id,uso"; }
    else if (kind === "color") { table="riesgo_color"; values={...base,color:z.string().trim().min(2).max(80).parse(formData.get("value")).toUpperCase()}; conflict="producto_id,color"; }
    else if (kind === "estado_civil") { table="riesgo_estado_civil"; values={...base,estado_civil:z.string().trim().min(2).max(80).parse(formData.get("value")).toUpperCase()}; conflict="producto_id,estado_civil"; }
    else if (kind === "edad") { table="riesgo_edad"; values={...base,edad_desde:z.coerce.number().int().min(0).max(120).parse(formData.get("from")),edad_hasta:optionalNumber(formData.get("to"))}; conflict="id"; }
    else { table="riesgo_monto_asegurado"; values={...base,monto_desde:z.coerce.number().min(0).parse(formData.get("from")),monto_hasta:optionalNumber(formData.get("to"))}; conflict="id"; }
  } catch { return failure("Revisa los valores ingresados."); }
  const db=createAdminClient(); const result=conflict==="id"?await db.from(table).insert(values as never):await db.from(table).upsert(values as never,{onConflict:conflict});
  if(result.error)return failure("No pudimos guardar el factor de riesgo.");revalidateProduct(productId.data);return success("Factor de riesgo guardado.");
}

async function ownsProduct(productId: string, insurerId: string) { const { data } = await createAdminClient().from("producto").select("id").eq("id", productId).eq("aseguradora_id", insurerId).maybeSingle(); return Boolean(data); }
function revalidateProduct(id: string) { revalidatePath(`/aseguradora/productos/${id}`); }
function optionalNumber(value: FormDataEntryValue | null) { return value === null || String(value).trim() === "" ? null : z.coerce.number().min(0).parse(value); }
function invalid(fields: Record<string, string[] | undefined>): InsurerActionState { return { status: "error", message: "Revisa los campos indicados.", fields: fields as Record<string, string[]> }; }
function failure(message: string): InsurerActionState { return { status: "error", message }; }
function success(message: string): InsurerActionState { return { status: "success", message }; }
