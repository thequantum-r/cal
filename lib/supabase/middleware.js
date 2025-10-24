import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

export async function updateSession(request) {
  // If Supabase is not configured, just continue without auth
  if (!isSupabaseConfigured) {
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const requestUrl = new URL(request.url)

  // Skip auth checks for auth callback route and login page
  if (requestUrl.pathname === "/auth/callback" || requestUrl.pathname.startsWith("/login")) {
    return supabaseResponse
  }

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  const isPublicRoute = request.nextUrl.pathname === "/"

  if (!isPublicRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const redirectUrl = new URL("/login", request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Authorization gate: check invited_users FIRST, then users table
    const { data: appUser } = await supabase.from("users_new").select("id, email, name, is_super_admin").eq("id", user.id).maybeSingle()
    
    if (!appUser) {
      // User not in users table - check if they have a valid invitation
      const { data: invite } = await supabase
        .from("invited_users_new")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()

      if (invite) {
        // User has pending invitation - allow them to continue to dashboard
        // The auth callback should have processed them, but middleware runs first
        // Let them through so the dashboard can handle the user creation
        return supabaseResponse
      }

      // No invitation found - block access
      try { await supabase.auth.signOut() } catch {}
      const redirectUrl = new URL("/login?error=auth_failed", request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Authorization logic: allow access if user has proper setup
    if (appUser.is_super_admin) {
      // Superadmins always have access
      return supabaseResponse
    } else {
      // For non-superadmin users, check if they have issuer access OR admin role in any issuer
      const { data: issuerUsers } = await supabase
        .from("issuer_users_new")
        .select("id, roles_new:role_id(role_name)")
        .eq("user_id", appUser.id)
      
      if (issuerUsers && issuerUsers.length > 0) {
        // User has issuer access - allow them in
        return supabaseResponse
      }
      
      // If no issuer_users record, check for pending invitation
      const { data: invite } = await supabase
        .from("invited_users_new")
        .select("email")
        .ilike("email", appUser.email)
        .maybeSingle()

      if (invite) {
        // User has pending invitation - allow them in
        return supabaseResponse
      }
      
      // User has no issuer access and no invitation - block access
      try { await supabase.auth.signOut() } catch {}
      const redirectUrl = new URL("/login?error=auth_failed", request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}