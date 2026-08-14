"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbPool } from "@/lib/db/pool";
import { hashPassword } from "@/lib/auth/crypto";
import type { PlatformActionState } from "@/lib/platform/action-state";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export async function saveInsurer(_: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const session = await requirePlatformAdmin();
  const schema = z.object({ id: optionalUuid, commercialName:z.string().trim().min(2).max(120), legalName:z.string().trim().min(2).max(160), ruc:z.string().regex(/^\d{13}$/,"Ingresa un RUC de 13 dígitos."), logoUrl:z.string().trim().url().optional().or(z.literal("")) });
  const parsed=schema.safeParse({id:formData.get("id")||"",commercialName:formData.get("commercialName"),legalName:formData.get("legalName"),ruc:formData.get("ruc"),logoUrl:formData.get("logoUrl")||""});
  if(!parsed.success)return invalid(parsed.error.flatten().fieldErrors);
  const db=createAdminClient();
  const values={nombre_comercial:parsed.data.commercialName,razon_social:parsed.data.legalName,ruc:parsed.data.ruc,logo_url:parsed.data.logoUrl||null};
  const result=parsed.data.id?await db.from("aseguradora").update(values).eq("id",parsed.data.id):await db.from("aseguradora").insert(values);
  if(result.error)return failure(result.error.code==="23505"?"Ya existe una aseguradora con ese RUC.":"No pudimos guardar la aseguradora.");
  await audit(session.actorId,"ASEGURADORA",parsed.data.id||null,parsed.data.id?"EDICION":"CREACION",values);
  revalidatePath("/admin");revalidatePath("/admin/aseguradoras");return success("Aseguradora guardada correctamente.");
}

export async function toggleInsurer(formData: FormData) { const session=await requirePlatformAdmin();const id=z.string().uuid().parse(formData.get("id"));const active=formData.get("active")==="true";await createAdminClient().from("aseguradora").update({activo:active}).eq("id",id);await audit(session.actorId,"ASEGURADORA",id,"CAMBIO_ESTADO",{activo:active});revalidatePath("/admin/aseguradoras"); }

export async function savePlan(_: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const session=await requirePlatformAdmin();
  const schema=z.object({id:optionalUuid,name:z.string().trim().min(2).max(80),description:z.string().trim().max(300).optional(),maxBranches:z.coerce.number().int().positive().optional(),price:z.coerce.number().min(0).max(999999),branchIds:z.array(z.string().uuid()).min(1,"Selecciona al menos un ramo.")});
  const parsed=schema.safeParse({id:formData.get("id")||"",name:formData.get("name"),description:formData.get("description")||"",maxBranches:formData.get("maxBranches")||undefined,price:formData.get("price"),branchIds:formData.getAll("branchIds")});
  if(!parsed.success)return invalid(parsed.error.flatten().fieldErrors);
  if(parsed.data.maxBranches&&parsed.data.branchIds.length>parsed.data.maxBranches)return failure("Los ramos seleccionados superan el máximo permitido por el plan.");
  const values={nombre:parsed.data.name.toUpperCase(),descripcion:parsed.data.description||null,max_ramos:parsed.data.maxBranches||null,precio_mensual:parsed.data.price};
  const db=createAdminClient();let planId=parsed.data.id||"";
  if(planId){const{error}=await db.from("plan_suscripcion").update(values).eq("id",planId);if(error)return failure(error.code==="23505"?"Ya existe un plan con ese nombre.":"No pudimos guardar el plan.");}
  else{const{data,error}=await db.from("plan_suscripcion").insert(values).select("id").single();if(error||!data)return failure(error?.code==="23505"?"Ya existe un plan con ese nombre.":"No pudimos guardar el plan.");planId=data.id;}
  const{error:deleteError}=await db.from("plan_suscripcion_ramo").delete().eq("plan_suscripcion_id",planId);if(deleteError)return failure("El plan se guardó, pero no pudimos actualizar sus ramos.");
  const{error:branchError}=await db.from("plan_suscripcion_ramo").insert(parsed.data.branchIds.map(ramo_base_id=>({plan_suscripcion_id:planId,ramo_base_id})));if(branchError)return failure("El plan se guardó, pero no pudimos asignar sus ramos.");
  await audit(session.actorId,"PLAN_SUSCRIPCION",planId,parsed.data.id?"EDICION":"CREACION",{...values,ramos:parsed.data.branchIds});revalidatePath("/admin/planes");return success("Plan y ramos guardados correctamente.");
}

export async function togglePlan(formData:FormData){const session=await requirePlatformAdmin();const id=z.string().uuid().parse(formData.get("id"));const active=formData.get("active")==="true";await createAdminClient().from("plan_suscripcion").update({activo:active}).eq("id",id);await audit(session.actorId,"PLAN_SUSCRIPCION",id,"CAMBIO_ESTADO",{activo:active});revalidatePath("/admin/planes");}

const catalogConfig={
  ciudad:{table:"ciudad",path:"/admin/catalogos",schema:z.object({id:optionalUuid,name:z.string().trim().min(2).max(100),province:z.string().trim().max(100).optional()}),values:(d:{name:string;province?:string})=>({nombre:d.name,provincia:d.province||null})},
  ramo:{table:"ramo_base",path:"/admin/catalogos",schema:z.object({id:optionalUuid,name:z.string().trim().min(2).max(100),description:z.string().trim().max(300).optional()}),values:(d:{name:string;description?:string})=>({nombre:d.name.toUpperCase(),descripcion:d.description||null})},
  cobertura:{table:"cobertura_base",path:"/admin/catalogos",schema:z.object({id:optionalUuid,name:z.string().trim().min(2).max(140),description:z.string().trim().max(500).optional()}),values:(d:{name:string;description?:string})=>({nombre:d.name,descripcion_generica:d.description||null})},
  clausula:{table:"clausula_base",path:"/admin/catalogos",schema:z.object({id:optionalUuid,name:z.string().trim().min(2).max(160),description:z.string().trim().min(2).max(5000)}),values:(d:{name:string;description:string})=>({titulo:d.name,texto_generico:d.description})},
  deducible:{table:"deducible_base",path:"/admin/catalogos",schema:z.object({id:optionalUuid,name:z.string().trim().min(2).max(140),description:z.string().trim().max(500).optional(),calculationType:z.enum(["PORCENTAJE","VALOR_FIJO"])}),values:(d:{name:string;description?:string;calculationType:"PORCENTAJE"|"VALOR_FIJO"})=>({nombre:d.name,descripcion:d.description||null,tipo_calculo:d.calculationType})},
} as const;
type CatalogKind=keyof typeof catalogConfig;

export async function saveCatalogItem(kind:CatalogKind,_:PlatformActionState,formData:FormData):Promise<PlatformActionState>{const session=await requirePlatformAdmin();const config=catalogConfig[kind];const raw={id:formData.get("id")||"",name:formData.get("name"),province:formData.get("province")||"",description:formData.get("description")||"",calculationType:formData.get("calculationType")||undefined};const parsed=config.schema.safeParse(raw);if(!parsed.success)return invalid(parsed.error.flatten().fieldErrors);const data=parsed.data as never;const values=config.values(data);const id=(parsed.data as {id?:string}).id;const db=createAdminClient();const query=db.from(config.table);const result=id?await query.update(values as never).eq("id",id):await query.insert(values as never);if(result.error)return failure(result.error.code==="23505"?"Ya existe un registro con ese nombre.":"No pudimos guardar el catálogo.");await audit(session.actorId,config.table.toUpperCase(),id||null,id?"EDICION":"CREACION",values);revalidatePath(config.path);return success("Catálogo guardado correctamente.");}

export async function toggleCatalogItem(kind:Exclude<CatalogKind,"ciudad">,formData:FormData){const session=await requirePlatformAdmin();const id=z.string().uuid().parse(formData.get("id"));const active=formData.get("active")==="true";const config=catalogConfig[kind];await createAdminClient().from(config.table).update({activo:active}).eq("id",id);await audit(session.actorId,config.table.toUpperCase(),id,"CAMBIO_ESTADO",{activo:active});revalidatePath("/admin/catalogos");}

export async function saveInsurerAdmin(_:PlatformActionState,formData:FormData):Promise<PlatformActionState>{const session=await requirePlatformAdmin();const schema=z.object({id:optionalUuid,name:z.string().trim().min(2).max(120),email:z.string().trim().toLowerCase().email(),insurerId:z.string().uuid(),password:z.string().min(10).max(128).optional().or(z.literal(""))});const parsed=schema.safeParse({id:formData.get("id")||"",name:formData.get("name"),email:formData.get("email"),insurerId:formData.get("insurerId"),password:formData.get("password")||""});if(!parsed.success)return invalid(parsed.error.flatten().fieldErrors);if(!parsed.data.id&&!parsed.data.password)return failure("Define una contraseña temporal de al menos 10 caracteres.");const db=createAdminClient();const {data:profile}=await db.from("perfil").select("id").eq("codigo","ADMIN_ASEGURADORA").single();if(!profile)return failure("No existe el perfil ADMIN_ASEGURADORA.");const values:{nombre:string;email:string;aseguradora_id:string;perfil_id:string;canal_id:null;password_hash?:string}={nombre:parsed.data.name,email:parsed.data.email,aseguradora_id:parsed.data.insurerId,perfil_id:profile.id,canal_id:null};if(parsed.data.password)values.password_hash=await hashPassword(parsed.data.password);const result=parsed.data.id?await db.from("usuario").update(values).eq("id",parsed.data.id):await db.from("usuario").insert(values as typeof values&{password_hash:string});if(result.error)return failure(result.error.code==="23505"?"Ese correo ya está registrado.":"No pudimos guardar el administrador.");await audit(session.actorId,"USUARIO",parsed.data.id||null,parsed.data.id?"EDICION":"CREACION",{nombre:values.nombre,email:values.email,aseguradora_id:values.aseguradora_id,perfil:"ADMIN_ASEGURADORA"});revalidatePath("/admin/administradores");return success("Administrador guardado correctamente.");}

export async function toggleUser(formData:FormData){const session=await requirePlatformAdmin();const id=z.string().uuid().parse(formData.get("id"));if(id===session.actorId)return;const active=formData.get("active")==="true";await createAdminClient().from("usuario").update({activo:active}).eq("id",id);await audit(session.actorId,"USUARIO",id,"CAMBIO_ESTADO",{activo:active});revalidatePath("/admin/administradores");}

export async function assignSubscription(_:PlatformActionState,formData:FormData):Promise<PlatformActionState>{const session=await requirePlatformAdmin();const parsed=z.object({insurerId:z.string().uuid(),planId:z.string().uuid(),startDate:z.string().date(),endDate:z.string().date().optional().or(z.literal(""))}).safeParse({insurerId:formData.get("insurerId"),planId:formData.get("planId"),startDate:formData.get("startDate"),endDate:formData.get("endDate")||""});if(!parsed.success)return invalid(parsed.error.flatten().fieldErrors);const client=await getDbPool().connect();try{await client.query("begin");await client.query("update aseguradora_suscripcion set estado='CANCELADA',fecha_fin=coalesce(fecha_fin,current_date) where aseguradora_id=$1 and estado='ACTIVA'",[parsed.data.insurerId]);const inserted=await client.query<{id:string}>("insert into aseguradora_suscripcion(aseguradora_id,plan_suscripcion_id,fecha_inicio,fecha_fin,estado) values($1,$2,$3,nullif($4,'')::date,'ACTIVA') returning id",[parsed.data.insurerId,parsed.data.planId,parsed.data.startDate,parsed.data.endDate]);await client.query("insert into auditoria(entidad,entidad_id,accion,datos_nuevos,usuario_id) values('ASEGURADORA_SUSCRIPCION',$1,'CREACION',jsonb_build_object('aseguradora_id',$2::text,'plan_id',$3::text),$4)",[inserted.rows[0].id,parsed.data.insurerId,parsed.data.planId,session.actorId]);await client.query("commit");}catch(error){await client.query("rollback");console.error(error);return failure("No pudimos asignar la suscripción.");}finally{client.release();}revalidatePath("/admin/suscripciones");return success("Suscripción asignada correctamente.");}

async function audit(userId:string,entity:string,entityId:string|null,action:"CREACION"|"EDICION"|"CAMBIO_ESTADO",data:object){if(!entityId)return;await createAdminClient().from("auditoria").insert({entidad:entity,entidad_id:entityId,accion:action,datos_nuevos:data,usuario_id:userId});}
function invalid(fields:Record<string,string[]|undefined>):PlatformActionState{return{status:"error",message:"Revisa los campos indicados.",fields:fields as Record<string,string[]>};}function failure(message:string):PlatformActionState{return{status:"error",message};}function success(message:string):PlatformActionState{return{status:"success",message};}
