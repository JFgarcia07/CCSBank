-- Seguridad: la app accede a la base solo desde el backend (Prisma, con el usuario dueño, que no se ve
-- afectado por RLS). Se activa RLS SIN políticas en todas las tablas de "public" para que la API REST
-- pública de Supabase (clave anon) no pueda leer ni modificar nada.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Además se retiran los permisos de los roles públicos de la API sobre lo que exista hoy.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
