-- Cierra la API pública de Supabase sobre el esquema public (ER §6, "Acceso a la
-- base de datos"). La aplicación sólo usa service_role y la conexión directa de
-- Postgres, que no están sujetas a RLS; anon/authenticated no deben ver nada.
-- Las tablas creadas desde 20260814 ya seguían este patrón; esta migración lo
-- aplica a las 43 tablas del esquema base y a cualquier otra que faltara.

do $$
declare
    t record;
begin
    for t in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
    loop
        execute format('alter table public.%I enable row level security', t.relname);
        execute format('revoke all on table public.%I from anon, authenticated', t.relname);
    end loop;
end
$$;

-- Secuencias y funciones: tampoco expuestas por la API (las RPC de autenticación
-- se invocan con service_role).
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

-- Objetos futuros creados por postgres: sin permisos para anon/authenticated.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;
