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
  FileText,
  UserCheck,
  MapPin,
  Phone,
  DollarSign,
  Calendar,
  Briefcase,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EnhancedIssuerModal({
  isOpen,
  onClose,
  issuer = null,
}) {
  const [formData, setFormData] = useState({
    issuer_display_name: "",
    description: "",
    issuer_email: "",
    issuer_name: "",
    // Issuer Details
    address: "",
    separation_ratio: "",
    telephone: "",
    tax_id: "",
    incorporation: "",

    // Business Information
    underwriter: "",
    security_types_issued: "",
    form_s1_status: "",
    timeframe_separation: "",
    separation_date: "",
    exchange: "",
    timeframe_bc: "",
    us_counsel: "",
    offshore_counsel: "",

    // IPO Issuance Information
    class_a_ipo_issuance: "",
    class_b_share_issuance: "",
    right_ipo_issuance: "",
    warrant_ipo_issuance: "",
    redemptions: "",
  });

  const [securities, setSecurities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [ipoIssuances, setIpoIssuances] = useState({}); // New state for IPO issuances per security type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchingSecurities, setFetchingSecurities] = useState(false);
  const [fetchingDocuments, setFetchingDocuments] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const router = useRouter();

  // Get step title
  const getStepTitle = (step) => {
    switch (step) {
      case 1:
        return "Issuer Information";
      case 2:
        return "Business Details";
      case 3:
        return "Share Information";
      case 4:
        return "Documents & Officers";
      case 5:
        return "IPO Issuance";
      default:
        return "Issuer Setup";
    }
  };

  // Wizard navigation functions
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  // Get available security types for IPO issuance dropdown
  const getAvailableSecurityTypes = () => {
    return securities
      .filter((sec) => sec.security_type && sec.security_type.trim())
      .map((sec) => sec.security_type)
      .filter((type, index, arr) => arr.indexOf(type) === index); // Remove duplicates
  };

  // Update IPO issuance for a specific security type
  const updateIpoIssuance = (securityType, amount) => {
    setIpoIssuances({
      ...ipoIssuances,
      [securityType]: amount,
    });
  };

  // Reset form when modal opens/closes or issuer changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1); // Reset to first step
      if (issuer) {
        setFormData({
          issuer_display_name: issuer.display_name || "",
          description: issuer.description || "",
          issuer_email: "",
          issuer_name: "",
          // Issuer Details
          address: issuer.address || "",
          separation_ratio: issuer.separation_ratio || "",
          telephone: issuer.telephone || "",
          tax_id: issuer.tax_id || "",
          incorporation: issuer.incorporation || "",

          // Business Information
          underwriter: issuer.underwriter || "",
          security_types_issued: issuer.security_types_issued || "",
          form_s1_status: issuer.form_s1_status || "",
          timeframe_separation: issuer.timeframe_separation || "",
          separation_date: issuer.separation_date || "",
          exchange: issuer.exchange || "",
          timeframe_bc: issuer.timeframe_bc || "",
          us_counsel: issuer.us_counsel || "",
          offshore_counsel: issuer.offshore_counsel || "",

          // IPO Issuance Information
          class_a_ipo_issuance: issuer.class_a_ipo_issuance || "",
          class_b_share_issuance: issuer.class_b_share_issuance || "",
          right_ipo_issuance: issuer.right_ipo_issuance || "",
          warrant_ipo_issuance: issuer.warrant_ipo_issuance || "",
          redemptions: issuer.redemptions || "",
        });
        fetchExistingSecurities(issuer.id);
        fetchExistingDocuments(issuer.id);

        // Map officers from database format to form format
        const mappedOfficers = (issuer.officers_directors || []).map(
          (officer, index) => ({
            id: officer.id || `existing-officer-${index}`,
            officer_name: officer.name || officer.officer_name || "",
            officer_position: officer.title || officer.officer_position || "",
            ofac_results: officer.ofac_status || officer.ofac_results || "NULL",
          }),
        );
        setOfficers(mappedOfficers);

        setIpoIssuances(issuer.ipo_issuances || {});
      } else {
        setFormData({
          issuer_display_name: "",
          description: "",
          issuer_email: "",
          issuer_name: "",
          // Issuer Details
          address: "",
          separation_ratio: "",
          telephone: "",
          tax_id: "",
          incorporation: "",

          // Business Information
          underwriter: "",
          security_types_issued: "",
          form_s1_status: "",
          timeframe_separation: "",
          separation_date: "",
          exchange: "",
          timeframe_bc: "",
          us_counsel: "",
          offshore_counsel: "",

          // IPO Issuance Information
          class_a_ipo_issuance: "",
          class_b_share_issuance: "",
          right_ipo_issuance: "",
          warrant_ipo_issuance: "",
          redemptions: "",
        });
        setSecurities([]);
        setDocuments([]);
        setOfficers([]);
        setIpoIssuances({});
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

  const fetchExistingDocuments = async (issuerId) => {
    setFetchingDocuments(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("documents_new")
        .select("*")
        .eq("issuer_id", issuerId)
        .order("created_at");

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError("Error fetching documents: " + error.message);
    } finally {
      setFetchingDocuments(false);
    }
  };

  // Add/Remove/Update functions
  const addSecurity = () => {
    setSecurities([
      ...securities,
      {
        id: `temp-${Date.now()}`,
        security_type: "",
        issue_ticker: "",
        cusip: "",
        trading_platform: "",
        total_authorized_shares: "",
      },
    ]);
  };

  const addDocument = () => {
    setDocuments([
      ...documents,
      {
        id: `temp-${Date.now()}`,
        document_name: "",
        status: "PENDING",
        comments: "",
      },
    ]);
  };

  const addOfficer = () => {
    setOfficers([
      ...officers,
      {
        id: `temp-${Date.now()}`,
        officer_name: "",
        officer_position: "",
        ofac_results: "",
      },
    ]);
  };

  const removeSecurity = (index) => {
    setSecurities(securities.filter((_, i) => i !== index));
  };

  const removeDocument = (index) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const removeOfficer = (index) => {
    setOfficers(officers.filter((_, i) => i !== index));
  };

  const updateSecurity = (index, field, value) => {
    const updatedSecurities = [...securities];
    updatedSecurities[index] = { ...updatedSecurities[index], [field]: value };
    setSecurities(updatedSecurities);
  };

  const updateDocument = (index, field, value) => {
    const updatedDocuments = [...documents];
    updatedDocuments[index] = { ...updatedDocuments[index], [field]: value };
    setDocuments(updatedDocuments);
  };

  const updateOfficer = (index, field, value) => {
    const updatedOfficers = [...officers];
    updatedOfficers[index] = { ...updatedOfficers[index], [field]: value };
    setOfficers(updatedOfficers);
  };

  // Step Renderers
  const renderIssuerInformation = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <Building className="h-5 w-5 mr-2 text-orange-500" />
        Issuer Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label
            htmlFor="issuer_display_name"
            className="text-sm font-medium text-gray-700"
          >
            Issue Name *
          </Label>
          <Input
            id="issuer_display_name"
            value={formData.issuer_display_name}
            onChange={(e) =>
              setFormData({ ...formData, issuer_display_name: e.target.value })
            }
            placeholder="e.g., Cal Redwood Acquisition Corp"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="telephone"
            className="text-sm font-medium text-gray-700"
          >
            Telephone
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="telephone"
              value={formData.telephone}
              onChange={(e) =>
                setFormData({ ...formData, telephone: e.target.value })
              }
              placeholder="(555) 123-4567"
              className="bg-white/50 border border-white/20 pl-10 focus:border-orange-500 focus:ring-orange-500/20"
            />
          </div>
        </div>

        <div className="space-y-3 md:col-span-2">
          <Label
            htmlFor="address"
            className="text-sm font-medium text-gray-700"
          >
            Address
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Full business address"
              className="bg-white/50 border border-white/20 pl-10 focus:border-orange-500 focus:ring-orange-500/20"
              rows={2}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="separation_ratio"
            className="text-sm font-medium text-gray-700"
          >
            Separation Ratio
          </Label>
          <Input
            id="separation_ratio"
            value={formData.separation_ratio}
            onChange={(e) =>
              setFormData({ ...formData, separation_ratio: e.target.value })
            }
            placeholder="e.g., 1:1"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="tax_id" className="text-sm font-medium text-gray-700">
            Tax ID
          </Label>
          <Input
            id="tax_id"
            value={formData.tax_id}
            onChange={(e) =>
              setFormData({ ...formData, tax_id: e.target.value })
            }
            placeholder="Tax identification number"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="incorporation"
            className="text-sm font-medium text-gray-700"
          >
            Incorporation
          </Label>
          <Input
            id="incorporation"
            value={formData.incorporation}
            onChange={(e) =>
              setFormData({ ...formData, incorporation: e.target.value })
            }
            placeholder="State/Country of incorporation"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="underwriter"
            className="text-sm font-medium text-gray-700"
          >
            Underwriter
          </Label>
          <Input
            id="underwriter"
            value={formData.underwriter}
            onChange={(e) =>
              setFormData({ ...formData, underwriter: e.target.value })
            }
            placeholder="Underwriter name"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3 md:col-span-2">
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
        </div>
      </div>

      {/* Issuer Admin Invitation - Only show for new issuers */}
      {!issuer && (
        <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-md font-semibold text-gray-900 flex items-center">
            <Users className="h-4 w-4 mr-2 text-orange-500" />
            Issuer Admin Invitation
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Continue with the rest of the step renderers...
  const renderBusinessDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <Briefcase className="h-5 w-5 mr-2 text-orange-500" />
        Business Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label
            htmlFor="security_types_issued"
            className="text-sm font-medium text-gray-700"
          >
            Security Types Being Issued
          </Label>
          <Input
            id="security_types_issued"
            value={formData.security_types_issued}
            onChange={(e) =>
              setFormData({
                ...formData,
                security_types_issued: e.target.value,
              })
            }
            placeholder="Units, Class A, Rights, Warrants"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="form_s1_status"
            className="text-sm font-medium text-gray-700"
          >
            Form S-1 Status
          </Label>
          <Select
            value={formData.form_s1_status}
            onValueChange={(value) =>
              setFormData({ ...formData, form_s1_status: value })
            }
          >
            <SelectTrigger className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
              <SelectItem value="OBTAINED">OBTAINED</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="N/A">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="timeframe_separation"
            className="text-sm font-medium text-gray-700"
          >
            Timeframe for Separation
          </Label>
          <Input
            id="timeframe_separation"
            value={formData.timeframe_separation}
            onChange={(e) =>
              setFormData({ ...formData, timeframe_separation: e.target.value })
            }
            placeholder="e.g., 52 days from pricing date"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="separation_date"
            className="text-sm font-medium text-gray-700"
          >
            Separation Date
          </Label>
          <Input
            id="separation_date"
            type="date"
            value={formData.separation_date}
            onChange={(e) =>
              setFormData({ ...formData, separation_date: e.target.value })
            }
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="exchange"
            className="text-sm font-medium text-gray-700"
          >
            Exchange
          </Label>
          <Input
            id="exchange"
            value={formData.exchange}
            onChange={(e) =>
              setFormData({ ...formData, exchange: e.target.value })
            }
            placeholder="e.g., NASDAQ"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="timeframe_bc"
            className="text-sm font-medium text-gray-700"
          >
            Timeframe for BC
          </Label>
          <Input
            id="timeframe_bc"
            value={formData.timeframe_bc}
            onChange={(e) =>
              setFormData({ ...formData, timeframe_bc: e.target.value })
            }
            placeholder="e.g., 18 months"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="us_counsel"
            className="text-sm font-medium text-gray-700"
          >
            U.S. Counsel
          </Label>
          <Input
            id="us_counsel"
            value={formData.us_counsel}
            onChange={(e) =>
              setFormData({ ...formData, us_counsel: e.target.value })
            }
            placeholder="Law firm name"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="offshore_counsel"
            className="text-sm font-medium text-gray-700"
          >
            Offshore Counsel
          </Label>
          <Input
            id="offshore_counsel"
            value={formData.offshore_counsel}
            onChange={(e) =>
              setFormData({ ...formData, offshore_counsel: e.target.value })
            }
            placeholder="Offshore law firm name"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <Label
            htmlFor="redemptions"
            className="text-sm font-medium text-gray-700"
          >
            Redemptions
          </Label>
          <Textarea
            id="redemptions"
            value={formData.redemptions}
            onChange={(e) =>
              setFormData({ ...formData, redemptions: e.target.value })
            }
            placeholder="Redemption details and conditions"
            className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
            rows={2}
          />
        </div>
      </div>
    </div>
  );

  // Continue with share information step
  const renderShareInformation = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Hash className="h-5 w-5 mr-2 text-orange-500" />
          Share Information *
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
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Add issue ticker, CUSIP, and authorized shares for each security type.
        </p>
      </div>

      {fetchingSecurities ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Loading securities...</p>
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
              key={security.id || `security-${index}`}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      updateSecurity(index, "issue_ticker", e.target.value)
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
                      updateSecurity(index, "trading_platform", e.target.value)
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

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Authorized Shares
                  </Label>
                  <Input
                    value={security.total_authorized_shares || ""}
                    onChange={(e) =>
                      updateSecurity(
                        index,
                        "total_authorized_shares",
                        e.target.value,
                      )
                    }
                    placeholder="e.g., 500000000"
                    type="number"
                    className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Documents and Officers step
  const renderDocumentsAndOfficers = () => (
    <div className="space-y-8">
      {/* Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-orange-500" />
            Required Documents
          </h3>
          <Button
            type="button"
            onClick={addDocument}
            variant="outline"
            size="sm"
            className="border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Document
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No documents added yet</p>
            <p className="text-sm text-gray-500">
              Add documents to track their status
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((document, index) => (
              <div
                key={document.id || `document-${index}`}
                className="p-4 border border-gray-200 rounded-lg bg-white/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Document {index + 1}
                  </h4>
                  <Button
                    type="button"
                    onClick={() => removeDocument(index)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Document Name *
                    </Label>
                    <Input
                      value={document.document_name}
                      onChange={(e) =>
                        updateDocument(index, "document_name", e.target.value)
                      }
                      placeholder="e.g., Investment Management Trust Agreement"
                      className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Status
                    </Label>
                    <Select
                      value={document.status || "PENDING"}
                      onValueChange={(value) =>
                        updateDocument(index, "status", value)
                      }
                    >
                      <SelectTrigger className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                        <SelectItem value="N/A">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Comments
                    </Label>
                    <Input
                      value={document.comments || ""}
                      onChange={(e) =>
                        updateDocument(index, "comments", e.target.value)
                      }
                      placeholder="Additional notes"
                      className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Officers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <UserCheck className="h-5 w-5 mr-2 text-orange-500" />
            Officer/Director OFAC Searches @ 95%
          </h3>
          <Button
            type="button"
            onClick={addOfficer}
            variant="outline"
            size="sm"
            className="border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Officer
          </Button>
        </div>

        {officers.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No officers added yet</p>
            <p className="text-sm text-gray-500">
              Add officers and directors for OFAC screening
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {officers.map((officer, index) => (
              <div
                key={officer.id || `officer-${index}`}
                className="p-4 border border-gray-200 rounded-lg bg-white/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Officer {index + 1}
                  </h4>
                  <Button
                    type="button"
                    onClick={() => removeOfficer(index)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Officer Name *
                    </Label>
                    <Input
                      value={officer.officer_name}
                      onChange={(e) =>
                        updateOfficer(index, "officer_name", e.target.value)
                      }
                      placeholder="Full name of officer/director"
                      className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Officer Position *
                    </Label>
                    <Input
                      value={officer.officer_position}
                      onChange={(e) =>
                        updateOfficer(index, "officer_position", e.target.value)
                      }
                      placeholder="e.g., CFO, CEO, Director"
                      className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      OFAC Results
                    </Label>
                    <Select
                      value={officer.ofac_results || "NULL"}
                      onValueChange={(value) =>
                        updateOfficer(index, "ofac_results", value)
                      }
                    >
                      <SelectTrigger className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20">
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl">
                        <SelectItem value="NULL">NULL</SelectItem>
                        <SelectItem value="PASS">PASS</SelectItem>
                        <SelectItem value="FAIL">FAIL</SelectItem>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // IPO Issuance step - dynamic based on security types
  const renderIpoIssuance = () => {
    const availableSecurityTypes = getAvailableSecurityTypes();

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-orange-500" />
          IPO Issuance Information
        </h3>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Set IPO issuance amounts for each security type added in the
            previous step.
          </p>
        </div>

        {availableSecurityTypes.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No security types available</p>
            <p className="text-sm text-gray-500">
              Go back to Step 3 to add securities first
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableSecurityTypes.map((securityType) => (
              <div key={securityType} className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  {securityType} IPO Issuance
                </Label>
                <Input
                  value={ipoIssuances[securityType] || ""}
                  onChange={(e) =>
                    updateIpoIssuance(securityType, e.target.value)
                  }
                  placeholder={`Number of ${securityType.toLowerCase()} shares`}
                  type="number"
                  className="bg-white/50 border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Validation and submission logic
  const validateForm = () => {
    if (!formData.issuer_display_name.trim()) {
      setError("Issuer name is required");
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
        setError("All required security fields must be filled");
        return false;
      }
    }
    return true;
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      const technicalName = await generateTechnicalName(formData.issuer_display_name);

      if (issuer) {
        // Update existing issuer
        const { error: issuerError } = await supabase
          .from("issuers_new")
          .update({
            display_name: formData.issuer_display_name,
            description: formData.description,
            address: formData.address,
            separation_ratio: formData.separation_ratio,
            telephone: formData.telephone,
            tax_id: formData.tax_id,
            incorporation: formData.incorporation,
            underwriter: formData.underwriter,
            security_types_issued: formData.security_types_issued,
            form_s1_status: formData.form_s1_status,
            timeframe_separation: formData.timeframe_separation,
            separation_date: formData.separation_date || null,
            exchange: formData.exchange,
            timeframe_bc: formData.timeframe_bc,
            us_counsel: formData.us_counsel,
            offshore_counsel: formData.offshore_counsel,
            class_a_ipo_issuance: formData.class_a_ipo_issuance,
            class_b_share_issuance: formData.class_b_share_issuance,
            right_ipo_issuance: formData.right_ipo_issuance,
            warrant_ipo_issuance: formData.warrant_ipo_issuance,
            redemptions: formData.redemptions,
            officers_directors: officers.map((officer) => ({
              name: officer.officer_name,
              title: officer.officer_position,
              ofac_status: officer.ofac_results,
            })),
            ipo_issuances: ipoIssuances,
          })
          .eq("id", issuer.id);

        if (issuerError) throw issuerError;

        // Delete existing securities and insert new ones
        await supabase
          .from("securities_new")
          .delete()
          .eq("issuer_id", issuer.id);
      } else {
        // Create new issuer
        const { data: newIssuerData, error: issuerError } = await supabase
          .from("issuers_new")
          .insert({
            name: technicalName,
            display_name: formData.issuer_display_name,
            description: formData.description,
            address: formData.address,
            separation_ratio: formData.separation_ratio,
            telephone: formData.telephone,
            tax_id: formData.tax_id,
            incorporation: formData.incorporation,
            underwriter: formData.underwriter,
            security_types_issued: formData.security_types_issued,
            form_s1_status: formData.form_s1_status,
            timeframe_separation: formData.timeframe_separation,
            separation_date: formData.separation_date || null,
            exchange: formData.exchange,
            timeframe_bc: formData.timeframe_bc,
            us_counsel: formData.us_counsel,
            offshore_counsel: formData.offshore_counsel,
            class_a_ipo_issuance: formData.class_a_ipo_issuance,
            class_b_share_issuance: formData.class_b_share_issuance,
            right_ipo_issuance: formData.right_ipo_issuance,
            warrant_ipo_issuance: formData.warrant_ipo_issuance,
            redemptions: formData.redemptions,
            officers_directors: officers.map((officer) => ({
              name: officer.officer_name,
              title: officer.officer_position,
              ofac_status: officer.ofac_results,
            })),
            ipo_issuances: ipoIssuances,
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
            issue_name: `${formData.issuer_display_name} ${security.security_type}`,
            security_type: security.security_type,
            issue_ticker: security.issue_ticker,
            cusip: security.cusip || null,
            trading_platform: security.trading_platform,
            total_authorized_shares: security.total_authorized_shares
              ? parseInt(security.total_authorized_shares)
              : null,
          }));

          const { error: securitiesError } = await supabase
            .from("securities_new")
            .insert(securitiesToInsert);

          if (securitiesError) throw securitiesError;
        }

        // Insert documents for the new issuer
        if (documents.length > 0) {
          const documentsToInsert = documents.map((doc) => ({
            issuer_id: newIssuer.id,
            document_name: doc.document_name,
            status: doc.status || "PENDING",
            comments: doc.comments || null,
          }));

          const { error: documentsError } = await supabase
            .from("documents_new")
            .insert(documentsToInsert);

          if (documentsError) throw documentsError;
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
            name: formData.issuer_name || formData.issuer_display_name + " Admin",
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
          issue_name: `${formData.issuer_display_name} ${security.security_type}`,
          security_type: security.security_type,
          issue_ticker: security.issue_ticker,
          cusip: security.cusip || null,
          trading_platform: security.trading_platform,
          total_authorized_shares: security.total_authorized_shares
            ? parseInt(security.total_authorized_shares)
            : null,
        }));

        const { error: securitiesError } = await supabase
          .from("securities_new")
          .insert(securitiesToInsert);

        if (securitiesError) throw securitiesError;
      }

      // Handle documents for existing issuer (if updating)
      if (issuer) {
        // Delete existing documents and insert new ones
        await supabase
          .from("documents_new")
          .delete()
          .eq("issuer_id", issuer.id);

        if (documents.length > 0) {
          const documentsToInsert = documents.map((doc) => ({
            issuer_id: issuer.id,
            document_name: doc.document_name,
            status: doc.status || "PENDING",
            comments: doc.comments || null,
          }));

          const { error: documentsError } = await supabase
            .from("documents_new")
            .insert(documentsToInsert);

          if (documentsError) throw documentsError;
        }
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
          "Issuer created successfully, but there was an issue retrieving the data. Please refresh the page.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {issuer ? "Edit Issuer" : "Add New Issuer"}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Step {currentStep} of {totalSteps}: {getStepTitle(currentStep)}
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    step < currentStep
                      ? "bg-green-500 text-white"
                      : step === currentStep
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                  onClick={() => goToStep(step)}
                >
                  {step < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{step}</span>
                  )}
                </div>
                {step < totalSteps && (
                  <div
                    className={`w-8 h-0.5 ${
                      step < currentStep ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Step Content */}
          <div className="min-h-[400px]">
            {currentStep === 1 && renderIssuerInformation()}
            {currentStep === 2 && renderBusinessDetails()}
            {currentStep === 3 && renderShareInformation()}
            {currentStep === 4 && renderDocumentsAndOfficers()}
            {currentStep === 5 && renderIpoIssuance()}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={prevStep}
              variant="outline"
              disabled={currentStep === 1}
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex space-x-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform "
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {issuer ? "Updating..." : "Creating..."}
                    </div>
                  ) : (
                    <>{issuer ? "Update Issuer" : "Create Issuer"}</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
