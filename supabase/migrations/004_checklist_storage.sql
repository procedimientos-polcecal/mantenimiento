-- Storage bucket for execution photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'execution-photos',
  'execution-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload execution photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'execution-photos');

CREATE POLICY "Authenticated users can view execution photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'execution-photos');

CREATE POLICY "Authenticated users can delete own photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'execution-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photo_urls and checklist columns to executions if missing
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS checklist_responses JSONB;

-- Ensure equipment_checklists has is_active flag
ALTER TABLE equipment_checklists
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS name TEXT;
