"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ImportDataBox from "@/components/ImportDataBox";
import { createClient } from "@/lib/supabase/client";
import ImportForm from "@/components/ImportForm";

export default function Home() {
  const { user, userRole, availableIssuers, loading, initialized } = useAuth();
  const router = useRouter();
  const [isVerifiedSuperAdmin, setIsVerifiedSuperAdmin] = useState(false);
  const [checkingSuperAdmin, setCheckingSuperAdmin] = useState(false);
  
  // Check if user is a super admin (either from role or verified check)
  const isSuperAdmin = userRole === "superadmin" || isVerifiedSuperAdmin;

  useEffect(() => {
    if (initialized && !loading) {
      if (!user) {
        router.push("/login");
        return;
      }

      // Redirect shareholders to their specific dashboard
      if (userRole === 'shareholder') {
        router.push("/shareholder");
        return;
      }

      // Redirect brokers to information screen
      if (userRole === 'broker') {
        router.push("/information");
        return;
      }

      // Don't redirect super admins if they have no issuers - let them see the UI
      if (isSuperAdmin && availableIssuers.length === 0) {
        return; // Stay on this page to show the super admin dashboard
      }

      // Redirect other users to primary issuer if available
      if (availableIssuers.length > 0) {
        const primaryIssuer = availableIssuers[0];
        router.push(`/issuer/${primaryIssuer.issuer_id}/record-keeping`);
      }
    }
  }, [user, userRole, availableIssuers, loading, initialized, router, isSuperAdmin]);

  // Fallback check for super admin status if role detection failed
  useEffect(() => {
    const checkSuperAdminStatus = async () => {
      // Check if user exists and we haven't already verified super admin status
      if (user && !isSuperAdmin && !checkingSuperAdmin) {
        setCheckingSuperAdmin(true);
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("users_new")
            .select("is_super_admin")
            .eq("id", user.id)
            .single();

          if (!error && data?.is_super_admin === true) {
            console.log("Fallback super admin check successful");
            setIsVerifiedSuperAdmin(true);
          }
        } catch (error) {
          console.error("Error in fallback super admin check:", error);
        } finally {
          setCheckingSuperAdmin(false);
        }
      }
    };

    if (initialized && !loading) {
      checkSuperAdminStatus();
    }
  }, [user, isSuperAdmin, checkingSuperAdmin, initialized, loading]);

  // Show loading state
  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check for URL error parameters
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");

    if (error === "no_access") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
          <div className="card-glass p-8 text-center max-w-md">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4 text-gray-900">
              Access Denied
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              You don't have access to this issuer
            </p>
            <p className="text-sm text-gray-500">
              Contact your administrator for assistance
            </p>
          </div>
        </div>
      );
    }
  }

  // Special case for super admins with no issuers - show dashboard with import
  if (user && isSuperAdmin && availableIssuers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="card-glass p-8 text-center max-w-md">
          
          <h1 className="text-3xl font-bold mb-4 text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            No issuers have been created yet. Create your first issuer or import data to get started.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={() => router.push('/issuers')}
              className="group relative h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 w-48"
            >
              Manage Issuers
            </Button>

            {/* Import data box for superadmins */}
            <div className="w-full mt-2">
              <ImportDataBox />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show no access message if user has no issuers (but not for super admins)
  if (user && availableIssuers.length === 0 && !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="card-glass p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-gray-900">
            No Issuer Access
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            You haven't been assigned to any issuers yet
          </p>
          <p className="text-sm text-gray-500">
            Contact your administrator to request access
          </p>
        </div>
      </div>
    );
  }

  // This component will redirect via useEffect, show loading
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}