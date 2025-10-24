-- Create document_notes table for user-specific notes
-- Each user can have their own private note for each document

CREATE TABLE IF NOT EXISTS document_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES docs_for_restricted_shares(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users_new(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doc_id, user_id) -- Each user can only have one note per document
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_document_notes_doc_id ON document_notes(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_notes_user_id ON document_notes(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE document_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notes
CREATE POLICY "Users can view their own notes"
  ON document_notes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own notes
CREATE POLICY "Users can insert their own notes"
  ON document_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
  ON document_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
  ON document_notes
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE document_notes IS 'Stores user-specific notes for documents in Securities Administration';
