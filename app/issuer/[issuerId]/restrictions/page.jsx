"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  ArrowUpDown,
  Building,
  User,
  Search,
  Download,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  Database,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  Shield,
  AlertTriangle,
  FileText,
  Users,
  Settings,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function RestrictionsPage({ params: paramsPromise }) {
  const { user, userRole, userRoles, currentIssuer, availableIssuers, issuerSpecificRole, loading, initialized, validateAndSetIssuer, canEdit, isAdmin } = useAuth();
  const router = useRouter();
  const [issuerId, setIssuerId] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Data states
  const [restrictionTemplates, setRestrictionTemplates] = useState([]);
  const [shareRestrictions, setShareRestrictions] = useState([]);
  const [shareholderRestrictions, setShareholderRestrictions] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [securities, setSecurities] = useState([]);
  const [users, setUsers] = useState([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCusip, setSelectedCusip] = useState("all");
  const [selectedShareholder, setSelectedShareholder] = useState("all");
  const [selectedRestrictionType, setSelectedRestrictionType] = useState("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Modal states
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddShareRestriction, setShowAddShareRestriction] = useState(false);
  const [showAddShareholderRestriction, setShowAddShareholderRestriction] =
    useState(false);
  const [showViewRestriction, setShowViewRestriction] = useState(false);
  const [selectedRestriction, setSelectedRestriction] = useState(null);

  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise;
      setIssuerId(params.issuerId);
    };
    getParams();
  }, [paramsPromise]);

  useEffect(() => {
    if (!initialized || !issuerId) return;
    checkAuthAndFetchData();
  }, [initialized, issuerId, user, validateAndSetIssuer]);

  const checkAuthAndFetchData = async () => {
    try {
      if (!user) {
        router.push('/login');
        return;
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId);
      
      if (!hasAccess) {
        router.push('/?error=no_access');
        return;
      }

      // Fetch data
      await fetchData();
    } catch (error) {
      console.error("Error in auth check:", error);
    }
  };

  const fetchData = async () => {
    try {
      setPageLoading(true);

      // Fetch all data in parallel
      const [
        templatesRes,
        shareRestrictionsRes,
        shareholderRestrictionsRes,
        shareholdersRes,
        securitiesRes,
        usersRes,
      ] = await Promise.all([
        fetch(`/api/restriction-templates?issuerId=${issuerId}`),
        fetch(`/api/share-restrictions?issuerId=${issuerId}`),
        fetch(`/api/shareholder-restrictions?issuerId=${issuerId}`),
        fetch(`/api/shareholders?issuerId=${issuerId}`),
        fetch(`/api/securities?issuerId=${issuerId}`),
        fetch("/api/users"),
      ]);

      const templates = await templatesRes.json();
      const shareRestrictions = await shareRestrictionsRes.json();
      const shareholderRestrictions = await shareholderRestrictionsRes.json();
      const shareholders = await shareholdersRes.json();
      const securities = await securitiesRes.json();
      const users = await usersRes.json();

      // Debug logging and error handling
      console.log("🔍 API Response debugging:", {
        templates: {
          type: typeof templates,
          isArray: Array.isArray(templates),
          data: templates,
        },
        shareRestrictions: {
          type: typeof shareRestrictions,
          isArray: Array.isArray(shareRestrictions),
        },
        shareholderRestrictions: {
          type: typeof shareholderRestrictions,
          isArray: Array.isArray(shareholderRestrictions),
        },
        shareholders: {
          type: typeof shareholders,
          isArray: Array.isArray(shareholders),
        },
        securities: {
          type: typeof securities,
          isArray: Array.isArray(securities),
        },
      });

      setRestrictionTemplates(Array.isArray(templates) ? templates : []);
      setShareRestrictions(
        Array.isArray(shareRestrictions) ? shareRestrictions : [],
      );
      setShareholderRestrictions(
        Array.isArray(shareholderRestrictions) ? shareholderRestrictions : [],
      );
      setShareholders(Array.isArray(shareholders) ? shareholders : []);
      setSecurities(Array.isArray(securities) ? securities : []);
      setUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setPageLoading(false);
    }
  };

  const createRestrictionTemplate = async (templateData) => {
    try {
      const response = await fetch("/api/restriction-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...templateData,
          issuer_id: issuerId,
        }),
      });

      if (response.ok) {
        await fetchData();
        setShowAddTemplate(false);
      }
    } catch (error) {
      console.error("Error creating restriction template:", error);
    }
  };

  const createShareRestriction = async (restrictionData) => {
    try {
      const response = await fetch("/api/share-restrictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...restrictionData,
          issuer_id: issuerId,
        }),
      });

      if (response.ok) {
        await fetchData();
        setShowAddShareRestriction(false);
      }
    } catch (error) {
      console.error("Error creating share restriction:", error);
    }
  };

  const createShareholderRestriction = async (restrictionData) => {
    try {
      console.log("Creating shareholder restriction:", restrictionData);
      
      const response = await fetch("/api/shareholder-restrictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...restrictionData,
          issuer_id: issuerId,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log("Restriction created successfully:", result);
        await fetchData();
        setShowAddShareholderRestriction(false);
      } else {
        console.error("Error creating restriction:", result);
        alert(`Error: ${result.error || 'Failed to create restriction'}`);
      }
    } catch (error) {
      console.error("Error creating shareholder restriction:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Helper function to get user name from user ID
  const getUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      return user.email?.split("@")[0] || "Unknown";
    }
    return "Unknown";
  };

  if (loading || !initialized || pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <Sidebar
          userRole={userRole}
          currentIssuerId={issuerId}
          issuerSpecificRole={issuerSpecificRole}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            user={user}
            userRole={userRole}
            userRoles={userRoles}
            currentIssuer={currentIssuer}
            availableIssuers={availableIssuers}
            issuerSpecificRole={issuerSpecificRole}
          />

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Restrictions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission checks using AuthContext
  const canEditRestrictions = canEdit || isAdmin();
  const canView =
    userRole === "superadmin" ||
    userRole === "admin" ||
    userRole === "transfer_team";

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      <Sidebar
        userRole={userRole}
        currentIssuerId={issuerId}
        issuerSpecificRole={issuerSpecificRole}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          userRole={userRole}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-6">
              {/* Page Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                      Restrictions Management
                    </h1>
                    <p className="text-lg text-gray-600">
                      Manage restriction templates and apply restrictions to
                      shareholders
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {canEditRestrictions && (
                      <>
                        <Button
                          variant="outline"
                          className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                          onClick={() => setShowAddTemplate(true)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Add Template
                        </Button>

                        <Button
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                          onClick={() => setShowAddShareholderRestriction(true)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Apply Restriction
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Restriction Templates
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {restrictionTemplates.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Share Restrictions
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {shareRestrictions.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Applied Restrictions
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {shareholderRestrictions.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Active Restrictions
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {
                          shareholderRestrictions.filter(
                            (r) => r.is_active !== false,
                          ).length
                        }
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Tabs */}
              <Tabs defaultValue="templates" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="templates">
                    Restriction Templates
                  </TabsTrigger>
                  <TabsTrigger value="applied-restrictions">
                    Applied Restrictions
                  </TabsTrigger>
                </TabsList>

                {/* Restriction Templates Tab */}
                <TabsContent value="templates" className="space-y-6">
                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="mr-2 h-5 w-5" />
                          Restriction Templates
                        </div>
                        {canEditRestrictions && (
                          <Button
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                            onClick={() => setShowAddTemplate(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Template
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Master restriction definitions that can be applied to
                        shareholders
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {restrictionTemplates.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                          <div className="text-center">
                            <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              No restriction templates found
                            </h3>
                            <p className="text-gray-500 mb-4">
                              Create your first restriction template to get
                              started
                            </p>
                            {canEditRestrictions && (
                              <Button
                                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                                onClick={() => setShowAddTemplate(true)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Template
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">
                                Code
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Legend
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Status
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Created By
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Created At
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(restrictionTemplates || []).map((template) => (
                              <TableRow key={template.id}>
                                <TableCell className="font-medium whitespace-nowrap">
                                  {template.restriction_type}
                                </TableCell>
                                <TableCell
                                  className="max-w-xs truncate whitespace-nowrap"
                                  title={template.description}
                                >
                                  {template.description}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge
                                    className={
                                      template.is_active
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                                        : "bg-gray-200 text-gray-700"
                                    }
                                  >
                                    {template.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {getUserName(template.created_by)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(
                                    template.created_at,
                                  ).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-orange-300 hover:bg-orange-50 text-orange-700"
                                    onClick={() => {
                                      setSelectedRestriction(template);
                                      setShowViewRestriction(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Applied Restrictions Tab */}
                <TabsContent value="applied-restrictions" className="space-y-6">
                  <Card className="card-glass border-0">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Users className="mr-2 h-5 w-5" />
                          Applied Restrictions
                        </div>
                        {canEditRestrictions && (
                          <Button
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                            onClick={() =>
                              setShowAddShareholderRestriction(true)
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Apply Restriction
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Restrictions currently applied to shareholders
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {shareholderRestrictions.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                          <div className="text-center">
                            <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              No applied restrictions found
                            </h3>
                            <p className="text-gray-500 mb-4">
                              Apply restrictions to shareholders to get started
                            </p>
                            {canEditRestrictions && (
                              <Button
                                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                                onClick={() =>
                                  setShowAddShareholderRestriction(true)
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Apply Restriction
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">
                                Shareholder
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                CUSIP
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Restriction
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Share Balance
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Applied At
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(shareholderRestrictions || []).map(
                              (restriction) => {
                                const shareholder = shareholders.find(
                                  (sh) => sh.id === restriction.shareholder_id,
                                );
                                const restrictionTemplate = restrictionTemplates.find(
                                  (rt) => rt.id === restriction.restriction_id,
                                );

                                return (
                                  <TableRow key={restriction.id}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                      {shareholder ? `${shareholder.first_name || ''} ${shareholder.last_name || ''}`.trim() : "Unknown"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {restriction.cusip}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {restrictionTemplate?.restriction_type ||
                                        "Unknown"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {restriction.restricted_shares?.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {new Date(
                                        restriction.created_at,
                                      ).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-orange-300 hover:bg-orange-50 text-orange-700"
                                        onClick={() => {
                                          setSelectedRestriction(restriction);
                                          setShowViewRestriction(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* Add Restriction Template Modal */}
      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Add Restriction Template
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Create a new restriction template that can be applied to
                  shareholders
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createRestrictionTemplate({
                code: formData.get("code"),
                legend: formData.get("legend"),
                is_active: formData.get("is_active") === "on",
              });
            }}
          >
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="code"
                  className="text-sm font-medium text-gray-700"
                >
                  Restriction Code
                </Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="e.g., A, B, 144A"
                  className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                  required
                />
              </div>
              <div>
                <Label
                  htmlFor="legend"
                  className="text-sm font-medium text-gray-700"
                >
                  Restriction Legend
                </Label>
                <Textarea
                  id="legend"
                  name="legend"
                  placeholder="Enter the full restriction legend text (this is the restriction description)"
                  className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                  rows={8}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  This is the complete restriction text that will be applied to
                  shareholders
                </p>
              </div>
              <div>
                <Label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Status
                </Label>
                <div className="mt-1 flex items-center space-x-2">
                  <Switch id="is_active" name="is_active" defaultChecked />
                  <Label htmlFor="is_active" className="text-sm text-gray-600">
                    Active
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddTemplate(false)}
                className="bg-white/50 backdrop-blur-sm border border-white/20 hover:bg-white/70"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                Create Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Shareholder Restriction Modal */}
      <Dialog
        open={showAddShareholderRestriction}
        onOpenChange={setShowAddShareholderRestriction}
      >
        <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Apply Restriction to Shareholder
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Apply a restriction to a specific shareholder and security
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              
              const restrictionData = {
                shareholder_id: formData.get("shareholder_id"),
                restriction_id: formData.get("restriction_id"),
                cusip: formData.get("cusip"),
                restricted_shares: parseInt(formData.get("restricted_shares")),
              };
              
              console.log("Form data being sent:", restrictionData);
              console.log("All form values:", {
                shareholder_id: formData.get("shareholder_id"),
                restriction_id: formData.get("restriction_id"),
                cusip: formData.get("cusip"),
                restricted_shares: formData.get("restricted_shares"),
              });
              
              createShareholderRestriction(restrictionData);
            }}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="shareholder_id"
                    className="text-sm font-medium text-gray-700"
                  >
                    Shareholder
                  </Label>
                  <Select name="shareholder_id" required>
                    <SelectTrigger className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                      <SelectValue placeholder="Select shareholder" />
                    </SelectTrigger>
                    <SelectContent>
                      {(shareholders || []).map((shareholder) => (
                        <SelectItem key={shareholder.id} value={shareholder.id}>
                          {shareholder.account_number} - {[shareholder.first_name, shareholder.last_name].filter(Boolean).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="restriction_id"
                    className="text-sm font-medium text-gray-700"
                  >
                    Restriction
                  </Label>
                  <Select name="restriction_id" required>
                    <SelectTrigger className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                      <SelectValue placeholder="Select restriction" />
                    </SelectTrigger>
                    <SelectContent>
                      {(restrictionTemplates || []).map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.restriction_type} - {template.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="cusip"
                    className="text-sm font-medium text-gray-700"
                  >
                    CUSIP
                  </Label>
                  <Select name="cusip" required>
                    <SelectTrigger className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                      <SelectValue placeholder="Select CUSIP" />
                    </SelectTrigger>
                    <SelectContent>
                      {(securities || []).map((security) => (
                        <SelectItem key={security.id} value={security.cusip}>
                          {security.cusip} - {security.issue_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    htmlFor="restricted_shares"
                    className="text-sm font-medium text-gray-700"
                  >
                    Restricted Shares
                  </Label>
                  <Input
                    id="restricted_shares"
                    name="restricted_shares"
                    type="number"
                    placeholder="Number of shares to restrict"
                    className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddShareholderRestriction(false)}
                className="bg-white/50 backdrop-blur-sm border border-white/20 hover:bg-white/70"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                Apply Restriction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Restriction Modal */}
      <Dialog open={showViewRestriction} onOpenChange={setShowViewRestriction}>
        <DialogContent className="sm:max-w-[600px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Restriction Details
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  View detailed information about this restriction
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedRestriction && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Type
                </Label>
                <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {selectedRestriction.restriction_type || "-"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                  {selectedRestriction.description || "-"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      selectedRestriction.is_active ? "default" : "secondary"
                    }
                  >
                    {selectedRestriction.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Created At
                </Label>
                <p className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {new Date(selectedRestriction.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button
              onClick={() => setShowViewRestriction(false)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
