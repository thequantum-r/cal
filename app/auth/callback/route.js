import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Debug logging
    console.log("Admin client available:", !!adminClient)
    console.log("Service role key available:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    try {
      const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("OAuth exchange error:", error)
        return NextResponse.redirect(
          `${origin}/login?error=oauth_exchange_failed&details=${encodeURIComponent(error.message)}`,
        )
      }

      if (!authData?.user) {
        console.error("No user data received from OAuth")
        return NextResponse.redirect(`${origin}/login?error=no_user_data`)
      }

      console.log("Processing login for:", authData.user.email)
      console.log("User ID:", authData.user.id)

      // IMPLEMENTING THE CORRECT FLOW:
      // 1. Check invited_users table FIRST → 2. Check users table → 3. If not found, deny access

      // STEP 1: Check invited_users table FIRST
      // Use admin client to bypass RLS for checking invited_users
      let invitedUser = null
      let inviteCheckError = null
      
      if (adminClient) {
        const { data: inviteData, error } = await adminClient
          .from("invited_users_new")
          .select(`
            email, 
            name,
            role_id,
            issuer_id,
            roles_new:role_id (
              id,
              role_name,
              display_name
            ),
            issuers_new:issuer_id (
              id,
              issuer_name,
              display_name
            )
          `)
          .eq("email", authData.user.email)
          .maybeSingle()
        
        invitedUser = inviteData
        inviteCheckError = error
      } else {
        // Fallback to regular client if admin client not available
        const { data: inviteData, error } = await supabase
          .from("invited_users_new")
          .select(`
            email, 
            name,
            role_id,
            issuer_id,
            roles_new:role_id (
              id,
              role_name,
              display_name
            ),
            issuers_new:issuer_id (
              id,
              issuer_name,
              display_name
            )
          `)
          .eq("email", authData.user.email)
          .maybeSingle()
        
        invitedUser = inviteData
        inviteCheckError = error
      }

      console.log("Invited user check result:", { invitedUser, inviteCheckError })

      if (inviteCheckError) {
        console.error("Error checking invited users:", inviteCheckError)
        // If invited_users table doesn't exist or has RLS issues, treat as not invited
        if (inviteCheckError.code === "42P01" || inviteCheckError.code === "42501" || inviteCheckError.code === "42703") {
          console.log("invited_users table doesn't exist, has RLS issues, or has wrong structure, treating as not invited")
        } else {
          return NextResponse.redirect(
            `${origin}/login?error=invite_check_failed&details=${encodeURIComponent(inviteCheckError.message)}`,
          )
        }
      }

      // If user is invited, allow them access (DON'T DELETE the invitation yet!)
      if (invitedUser) {
        console.log("User has valid invitation:", authData.user.email)
        
        // Check if user already exists in users table
        const { data: existingUser, error: userCheckError } = await supabase
          .from("users_new")
          .select("id, email, name, is_super_admin, is_owner")
          .eq("id", authData.user.id)
          .maybeSingle()

        if (userCheckError) {
          console.error("Error checking existing user:", userCheckError)
          return NextResponse.redirect(
            `${origin}/login?error=user_check_failed&details=${encodeURIComponent(userCheckError.message)}`,
          )
        }

        if (!existingUser) {
          // User doesn't exist yet - create them but DON'T delete invitation
          console.log("Creating new user from invite (keeping invitation):", authData.user.email)
          
          if (!adminClient) {
            console.error("Admin client not available for user creation")
            return NextResponse.redirect(
              `${origin}/login?error=admin_client_unavailable`,
            )
          }

          // Create user without role/role_id (since we're removing those columns)
          const { data: newUser, error: createError } = await adminClient
            .from("users_new")
            .insert({
              id: authData.user.id,
              email: authData.user.email,
              name: invitedUser.name,
              is_super_admin: invitedUser.roles_new?.role_name === 'superadmin' ? true : false,
              is_owner: false
            })
            .select()
            .single()

          if (createError) {
            console.error("Error creating user from invitation:", createError)
            
            // Clean up auth user if user creation failed
            try {
              await adminClient.auth.admin.deleteUser(authData.user.id)
              console.log("Cleaned up auth user after creation failure:", authData.user.id)
            } catch (deleteError) {
              console.warn("Failed to delete auth user after creation failure:", deleteError?.message)
            }

            return NextResponse.redirect(
              `${origin}/login?error=user_creation_failed&details=${encodeURIComponent(createError?.message || 'User creation failed')}`,
            )
          }

          // Create issuer relationship for non-superadmin users
          if (invitedUser.roles_new?.role_name !== 'superadmin' && invitedUser.issuer_id) {
            const { error: issuerUserError } = await adminClient
              .from("issuer_users_new")
              .insert({
                user_id: authData.user.id,
                issuer_id: invitedUser.issuer_id,
                role_id: invitedUser.role_id,
                is_primary: true
              })

            if (issuerUserError) {
              console.error("Error creating issuer relationship:", issuerUserError)
              // Don't fail the entire process for this
            }
          }

          console.log("User created successfully from invitation:", authData.user.email)
        }
        
        // Decide final redirect target. If the invitation grants a shareholder role,
        // send them to the shareholder-home regardless of the original `next`.
        let targetPath = next
        try {
          const invitedRole = invitedUser?.roles_new?.role_name
          if (invitedRole && invitedRole.toLowerCase() === 'shareholder') {
            targetPath = '/shareholder-home'
          }
        } catch (err) {
          console.warn('Error checking invited user role for redirect override:', err)
        }

        const redirectUrl = new URL(`${origin}${targetPath}`)
        redirectUrl.searchParams.set("login", invitedUser ? "new" : "returning")
        return NextResponse.redirect(redirectUrl)
      }

      // STEP 2: User not invited, check if they exist in users table
      console.log("User not invited, checking users table for:", authData.user.email)
      
      // Check by both ID and email to handle existing users with different auth IDs
      const { data: existingUser, error: userCheckError } = await supabase
        .from("users_new")
        .select("id, email, name, is_super_admin, is_owner")
        .or(`id.eq.${authData.user.id},email.eq.${authData.user.email}`)
        .maybeSingle()

      if (userCheckError) {
        console.error("Error checking existing user:", userCheckError)
        return NextResponse.redirect(
          `${origin}/login?error=user_check_failed&details=${encodeURIComponent(userCheckError.message)}`,
        )
      }

      // If user exists in users table, they're valid
      if (existingUser) {
        console.log("Returning user login:", existingUser.email)
        
        // If the existing user has a different ID than the auth user, update the users table
        if (existingUser.id !== authData.user.id) {
          console.log("Updating user ID from", existingUser.id, "to", authData.user.id)
          
          if (adminClient) {
            try {
              // Update the user ID to match the auth user ID
              const { error: updateError } = await adminClient
                .from("users_new")
                .update({ id: authData.user.id })
                .eq("email", authData.user.email)

              if (updateError) {
                console.error("Error updating user ID:", updateError)
                // Continue anyway - the user exists and should be allowed in
              } else {
                console.log("Successfully updated user ID for:", authData.user.email)
              }
            } catch (error) {
              console.error("Error updating user ID:", error)
            }
          }
        }
        
        // Determine the user's highest issuer role and override redirect to
        // /shareholder-home when the user is exclusively a shareholder.
        let targetPath = next
        try {
          const roleQueryClient = adminClient || supabase
          const { data: issuerRoles } = await roleQueryClient
            .from("issuer_users_new")
            .select("roles_new:role_id(role_name)")
            .eq("user_id", authData.user.id)

          if (issuerRoles && issuerRoles.length > 0) {
            const roleHierarchy = [
              'superadmin',
              'admin',
              'transfer_team',
              'shareholder',
              'broker',
              'read_only',
            ]

            // Flatten role names
            const foundRoles = issuerRoles
              .map(r => r?.roles_new?.role_name)
              .filter(Boolean)
              .map(rn => rn.toLowerCase())

            for (const level of roleHierarchy) {
              if (foundRoles.includes(level)) {
                // If the highest role resolved is 'shareholder', send them to home
                if (level === 'shareholder') {
                  targetPath = '/shareholder-home'
                }
                break
              }
            }
          }
        } catch (err) {
          console.warn('Error resolving user issuer roles for redirect override:', err)
        }

        const redirectUrl = new URL(`${origin}${targetPath}`)
        redirectUrl.searchParams.set("login", "returning")
        return NextResponse.redirect(redirectUrl)
      }

      // STEP 3: User is not invited and not in users table - DELETE and block
      console.log("Unauthorized user attempt:", authData.user.email)
      
      // Delete the auth user if we have admin access
      if (adminClient) {
        try {
          await adminClient.auth.admin.deleteUser(authData.user.id)
          console.log("Deleted unauthorized auth user:", authData.user.id)
        } catch (deleteError) {
          console.warn("Failed to delete unauthorized user:", deleteError?.message)
        }
      }

      return NextResponse.redirect(`${origin}/login?error=not_invited`)

    } catch (error) {
      console.error("Callback error:", error)
      return NextResponse.redirect(`${origin}/login?error=callback_error&details=${encodeURIComponent(error.message)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
