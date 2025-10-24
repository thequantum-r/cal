import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const issuerId = searchParams.get('issuerId')

    if (!issuerId) {
      return NextResponse.json({ error: 'Issuer ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("issuer_id", issuerId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    return NextResponse.json(documents || [])
  } catch (error) {
    console.error('Error in documents API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { issuer_id, document_type, document_name, file_url, file_size, file_type } = body

    if (!issuer_id || !document_type || !document_name || !file_url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        issuer_id,
        document_type,
        document_name,
        file_url,
        file_size,
        file_type,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating document:', error)
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error in documents POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the document to find the file URL for cleanup
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("file_url")
      .eq("id", documentId)
      .single()

    if (fetchError) {
      console.error('Error fetching document for deletion:', fetchError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete from database
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)

    if (error) {
      console.error('Error deleting document:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    // Extract file path from URL for storage cleanup
    if (document.file_url) {
      try {
        const urlParts = document.file_url.split('/storage/v1/object/public/')
        if (urlParts.length > 1) {
          const fullPath = urlParts[1]
          const pathParts = fullPath.split('/')
          if (pathParts.length >= 2) {
            const bucket = pathParts[0]
            const filePath = pathParts.slice(1).join('/')
            
            // Delete from storage
            const { error: storageError } = await supabase.storage
              .from(bucket)
              .remove([filePath])

            if (storageError) {
              console.warn('Warning: Could not delete file from storage:', storageError)
            }
          }
        }
      } catch (storageError) {
        console.warn('Warning: Error cleaning up storage:', storageError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in documents DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}