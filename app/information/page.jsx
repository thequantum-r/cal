"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, X, Building2, ChevronRight } from "lucide-react";
import { normalizeText } from "@/lib/utils";

export default function RecordsManagementHome() {
  const router = useRouter();
  const {
    user,
    userRole,
    currentIssuer,
    availableIssuers,
    issuerSpecificRole,
    loading: authLoading,
    initialized,
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [issuers, setIssuers] = useState([]);
  const [error, setError] = useState(null);

  const isBroker = userRole === "broker";

  useEffect(() => {
    const fetchIssuers = async () => {
      if (!initialized || authLoading) return;
      setPageLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/issuers');
        if (!response.ok) throw new Error("Failed to fetch issuers");
        const data = await response.json();
        setIssuers(data || []);
      } catch (err) {
        console.error("Failed to fetch issuers:", err);
        setError("Failed to load issuers. Please try again.");
        setIssuers([]);
      } finally {
        setPageLoading(false);
      }
    };
    fetchIssuers();
  }, [initialized, authLoading]);

  const filteredIssuers = issuers.filter((issuer) => {
    const issuerName = issuer.issuer_name || issuer.name || "";
    const matchesSearch = issuerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleIssuerClick = (issuerId) => {
    router.push(`/information/${issuerId}`);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      {!isBroker && (
        <Sidebar
          userRole={userRole}
          currentIssuerId={null}
          issuerSpecificRole={issuerSpecificRole}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          userRole={userRole}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />

        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-7xl mx-auto px-6">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Records Management
              </h1>
              <p className="text-lg text-gray-600">
                Select an issuer to view documents, securities administration, and transfer agent requests
              </p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-6">
              <Input
                type="text"
                placeholder="Search issuers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xl"
              />
            </div>

            {/* Loading State */}
            {pageLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading issuers...</p>
              </div>
            ) : (
              <div>
                {filteredIssuers.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-gray-600">
                      {searchTerm
                        ? "No issuers found matching your search"
                        : "No issuers available"}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredIssuers.map((issuer) => (
                      <Card
                        key={issuer.id}
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-orange-300 group"
                        onClick={() => handleIssuerClick(issuer.id)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-400 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-7 h-7 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-orange-600 transition-colors mb-1">
                                  {normalizeText(issuer.issuer_name || issuer.name) || "Unknown Issuer"}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  {issuer.ticker && (
                                    <span className="font-mono font-medium text-gray-700">{issuer.ticker}</span>
                                  )}
                                  {issuer.incorporation_state && (
                                    <span>
                                      <span className="font-medium">State:</span> {issuer.incorporation_state}
                                    </span>
                                  )}
                                  {issuer.authorized_shares && (
                                    <span>
                                      <span className="font-medium">Authorized Shares:</span>{" "}
                                      {issuer.authorized_shares.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-orange-600 transition-colors flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
