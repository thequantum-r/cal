import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const issuerId = formData.get('issuerId')
    const documentType = formData.get('documentType')

    if (!file || !issuerId || !documentType) {
      return NextResponse.json({ error: 'File, issuer ID, and document type are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user and session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in upload:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is superadmin first
    const { data: userData, error: userError } = await supabase
      .from('users_new')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.error('Error checking user status:', userError)
      return NextResponse.json({ error: 'Database error checking user status' }, { status: 500 })
    }

    const isSuperAdmin = userData?.is_super_admin === true

    if (!isSuperAdmin) {
      // For non-superadmin users, verify they have access to this issuer
      const { data: userAccess, error: accessError } = await supabase
        .from('issuer_users_new')
        .select('id')
        .eq('user_id', user.id)
        .eq('issuer_id', issuerId)
        .maybeSingle()

      if (accessError) {
        console.error('User access error:', accessError)
        return NextResponse.json({ error: 'Database error checking access' }, { status: 500 })
      }

      if (!userAccess) {
        console.error('User access denied: No relationship found for user', user.id, 'and issuer', issuerId)
        return NextResponse.json({ error: 'Access denied to this issuer' }, { status: 403 })
      }
    }

    console.log('Upload request from user:', user.id, 'for issuer:', issuerId)

    // Create a unique file name
    const timestamp = new Date().getTime()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${issuerId}/${documentType}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    console.log('Attempting to upload file:', fileName, 'Size:', file.size)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    console.log('Upload result:', { data: uploadData, error: uploadError })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json({ 
        error: 'Failed to upload file', 
        details: uploadError.message || uploadError 
      }, { status: 500 })
    }

    console.log('File uploaded successfully to:', fileName)

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: fileName
    })
  } catch (error) {
    console.error('Error in upload API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}