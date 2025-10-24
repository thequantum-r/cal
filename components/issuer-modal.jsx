"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Building,
  Plus,
  Trash2,
  Mail,
  Users,
  Hash,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function IssuerModal({ isOpen, onClose, issuer = null }) {
  const [formData, setFormData] = useState({
    company_name: "",
    description: "",
    issuer_email: "",
    issuer_name: "",
  });
  const [securities, setSecurities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchingSecurities, setFetchingSecurities] = useState(false);
  const router = useRouter();

  // Reset form when modal opens/closes or issuer changes
  useEffect(() => {
    if (isOpen) {
      if (issuer) {
        setFormData({
          company_name: issuer.display_name || "",
          description: issuer.description || "",
          issuer_email: "",
          issuer_name: "",
        });
        fetchExistingSecurities(issuer.id);
      } else {
        setFormData({
          company_name: "",
          description: "",
          issuer_email: "",
          issuer_name: "",
        });
        setSecurities([]);
      }
      setError("");
    }
  }, [isOpen, issuer]);

  const fetchExistingSecurities = async (issuerId) => {
    setFetchingSecurities(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("securities_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .order("created_at");

      if (error) throw error;
      setSecurities(data || []);
    } catch (error) {
      console.error("Error fetching securities:", error);
      setError("Error fetching securities: " + error.message);
    } finally {
      setFetchingSecurities(false);
    }
  };

  const addSecurity = () => {
    setSecurities([
      ...securities,
      {
        id: `temp-${Date.now()}`,
        security_type: "",
        issue_ticker: "",
        cusip: "",
        trading_platform: "",
      },
    ]);
  };

  const removeSecurity = (index) => {
    setSecurities(securities.filter((_, i) => i !== index));
  };

  const updateSecurity = (index, field, value) => {
    const updatedSecurities = [...securities];
    updatedSecurities[index] = { ...updatedSecurities[index], [field]: value };
    setSecurities(updatedSecurities);
  };

  const generateTechnicalName = async (companyName) => {
    const baseName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // Check if the base name already exists
    const supabase = createClient();
    const { data: existingIssuer } = await supabase
      .from("issuers_new")
      .select("issuer_name")
      .eq("issuer_name", baseName)
      .single();

    if (!existingIssuer) {
      return baseName;
    }

    // If exists, add a number suffix
    let counter = 1;
    let newName = `${baseName}_${counter}`;

    while (true) {
      const { data: existingIssuer } = await supabase
        .from("issuers_new")
        .select("issuer_name")
        .eq("issuer_name", newName)
        .single();

      if (!existingIssuer) {
        return newName;
      }

      counter++;
      newName = `${baseName}_${counter}`;
    }
  };

  const validateForm = () => {
    if (!formData.company_name.trim()) {
      setError("Company name is required");
      return false;
    }
    if (!issuer && !formData.issuer_email.trim()) {
      setError("Issuer email is required");
      return false;
    }
    if (securities.length === 0) {
      setError("At least one security is required");
      return false;
    }
    for (const security of securities) {
      if (
        !security.security_type ||
        !security.issue_ticker ||
        !security.trading_platform
      ) {
        setError("All security fields are required");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      const technicalName = await generateTechnicalName(formData.company_name);

      if (issuer) {
        // Update existing issuer
        const { error: issuerError } = await supabase
          .from("issuers_new")
          .update({
            display_name: formData.company_name,
            description: formData.description,
          })
          .eq("id", issuer.id);

        if (issuerError) throw issuerError;

        // Delete existing securities and insert new ones
        await supabase
          .from("securities_new")
          .delete()
          .eq("issuer_id", issuer.id);
      } else {
        // Create new issuer (no status field needed)
        const { data: newIssuerData, error: issuerError } = await supabase
          .from("issuers_new")
          .insert({
            name: technicalName,
            display_name: formData.company_name,
            description: formData.description,
          })
          .select();

        if (issuerError) throw issuerError;

        const newIssuer = newIssuerData?.[0];
        if (!newIssuer) {
          throw new Error("Failed to create issuer");
        }

        // Insert securities for the new issuer
        if (securities.length > 0) {
          const securitiesToInsert = securities.map((security) => ({
            issuer_id: newIssuer.id,
            issue_name: `${formData.company_name} ${security.security_type}`,
            security_type: security.security_type,
            issue_ticker: security.issue_ticker,
            cusip: security.cusip || null,
            trading_platform: security.trading_platform,
          }));

          const { error: securitiesError } = await supabase
            .from("securities_new")
            .insert(securitiesToInsert);

          if (securitiesError) throw securitiesError;
        }

        // Get admin role ID
        const { data: roleData, error: roleError } = await supabase
          .from("roles_new")
          .select("id")
          .eq("role_name", "admin");

        if (roleError) throw roleError;

        if (!roleData || roleData.length === 0) {
          throw new Error("Issuer admin role not found");
        }

        const roleId = roleData[0].id;

        // Create issuer admin invitation
        const { error: inviteError } = await supabase
          .from("invited_users_new")
          .insert({
            email: formData.issuer_email,
            name: formData.issuer_name || formData.company_name + " Admin",
            role_id: roleId,
            issuer_id: newIssuer.id, // Link to the specific issuer
          });

        if (inviteError) {
          // Handle specific duplicate email error
          if (inviteError.code === "23505") {
            throw new Error(
              `An invitation for ${formData.issuer_email} already exists. Please use a different email address.`,
            );
          }
          throw inviteError;
        }
      }

      // Insert securities for existing issuer (if updating)
      if (issuer && securities.length > 0) {
        const securitiesToInsert = securities.map((security) => ({
          issuer_id: issuer.id,
          issue_name: `${formData.company_name} ${security.security_type}`,
          security_type: security.security_type,
          issue_ticker: security.issue_ticker,
          cusip: security.cusip || null,
          trading_platform: security.trading_platform,
        }));

        const { error: securitiesError } = await supabase
          .from("securities_new")
          .insert(securitiesToInsert);

        if (securitiesError) throw securitiesError;
      }

      router.refresh();
      onClose();
    } catch (error) {
      console.error("Error saving issuer:", error);

      // Handle specific error types
      let errorMessage = "Error saving issuer: " + error.message;

      if (error.code === "23505") {
        if (error.message.includes("issuers_name_key")) {
          errorMessage =
            "A company with this name already exists. Please choose a different name.";
        } else if (error.message.includes("invited_users_pkey")) {
          errorMessage = `An invitation for ${formData.issuer_email} already exists. Please use a different email address.`;
        }
      } else if (error.code === "PGRST116") {
        errorMessage =
          "Company created successfully, but there was an issue retrieving the data. Please refresh the page.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {issuer ? "Edit Company" : "Add New Company"}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                {issuer
                  ? "Update company details and securities"
                  : "Add a new company to manage their securities and data"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 flex-1 overflow-y-auto"
        >
          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building className="h-5 w-5 mr-2 text-orange-500" />
              Company Information
            </h3>

            <div className="space-y-3">
              <Label
                htmlFor="company_name"
                className="text-sm font-medium text-gray-700"
              >
                Company Name *
              </Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData({ ...formData, company_name: e.target.value })
                }
                placeholder="e.g., Cal Redwood Acquisition Corp"
                className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
              />
              <p className="text-xs text-gray-500">
                Enter the full company name as it appears in your records
              </p>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-gray-700"
              >
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the issuer..."
                className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                {formData.description.length}/500 characters
              </p>
            </div>
          </div>

          {/* Issuer Admin Invitation */}
          {!issuer && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2 text-orange-500" />
                Issuer Admin Invitation
              </h3>

              <div className="space-y-3">
                <Label
                  htmlFor="issuer_email"
                  className="text-sm font-medium text-gray-700"
                >
                  Admin Email *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="issuer_email"
                    type="email"
                    value={formData.issuer_email}
                    onChange={(e) =>
                      setFormData({ ...formData, issuer_email: e.target.value })
                    }
                    placeholder="admin@company.com"
                    className="bg-white/50 border border-white/20 pl-10 focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  The email address for the company's administrator
                </p>
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="issuer_name"
                  className="text-sm font-medium text-gray-700"
                >
                  Admin Name
                </Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="issuer_name"
                    value={formData.issuer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, issuer_name: e.target.value })
                    }
                    placeholder="Full name of the administrator"
                    className="bg-white/50 border border-white/20 pl-10 focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Optional: Full name of the company administrator
                </p>
              </div>
            </div>
          )}

          {/* Securities Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Hash className="h-5 w-5 mr-2 text-orange-500" />
                Securities *
              </h3>
              <Button
                type="button"
                onClick={addSecurity}
                variant="outline"
                size="sm"
                className="border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Security
              </Button>
            </div>

            {fetchingSecurities ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">
                  Loading securities...
                </p>
              </div>
            ) : securities.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <Hash className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No securities added yet</p>
                <p className="text-sm text-gray-500">
                  Add at least one security to continue
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {securities.map((security, index) => (
                  <div
                    key={security.id}
                    className="p-4 border border-gray-200 rounded-lg bg-white/30"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        Security {index + 1}
                      </h4>
                      <Button
                        type="button"
                        onClick={() => removeSecurity(index)}
                        variant="outline"
                        size="sm"
                        className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Security Type *
                        </Label>
                        <Select
                          value={security.security_type}
                          onValueChange={(value) =>
                            updateSecurity(index, "security_type", value)
                          }
                        >
                          <SelectTrigger className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
                            <SelectItem value="Units">Units</SelectItem>
                            <SelectItem value="Class A">Class A</SelectItem>
                            <SelectItem value="Class B">Class B</SelectItem>
                            <SelectItem value="Rights">Rights</SelectItem>
                            <SelectItem value="Warrants">Warrants</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Issue Ticker *
                        </Label>
                        <Input
                          value={security.issue_ticker}
                          onChange={(e) =>
                            updateSecurity(
                              index,
                              "issue_ticker",
                              e.target.value,
                            )
                          }
                          placeholder="e.g., DAAQU"
                          className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Trading Platform *
                        </Label>
                        <Input
                          value={security.trading_platform}
                          onChange={(e) =>
                            updateSecurity(
                              index,
                              "trading_platform",
                              e.target.value,
                            )
                          }
                          placeholder="e.g., NASDAQ"
                          className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          CUSIP (Optional)
                        </Label>
                        <Input
                          value={security.cusip || ""}
                          onChange={(e) =>
                            updateSecurity(index, "cusip", e.target.value)
                          }
                          placeholder="e.g., G17564124"
                          className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {issuer ? "Updating..." : "Adding..."}
                </div>
              ) : (
                <>{issuer ? "Update Company" : "Add Company"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
