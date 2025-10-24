import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all users (for superadmin) or users in the same issuer (for admin/transfer_team)
    const { data: users, error } = await supabase
      .from("users_new")
      .select("id, email, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json(users || [])
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



