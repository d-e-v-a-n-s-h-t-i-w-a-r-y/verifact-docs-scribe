-- Create patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mrn TEXT,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create consultations table
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url TEXT,
  transcript_json JSONB,
  status TEXT CHECK (status IN ('recording', 'processing', 'draft', 'signed')) DEFAULT 'recording',
  consult_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sections_json JSONB,
  edit_count INTEGER NOT NULL DEFAULT 0,
  review_seconds INTEGER NOT NULL DEFAULT 0,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patients
CREATE POLICY "Doctors can manage their own patients"
ON patients
FOR ALL
TO authenticated
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- RLS Policies for consultations
CREATE POLICY "Doctors can manage their own consultations"
ON consultations
FOR ALL
TO authenticated
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- RLS Policies for notes
CREATE POLICY "Doctors can manage their own notes"
ON notes
FOR ALL
TO authenticated
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Storage Setup
-- Create the 'consult-audio' bucket (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('consult-audio', 'consult-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for consult-audio
-- This policy ensures doctors can only upload, read, update, or delete files 
-- inside a folder named with their own User ID (e.g. `auth.uid()/my-recording.wav`)
CREATE POLICY "Doctors can manage their own audio files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'consult-audio' AND (auth.uid())::text = (string_to_array(name, '/'))[1])
WITH CHECK (bucket_id = 'consult-audio' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);

-- Enable Realtime for consultations so the frontend can listen to status changes
ALTER PUBLICATION supabase_realtime ADD TABLE consultations;
