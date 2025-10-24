"use server";

import { createClient } from "./supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    console.error("Error signing in with Google:", error);
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login?signedout=1");
}

// Validate user login according to the flow: users table → invited_users table → deny access if not found
export async function validateUserLogin(userEmail) {
  const supabase = await createClient();

  // Check if user exists in users table
  const { data: userData, error: userError } = await supabase
    .from("users_new")
    .select("id, email, name, is_super_admin")
    .eq("email", userEmail)
    .single();

  if (userData) {
    // User exists in users table - they're valid
    return { valid: true, user: userData, isExistingUser: true };
  }

  // Check if user exists in invited_users table
  const { data: invitedData, error: invitedError } = await supabase
    .from("invited_users_new")
    .select(
      `
      email,
      name,
      role_id,
      issuer_id,
      roles_new:role_id (
        role_name,
        display_name
      ),
      issuers_new:issuer_id (
        id,
        issuer_name,
        display_name
      )
    `,
    )
    .eq("email", userEmail)
    .single();

  if (invitedData) {
    // User exists in invited_users - create them in users table
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Create user in users table (without role/role_id columns)
      const { data: newUser, error: createError } = await supabase
        .from("users_new")
        .insert({
          id: user.id,
          email: userEmail,
          name: invitedData.name,
          is_super_admin:
            invitedData.roles_new?.role_name === "superadmin" ? true : false,
          is_owner: false,
        })
        .select()
        .single();

      if (newUser) {
        // For all non-superadmin invitations, create issuer relationship
        if (
          invitedData.roles_new?.role_name !== "superadmin" &&
          invitedData.issuer_id
        ) {
          await supabase.from("issuer_users_new").insert({
            user_id: user.id,
            issuer_id: invitedData.issuer_id,
            role_id: invitedData.role_id,
          });

          // Update issuer status to active if this is an admin invitation
          if (invitedData.roles_new?.role_name === "admin") {
            await supabase
              .from("issuers_new")
              .update({ status: "active" })
              .eq("id", invitedData.issuer_id);
          }
        }

        // Remove the user from invited_users table
        await supabase
          .from("invited_users_new")
          .delete()
          .eq("email", userEmail)
          .eq("role_id", invitedData.role_id)
          .eq("issuer_id", invitedData.issuer_id);

        return {
          valid: true,
          user: newUser,
          isExistingUser: false,
          invitedData,
        };
      }
    }
  }

  // User not found in either table - deny access
  return { valid: false, user: null, isExistingUser: false };
}

// Get current user's role from the database
export async function getCurrentUserRole() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users_new")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching user role:", error);
    return "read_only"; // Default role
  }

  // Check if user is superadmin first
  if (data?.is_super_admin === true) {
    return "superadmin";
  }

  // For non-superadmin users, check their highest role across all issuers
  const { data: issuerRoles } = await supabase
    .from("issuer_users_new")
    .select("roles_new:role_id(role_name)")
    .eq("user_id", user.id);

  if (!issuerRoles || issuerRoles.length === 0) {
    return "read_only"; // Default role if no issuer assignments
  }

  // Return the highest privilege role across all issuers
  const roleHierarchy = [
    "superadmin",
    "admin",
    "transfer_team",
    "shareholder",
    "broker",
    "read_only",
  ];

  for (const roleLevel of roleHierarchy) {
    const foundRole = issuerRoles.find(
      (roleData) => roleData.roles_new?.role_name?.toLowerCase() === roleLevel.toLowerCase(),
    );
    if (foundRole) {
      return roleLevel;
    }
  }

  return "read_only"; // Fallback
}

// Get user's role for a specific issuer
export async function getUserRoleForIssuer(issuerId) {
  const supabase = await createClient();

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  console.log(
    `[DEBUG] Getting role for user ${user.email} in issuer ${issuerId}`,
  );

  // Check if user is superadmin first
  const globalUserRole = await getCurrentUserRole();
  if (globalUserRole === "superadmin") {
    console.log(`[DEBUG] User is superadmin - has admin access to all issuers`);
    return "admin"; // Superadmins act as admins in all issuers
  }

  // Get user's roles in the specific issuer (may have multiple)
  const { data, error } = await supabase
    .from("issuer_users_new")
    .select("roles_new:role_id(role_name)")
    .eq("user_id", user.id)
    .eq("issuer_id", issuerId);

  if (error) {
    console.error(`Error fetching user roles for issuer ${issuerId}:`, error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log(`[DEBUG] No roles found for user in issuer ${issuerId}`);
    return null;
  }

  console.log(
    `[DEBUG] User has ${data.length} roles in issuer ${issuerId}:`,
    data,
  );

  // Return the highest privilege role for this issuer (not just primary)
  const roleHierarchy = ["superadmin", "admin", "transfer_team", "read_only"];

  for (const roleLevel of roleHierarchy) {
    const foundRole = data.find(
      (roleData) => roleData.roles_new?.role_name === roleLevel,
    );
    if (foundRole) {
      const role = foundRole.roles_new?.role_name;
      console.log(`[DEBUG] User highest role in issuer ${issuerId}: ${role}`);
      return role;
    }
  }

  // Fallback to first role
  const fallbackRole = data[0]?.roles_new?.role_name || null;
  console.log(
    `[DEBUG] User fallback role in issuer ${issuerId}: ${fallbackRole}`,
  );
  return fallbackRole;
}

// Get user's available issuers for workspace toggle
export async function getUserIssuers() {
  const supabase = await createClient();

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Check if user is superadmin
  const userRole = await getCurrentUserRole();

  if (userRole === "superadmin") {
    console.log("[DEBUG] Superadmin user - fetching all issuers");

    // Superadmins can access all issuers
    const { data: allIssuers, error: allIssuersError } = await supabase
      .from("issuers_new")
      .select("id, issuer_name, display_name, description, created_at")
      .order("created_at", { ascending: true });

    if (allIssuersError) {
      console.error(
        "Error fetching all issuers for superadmin:",
        allIssuersError,
      );
      return [];
    }

    // Format as expected by the rest of the app
    return (
      allIssuers?.map((issuer) => ({
        issuer_id: issuer.id,
        issuer_name: issuer.issuer_name,
        issuer_display_name: issuer.display_name,
        issuer_description: issuer.description,
        earliest_membership: issuer.created_at,
        roles: [{ name: "superadmin", display_name: "Super Admin" }],
      })) || []
    );
  }

  // For non-superadmin users, get their specific issuer memberships
  const { data, error } = await supabase
    .from("issuer_users_new")
    .select(
      `
      issuer_id,
      created_at,
      role_id,
      roles_new:role_id (
        role_name,
        display_name
      ),
      issuers_new:issuer_id (
        id,
        issuer_name,
        display_name,
        description
      )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true }); // Oldest first for primary issuer logic

  if (error) {
    console.error("Error fetching user issuers:", error);
    return [];
  }

  // Group by issuer to handle multiple roles per issuer
  const issuerMap = new Map();

  data?.forEach((membership) => {
    const issuerId = membership.issuers_new.id;
    if (!issuerMap.has(issuerId)) {
      issuerMap.set(issuerId, {
        issuer_id: membership.issuers_new.id,
        issuer_name: membership.issuers_new.issuer_name,
        issuer_display_name: membership.issuers_new.display_name,
        issuer_description: membership.issuers_new.description,
        earliest_membership: membership.created_at,
        roles: [],
      });
    }

    // Add role to this issuer
    issuerMap.get(issuerId).roles.push({
      name: membership.roles_new?.role_name || "read_only",
      display_name: membership.roles_new?.display_name || "Read Only",
    });
  });

  // Convert to array and sort by earliest membership (primary issuer = oldest)
  return Array.from(issuerMap.values()).sort(
    (a, b) => new Date(a.earliest_membership) - new Date(b.earliest_membership),
  );
}

// Get user's primary issuer (oldest assigned issuer)
export async function getUserPrimaryIssuer() {
  const issuers = await getUserIssuers();
  return issuers.length > 0 ? issuers[0] : null;
}

// Get all user roles for a specific issuer
export async function getUserRolesForIssuer(issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_user_roles_for_issuer", {
    issuer_uuid: issuerId,
  });

  if (error) {
    console.error("Error fetching user roles for issuer:", error);
    return [];
  }

  return data || [];
}

// Get user's primary role for a specific issuer
export async function getUserPrimaryRoleForIssuer(issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_user_primary_role_for_issuer",
    {
      issuer_uuid: issuerId,
    },
  );

  if (error) {
    console.error("Error fetching user primary role for issuer:", error);
    return "read_only";
  }

  return data || "read_only";
}

// Get all user roles across all issuers
export async function getAllUserRoles() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_all_user_roles");

  if (error) {
    console.error("Error fetching all user roles:", error);
    return [];
  }

  return data || [];
}

// Validate issuer access and get issuer info
export async function validateIssuerAccess(issuerId) {
  const supabase = await createClient();

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasAccess: false, issuer: null, userRole: null };

  // Get user role
  const userRole = await getCurrentUserRole();

  // Superadmins have access to all issuers
  if (userRole === "superadmin") {
    // Get issuer info
    const { data: issuer } = await supabase
      .from("issuers_new")
      .select("id, issuer_name, display_name, description")
      .eq("id", issuerId)
      .single();

    return {
      hasAccess: true,
      issuer: issuer
        ? {
            issuer_id: issuer.id,
            issuer_name: issuer.issuer_name,
            issuer_display_name: issuer.display_name,
            issuer_description: issuer.description,
          }
        : null,
      userRole,
    };
  }

  // For other users, check issuer_users table
  const hasAccess = await userHasIssuerAccess(issuerId);
  if (!hasAccess) {
    console.log("bro failed bro");
    return { hasAccess: false, issuer: null, userRole };
  }

  // Get user's available issuers to find the current one
  const availableIssuers = await getUserIssuers();
  const currentIssuer = availableIssuers.find(
    (issuer) => issuer.issuer_id === issuerId,
  );

  return {
    hasAccess: true,
    issuer: currentIssuer || null,
    userRole,
  };
}

// Check if user has access to specific issuer
export async function userHasIssuerAccess(issuerId) {
  const supabase = await createClient();

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if user is superadmin (has access to all issuers)
  const { data: userData } = await supabase
    .from("users_new")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (userData?.is_super_admin === true) return true;

  // Check specific issuer membership (user might have multiple roles, so don't use .single())
  const { data, error } = await supabase
    .from("issuer_users_new")
    .select("id")
    .eq("user_id", user.id)
    .eq("issuer_id", issuerId)
    .limit(1);

  if (error) {
    console.error("Error checking issuer access:", error);
    return false;
  }

  return data && data.length > 0;
}

// Add existing user to additional issuer
export async function addUserToIssuer(userId, issuerId, roleId) {
  const supabase = await createClient();

  try {
    // Check if user is already a member of this issuer
    const { data: existingMembership } = await supabase
      .from("issuer_users_new")
      .select("id")
      .eq("user_id", userId)
      .eq("issuer_id", issuerId)
      .single();

    if (existingMembership) {
      return {
        success: false,
        error: "User is already a member of this issuer",
      };
    }

    // Add user to issuer
    const { error } = await supabase.from("issuer_users_new").insert({
      user_id: userId,
      issuer_id: issuerId,
      role_id: roleId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Set primary issuer for user (placeholder - is_primary column not implemented)
export async function setPrimaryIssuer(userId, issuerId) {
  // This function is not implemented as is_primary column doesn't exist
  // Users will use the first issuer they have access to
  return { success: true };
}

// Get user's role for specific issuer
export async function getUserIssuerRole(userEmail, issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issuer_users_new")
    .select(
      `
      roles_new (
        role_name,
        display_name
      )
    `,
    )
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
    .eq("issuer_id", issuerId)
    .single();

  if (error || !data) return null;

  return data.roles?.name || "read_only";
}

// Get pending invitations for admin dashboard (ONLY issuer admin invitations)
export async function getPendingInvitations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invited_users_new")
    .select(
      `
      email,
      name,
      invited_at,
      role_id,
      issuer_id,
      roles_new (
        role_name,
        display_name
      ),
      issuers_new (
        id,
        issuer_name,
        display_name
      )
    `,
    )
    .eq("roles_new.role_name", "admin") // Only show admin invitations
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending invitations:", error);
    return [];
  }

  return data.map((invitation) => ({
    email: invitation.email,
    name: invitation.name,
    issuer_name: invitation.issuers_new?.name,
    issuer_display_name: invitation.issuers_new?.display_name,
    role_name: invitation.roles_new?.role_name,
    invited_at: invitation.invited_at,
  }));
}

// Get issuer statistics for admin dashboard
export async function getIssuerStatistics() {
  const supabase = await createClient();

  const { data: issuers, error: issuersError } = await supabase
    .from("issuers_new")
    .select("id");

  // Only count issuer admin invitations for pending invites
  const { data: pendingInvites, error: invitesError } = await supabase
    .from("invited_users_new")
    .select(
      `
      id,
      role_id,
      roles_new!inner(
        role_name
      )
    `,
    )
    .eq("roles_new.role_name", "admin");

  if (issuersError || invitesError) {
    console.error("Error fetching issuer statistics:", {
      issuersError,
      invitesError,
    });
    return { total_companies: 0, active_companies: 0, pending_invites: 0 };
  }

  const totalCompanies = issuers?.length || 0;
  const activeCompanies = totalCompanies; // All issuers are active (no status field)
  const pendingInvitesCount = pendingInvites?.length || 0;

  return {
    total_companies: totalCompanies,
    active_companies: activeCompanies,
    pending_invites: pendingInvitesCount,
  };
}

// Create new issuer (admin only)
export async function createIssuer(issuerData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if user is super admin
  const { data: userData } = await supabase
    .from("users_new")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!userData?.is_super_admin) {
    throw new Error("Only super admins can create issuers");
  }

  // Create issuer
  const { data: issuer, error: issuerError } = await supabase
    .from("issuers_new")
    .insert({
      name: issuerData.name,
      display_name: issuerData.display_name,
      description: issuerData.description,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (issuerError) throw issuerError;

  // Create invitation for issuer admin
  const { error: inviteError } = await supabase
    .from("invited_users_new")
    .insert({
      email: issuerData.admin_email,
      name: issuerData.admin_name,
      role_id: issuerData.role_id,
      issuer_id: issuer.id,
    });

  if (inviteError) throw inviteError;

  revalidatePath("/issuers");
  return issuer;
}

// Invite user to issuer
export async function inviteUserToIssuer(invitationData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if user has permission to invite (super admin or issuer admin)
  const { data: userData } = await supabase
    .from("users_new")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!userData?.is_super_admin) {
    // Check if user is issuer admin for this issuer
    const { data: issuerUser } = await supabase
      .from("issuer_users_new")
      .select(
        `
        roles_new (
          role_name
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("issuer_id", invitationData.issuer_id)
      .single();

    if (issuerUser?.roles_new?.role_name !== "admin") {
      throw new Error("Only admins can invite users");
    }
  }

  // Create invitation
  const { error } = await supabase.from("invited_users_new").insert({
    email: invitationData.email,
    name: invitationData.name,
    role_id: invitationData.role_id,
    issuer_id: invitationData.issuer_id,
  });

  if (error) throw error;

  revalidatePath("/issuers");
  return { success: true };
}

// ========== RECORD KEEPING BOOK AND CONTROL BOOK ACTIONS ==========

// Get CUSIP details for an issuer
export async function getCusipDetails(issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("securities_new")
    .select("*")
    .eq("issuer_id", issuerId)
    .eq("status", "active")
    .order("issue_name");

  if (error) throw error;
  return data;
}

// Get shareholders for an issuer
export async function getShareholders(issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shareholders_new")
    .select("*")
    .eq("issuer_id", issuerId)
    .eq("status", "active")
    .order("last_name");

  if (error) throw error;
  return data;
}

// Get record keeping transactions
export async function getRecordKeepingTransactions(issuerId, filters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("transfers_new")
    .select(
      `
      *,
      shareholders (
        account_number,
        last_name,
        first_name
      ),
      cusip_details (
        issue_name,
        issue_ticker,
        security_type
      )
    `,
    )
    .eq("issuer_id", issuerId);

  // Apply filters
  if (filters.cusip) {
    query = query.eq("cusip", filters.cusip);
  }
  if (filters.shareholder_id) {
    query = query.eq("shareholder_id", filters.shareholder_id);
  }
  if (filters.transaction_type) {
    query = query.eq("transaction_type", filters.transaction_type);
  }
  if (filters.date_from) {
    query = query.gte("transaction_date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("transaction_date", filters.date_to);
  }

  const { data, error } = await query.order("transaction_date", {
    ascending: false,
  });

  if (error) throw error;
  return data;
}

// Get control book daily summary
export async function getControlBookSummary(issuerId, filters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("statements_new")
    .select(
      `
      *,
      cusip_details (
        issue_name,
        issue_ticker,
        security_type
      )
    `,
    )
    .eq("issuer_id", issuerId);

  // Apply filters
  if (filters.cusip) {
    query = query.eq("cusip", filters.cusip);
  }
  if (filters.date_from) {
    query = query.gte("summary_date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("summary_date", filters.date_to);
  }

  const { data, error } = await query.order("summary_date", {
    ascending: false,
  });

  if (error) throw error;
  return data;
}

// Get shareholders as of a specific date
export async function getShareholdersAsOfDate(issuerId, cusip, asOfDate) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_shareholders_as_of_date", {
    p_issuer_id: issuerId,
    p_cusip: cusip,
    p_as_of_date: asOfDate,
  });

  if (error) throw error;
  return data;
}

// Add new record keeping transaction
export async function addRecordKeepingTransaction(transactionData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Validate authorized shares before inserting
  const { data: cusipData } = await supabase
    .from("securities_new")
    .select("total_authorized_shares")
    .eq("issuer_id", transactionData.issuer_id)
    .eq("cusip", transactionData.cusip)
    .single();

  if (cusipData?.total_authorized_shares) {
    // Get current outstanding shares
    const { data: currentSummary } = await supabase
      .from("statements_new")
      .select("total_outstanding_shares")
      .eq("issuer_id", transactionData.issuer_id)
      .eq("cusip", transactionData.cusip)
      .order("summary_date", { ascending: false })
      .limit(1)
      .single();

    const currentOutstanding = currentSummary?.total_outstanding_shares || 0;
    const transactionImpact =
      transactionData.credit_debit === "Credit"
        ? transactionData.quantity
        : -transactionData.quantity;
    const newTotal = currentOutstanding + transactionImpact;

    if (newTotal > cusipData.total_authorized_shares) {
      throw new Error(
        `Transaction would exceed total authorized shares. Current: ${currentOutstanding.toLocaleString()}, Authorized: ${cusipData.total_authorized_shares.toLocaleString()}, New Total: ${newTotal.toLocaleString()}`,
      );
    }
  }

  const { data, error } = await supabase
    .from("transfers_new")
    .insert({
      ...transactionData,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/issuer/${transactionData.issuer_id}/record-keeping`);
  revalidatePath(`/issuer/${transactionData.issuer_id}/control-book`);

  return data;
}

// Add new shareholder
export async function addShareholder(shareholderData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("shareholders_new")
    .insert({
      ...shareholderData,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/issuer/${shareholderData.issuer_id}/record-keeping`);

  return data;
}

// Add new CUSIP detail
export async function addCusipDetail(cusipData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("securities_new")
    .insert({
      ...cusipData,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/issuer/${cusipData.issuer_id}/record-keeping`);
  revalidatePath(`/issuer/${cusipData.issuer_id}/control-book`);

  return data;
}

// Update shareholder
export async function updateShareholder(shareholderId, updateData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shareholders_new")
    .update(updateData)
    .eq("id", shareholderId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/issuer/${updateData.issuer_id}/record-keeping`);

  return data;
}

// Update CUSIP detail
export async function updateCusipDetail(cusipId, updateData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("securities_new")
    .update(updateData)
    .eq("id", cusipId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/issuer/${updateData.issuer_id}/record-keeping`);
  revalidatePath(`/issuer/${updateData.issuer_id}/control-book`);

  return data;
}

// Delete record keeping transaction
export async function deleteRecordKeepingTransaction(transactionId, issuerId) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transfers_new")
    .delete()
    .eq("id", transactionId);

  if (error) throw error;

  revalidatePath(`/issuer/${issuerId}/record-keeping`);
  revalidatePath(`/issuer/${issuerId}/control-book`);

  return { success: true };
}

// Get transaction statistics
export async function getTransactionStats(issuerId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transfers_new")
    .select("transaction_type, quantity, credit_debit")
    .eq("issuer_id", issuerId);

  if (error) throw error;

  const stats = {
    totalTransactions: data.length,
    totalCredits: data
      .filter((t) => t.credit_debit === "Credit")
      .reduce((sum, t) => sum + t.quantity, 0),
    totalDebits: data
      .filter((t) => t.credit_debit === "Debit")
      .reduce((sum, t) => sum + t.quantity, 0),
    byType: {},
  };

  data.forEach((transaction) => {
    if (!stats.byType[transaction.transaction_type]) {
      stats.byType[transaction.transaction_type] = 0;
    }
    stats.byType[transaction.transaction_type]++;
  });

  return stats;
}



// ========== RESTRICTED STOCK DOCUMENT ACTIONS ==========

export async function getRestrictedStockDocuments(issuerId) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("Auth error in getRestrictedStockDocuments:", authError);
    return [];
  }

  const userRole = await getCurrentUserRole();
  console.log("Fetching docs for role:", userRole);

  if (userRole === "broker") {
    // Brokers: get docs with their own submissions
    let query = supabase
      .from("docs_for_restricted_shares")
      .select(`
        id, 
        issuer_id, 
        issuer_name, 
        document_type, 
        description, 
        required,
        broker_doc_submissions!left (
          id, 
          status, 
          file_url, 
          comments,
          broker_id
        )
      `);

    // Filter by broker's submissions only
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching restricted stock documents:", error);
      return [];
    }

    console.log("Raw broker data:", data);

    // Filter to only show docs where broker has submissions OR all docs if no filter
    const filteredData = data.map(doc => ({
      ...doc,
      broker_doc_submissions: (doc.broker_doc_submissions || []).filter(
        sub => sub.broker_id === user.id
      )
    }));

    // Group documents by issuer
    const groupedDocs = filteredData.reduce((acc, doc) => {
      const issuerId = doc.issuer_id;
      if (!acc[issuerId]) {
        acc[issuerId] = {
          issuer_id: issuerId,
          issuer_name: doc.issuer_name || 'Unknown Issuer',
          documents: [],
        };
      }
      
      acc[issuerId].documents.push({
        id: doc.id,
        issuer_id: doc.issuer_id, // Include issuer_id at document level
        document_type: doc.document_type,
        description: doc.description,
        required: doc.required,
        submission: doc.broker_doc_submissions?.[0] || null,
      });
      
      return acc;
    }, {});

    console.log("Grouped broker docs:", groupedDocs);
    return Object.values(groupedDocs);
  }

  if (userRole === "admin" || userRole === "superadmin") {
    // Admins: all docs with all submissions
    let query = supabase
      .from("docs_for_restricted_shares")
      .select(`
        id, 
        issuer_id, 
        issuer_name, 
        document_type, 
        description, 
        required,
        broker_doc_submissions (
          id, 
          broker_id, 
          status, 
          file_url, 
          comments, 
          submitted_at
        )
      `);

    if (issuerId) {
      query = query.eq("issuer_id", issuerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching restricted stock documents:", error);
      return [];
    }

    console.log("Raw admin data:", data);

    // Group by issuer, then by broker
    const grouped = data.reduce((acc, doc) => {
      const issuerId = doc.issuer_id;
      if (!acc[issuerId]) {
        acc[issuerId] = {
          issuer_id: issuerId,
          issuer_name: doc.issuer_name || 'Unknown Issuer',
          documents: [],
          brokers: {},
        };
      }

      // Add document with issuer_id
      acc[issuerId].documents.push({
        id: doc.id,
        issuer_id: doc.issuer_id, // Include issuer_id at document level
        document_type: doc.document_type,
        description: doc.description,
        required: doc.required,
        submissions: doc.broker_doc_submissions || [],
      });

      // Group submissions by broker
      (doc.broker_doc_submissions || []).forEach(sub => {
        if (!acc[issuerId].brokers[sub.broker_id]) {
          acc[issuerId].brokers[sub.broker_id] = {
            id: sub.broker_id,
            name: `Broker ${sub.broker_id.slice(0, 8)}`,
            docs: [],
          };
        }
        acc[issuerId].brokers[sub.broker_id].docs.push({
          id: doc.id,
          document_type: doc.document_type,
          submission_id: sub.id,
          file_url: sub.file_url,
          status: sub.status,
        });
      });

      return acc;
    }, {});

    // Convert brokers object to array
    const result = Object.values(grouped).map(issuer => ({
      ...issuer,
      brokers: Object.values(issuer.brokers),
    }));

    console.log("Grouped admin docs:", result);
    return result;
  }

  return [];
}

export async function submitForVerification(issuerId) {
  console.log("submitForVerification called:", issuerId);
  
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("You must be logged in");
    }

    const { error } = await supabase
      .from("broker_doc_submissions")
      .update({ 
        status: "AwaitingVerification",
        submitted_at: new Date().toISOString()
      })
      .eq("broker_id", user.id)
      .eq("issuer_id", issuerId)
      .eq("status", "Uploaded");

    if (error) {
      console.error("Submit error:", error);
      throw new Error(`Submit failed: ${error.message}`);
    }

    console.log("Documents submitted for verification");
    revalidatePath('/information');
    return { success: true };
    
  } catch (error) {
    console.error("Submit error in action:", error);
    throw error;
  }
}

export async function reviewSubmission(submissionId, action, comments = "") {
  console.log("reviewSubmission called:", { submissionId, action, comments });
  
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("You must be logged in");
    }

    // Verify user is admin
    const userRole = await getCurrentUserRole();
    if (userRole !== "admin" && userRole !== "superadmin") {
      throw new Error("Only admins can review submissions");
    }

    if (!["Accepted", "Rejected"].includes(action)) {
      throw new Error("Invalid action. Must be 'Accepted' or 'Rejected'");
    }

    const { data, error } = await supabase
      .from("broker_doc_submissions")
      .update({
        status: action,
        comments: comments || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select()
      .single();

    if (error) {
      console.error("Review error:", error);
      throw new Error(`Review failed: ${error.message}`);
    }

    console.log("Submission reviewed:", data);
    revalidatePath('/information');
    return data;
    
  } catch (error) {
    console.error("Review error in action:", error);
    throw error;
  }
}

// ========== RESTRICTED STOCK DOCUMENT ACTIONS ==========

export async function uploadRestrictedDocument(issuerId, docId, file) {
  console.log("uploadRestrictedDocument called:", { issuerId, docId, fileName: file.name });
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("You must be logged in to upload documents");
    }
    
    console.log("User authenticated:", user.id);
    console.log("Uploading for issuer:", issuerId, "doc:", docId);
    
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${user.id}/${issuerId}/${docId}/${timestamp}.${fileExt}`;
    
    console.log("Uploading to storage:", fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('restricted-stock-docs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    console.log("File uploaded successfully:", uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('restricted-stock-docs')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error("Failed to get file URL");
    }

    console.log("Public URL obtained:", urlData.publicUrl);

    // Create submission record in database
    console.log("Creating submission record with:", {
      broker_id: user.id,
      issuer_id: issuerId,
      doc_id: docId,
    });

    const { data: submissionData, error: dbError } = await supabase
      .from("broker_doc_submissions")
      .upsert(
        {
          broker_id: user.id,
          issuer_id: issuerId,
          doc_id: docId,
          file_url: urlData.publicUrl,
          status: "Uploaded",
          submitted_at: new Date().toISOString(),
        },
        { 
          onConflict: "broker_id,doc_id",
          ignoreDuplicates: false 
        }
      )
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('restricted-stock-docs').remove([fileName]);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("Submission record created:", submissionData);

    revalidatePath('/information');
    return submissionData;
    
  } catch (error) {
    console.error("Upload error in action:", error);
    throw error;
  }
}
