-- =====================================================================
-- Qualio - Configuracion especifica de Supabase
-- Ejecutar DESPUES de 00_bootstrap_schema.sql. Idempotente.
--
-- Contexto: el API (NestJS) se conecta como rol "postgres", que ignora RLS.
-- El front usa la anon key solo para: Storage (avatars, project-assets) y
-- Realtime sobre la tabla notifications. Todo lo demas pasa por el API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RLS en todas las tablas: bloquea el acceso directo via REST
--    (PostgREST) con la anon key. Sin esto, cualquiera con la anon key
--    podria leer users.password_hash, refresh_tokens, etc.
-- ---------------------------------------------------------------------
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_item_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_attachments  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2) Realtime para notifications
--    Realtime solo entrega cambios que el rol (anon) puede SELECT.
--    Como el front no usa Supabase Auth, no hay auth.uid() para filtrar:
--    esta politica deja leer notifications con la anon key.
--    Si prefieres no exponerlas, borra esta politica: la app sigue
--    funcionando, solo que las notificaciones se ven al recargar en vez
--    de llegar en vivo.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS notifications_anon_realtime_select ON notifications;
CREATE POLICY notifications_anon_realtime_select
  ON notifications FOR SELECT
  TO anon
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3) Storage
--    avatars        -> publico (el front usa getPublicUrl), upsert: true
--    project-assets -> privado (el front usa createSignedUrl), upsert: false
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-assets', 'project-assets', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- avatars: subir, sobrescribir (upsert necesita select + update) y leer
DROP POLICY IF EXISTS qualio_avatars_insert ON storage.objects;
CREATE POLICY qualio_avatars_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS qualio_avatars_update ON storage.objects;
CREATE POLICY qualio_avatars_update ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS qualio_avatars_select ON storage.objects;
CREATE POLICY qualio_avatars_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- project-assets: subir adjuntos y generar URLs firmadas
DROP POLICY IF EXISTS qualio_assets_insert ON storage.objects;
CREATE POLICY qualio_assets_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'project-assets');

DROP POLICY IF EXISTS qualio_assets_select ON storage.objects;
CREATE POLICY qualio_assets_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'project-assets');
