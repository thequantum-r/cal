"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRightLeft,
  Plus,
  Building,
  User,
  FileText,
  CheckCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  Database,
  Shield,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

export default function TransactionProcessingPage({ params: paramsPromise }) {
  const [issuerId, setIssuerId] = useState(null);
  
  // Use AuthContext instead of local state
  const {
    user,
    userRole,
    currentIssuer,
    availableIssuers,
    issuerSpecificRole,
    loading: authLoading,
    initialized,
    validateAndSetIssuer,
    canEdit,
  } = useAuth();

  // Data states
  const [securities, setSecurities] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [splits, setSplits] = useState([]);
  const [splitRatios, setSplitRatios] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // Transaction form states
  const [transactionType, setTransactionType] = useState("");
  const [selectedSecurity, setSelectedSecurity] = useState("");
  const [selectedShareholder, setSelectedShareholder] = useState("");
  const [shareQuantity, setShareQuantity] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");

  // Restriction states for credit transactions
  const [addRestriction, setAddRestriction] = useState(false);
  const [restrictionType, setRestrictionType] = useState("");
  const [restrictionDescription, setRestrictionDescription] = useState("");

  // Processing states
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const [classAShares, setClassAShares] = useState(0);
  const [rights, setRights] = useState(0);

  const transactionHints = {
    "DWAC Deposit":
      "Expected Flow: Deposit Units → Receive Class A + Rights/Warrants",
    IPO: "Original issuance of new shares to shareholder",
    "Transfer Credit": "Credit shares to a shareholder",
    "Transfer Debit": "Debit shares from a shareholder",
  };

  const getTransactionHint = (type) => {
    if (type === "DWAC Withdrawal") {
      const ratios = splitRatios[type];
      if (ratios) {
        const classA = ratios.classA || 0;
        const rights = ratios.rights || 0;
        return `Expected Split: 1 Unit → ${classA} Class A, ${rights} Right`;
      }
      return "Expected Split: ratios not set in DB";
    }
    return transactionHints[type];
  };

  // Get params from promise
  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise;
      setIssuerId(params.issuerId);
    };
    getParams();
  }, [paramsPromise]);

  // Validate issuer access and load data when issuerId changes
  useEffect(() => {
    if (issuerId && initialized && !authLoading) {
      validateIssuerAndLoadData();
    }
  }, [issuerId, initialized, authLoading]);

  const validateIssuerAndLoadData = async () => {
    if (!user) {
      redirect("/login");
      return;
    }

    // Validate access using AuthContext
    const { hasAccess } = await validateAndSetIssuer(issuerId);
    
    if (!hasAccess) {
      redirect("/?error=no_access");
      return;
    }

    // Load data only after access is validated
    await fetchData();
  };

  const fetchData = async () => {
    try {
      setDataLoading(true);

      // Fetch all data in parallel
      const [securitiesRes, shareholdersRes, restrictionsRes, splitsRes] =
        await Promise.all([
          fetch(`/api/securities?issuerId=${issuerId}`),
          fetch(`/api/shareholders?issuerId=${issuerId}`),
          fetch(`/api/shareholder-restrictions?issuerId=${issuerId}`),
          fetch(`/api/splits?issuerId=${issuerId}`),
        ]);

      const [securities, shareholders, restrictions, splits] = await Promise.all([
        securitiesRes.json(),
        shareholdersRes.json(),
        restrictionsRes.json(),
        splitsRes.json(),
      ]);

      setSecurities(securities || []);
      setShareholders(shareholders || []);
      setRestrictions(restrictions || []);

      // Process split ratios
      const ratiosMap = {};
      (splits || []).forEach((s) => {
        ratiosMap[s.transaction_type] = {
          classA: s.class_a_ratio ?? 0,
          rights: s.rights_ratio ?? 0,
        };
      });

      setSplits(
        (splits || []).map((s) => ({
          ...s,
          classA: s.class_a_ratio ?? 0,
          rights: s.rights_ratio ?? 0,
        })),
      );
      setSplitRatios(ratiosMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setDataLoading(false);
    }
  };

  // Helper to check if Cede is selected
  const isCedeSelected = (() => {
    const selected = shareholders.find((s) => s.id === selectedShareholder);
    return selected && selected.first_name?.toLowerCase().includes("cede");
  })();

  // Auto-calculate split shares for DWAC Withdrawal
  useEffect(() => {
    if (
      transactionType === "DWAC Withdrawal" &&
      shareQuantity &&
      isCedeSelected
    ) {
      const qty = parseFloat(shareQuantity);
      const ratios = splitRatios[transactionType];
      if (!ratios) return;

      if (ratios.classA !== undefined) {
        setClassAShares(Math.floor(qty * ratios.classA));
      }
      if (ratios.rights !== undefined) {
        setRights(Math.floor(qty * ratios.rights));
      }
    }
  }, [
    shareQuantity,
    transactionType,
    selectedShareholder,
    shareholders,
    splitRatios,
  ]);

  const validateTransaction = () => {
    if (!transactionType) {
      toast.error("Please select a transaction type");
      return false;
    }
    if (!selectedSecurity) {
      toast.error("Please select a security");
      return false;
    }
    if (!selectedShareholder) {
      toast.error("Please select a shareholder");
      return false;
    }
    if (!shareQuantity || shareQuantity <= 0) {
      toast.error("Please enter a valid share quantity");
      return false;
    }
    if (!transactionDate) {
      toast.error("Please select a transaction date");
      return false;
    }

    // Check for restrictions
    const security = securities.find((s) => s.id === selectedSecurity);
    const shareholder = shareholders.find((s) => s.id === selectedShareholder);

    if (security && shareholder) {
      const applicableRestrictions = restrictions.filter(
        (r) =>
          r.shareholder_id === shareholder.id &&
          r.cusip === security.cusip &&
          r.is_active,
      );

      if (applicableRestrictions.length > 0) {
        const restrictionTypes = applicableRestrictions
          .map((r) => r.restriction_type)
          .join(", ");
        toast.warning(
          `Warning: Shareholder has restrictions (${restrictionTypes}) on this security`,
        );
      }
    }

    return true;
  };

  const previewTransaction = () => {
    if (!validateTransaction()) return;

    const security = securities.find((s) => s.id === selectedSecurity);
    const shareholder = shareholders.find((s) => s.id === selectedShareholder);

    const isCredit =
      transactionType === "IPO" ||
      transactionType === "DWAC Deposit" ||
      transactionType === "Transfer Credit";

    setPreviewData({
      transaction_type: transactionType,
      display_transaction_type:
        transactionType === "IPO" ? "Original Issuance" : transactionType,
      security: security,
      shareholder: shareholder,
      share_quantity: Math.floor(parseFloat(shareQuantity)),
      class_a: classAShares,
      rights: rights,
      transaction_date: transactionDate,
      credit_debit: isCredit ? "Credit" : "Debit",
      notes: notes,
    });
  };

  const processTransaction = async () => {
    if (!previewData) return;

    try {
      setProcessing(true);

      const supabase = createClient();

      const transactionData = {
        issuer_id: issuerId,
        cusip: previewData.security.cusip || "N/A",
        transaction_type: previewData.transaction_type,
        shareholder_id: previewData.shareholder.id,
        share_quantity: Math.floor(previewData.share_quantity),
        //class_a_shares: previewData.class_a || 0,
        //rights_shares: previewData.rights || 0,
        transaction_date: previewData.transaction_date,
        status: "Active",
        certificate_type: "Book Entry",
        notes: previewData.notes || null,
      };

      console.log("📝 Transaction data to insert:", transactionData);

      const { data: transactionResult, error } = await supabase
        .from("transfers_new")
        .insert([transactionData])
        .select();

      console.log("🔍 Insert result:", { data: transactionResult, error });

      if (error) {
        console.error("🚨 Database error details:", error);
        throw new Error(
          `Database error: ${error.message || JSON.stringify(error)}`,
        );
      }

      // If adding restriction for credit transaction
      if (addRestriction && restrictionType && restrictionDescription) {
        const restrictionData = {
          issuer_id: issuerId,
          shareholder_id: previewData.shareholder.id,
          cusip: previewData.security.cusip,
          restriction_type: restrictionType,
          description: restrictionDescription,
          is_active: true,
          created_date: new Date().toISOString(),
        };

        const { error: restrictionError } = await supabase
          .from("shareholder_restrictions_new")
          .insert([restrictionData]);

        if (restrictionError) {
          console.error("Error adding restriction:", restrictionError);
          toast.warning("Transaction processed but failed to add restriction");
        } else {
          toast.success(
            `Transaction processed successfully with restriction added`,
          );
        }
      } else {
        toast.success(`Transaction processed successfully`);
      }

      // Reset form
      setTransactionType("");
      setSelectedSecurity("");
      setSelectedShareholder("");
      setShareQuantity("");
      setNotes("");
      setAddRestriction(false);
      setRestrictionType("");
      setRestrictionDescription("");
      setPreviewData(null);
      setClassAShares(0);
      setRights(0);
    } catch (error) {
      console.error("Error processing transaction:", error);
      console.error("Error stack:", error.stack);
      console.error("Error details:", JSON.stringify(error, null, 2));
      toast.error(
        `Failed to process transaction: ${error.message || "Unknown error occurred"}`,
      );
    } finally {
      setProcessing(false);
    }
  };

  // Show loading state while auth is initializing or data is loading
  if (authLoading || !initialized || dataLoading) {
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

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Transaction Processing...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check permissions using AuthContext
  const hasEditPermission = canEdit();

  if (!hasEditPermission) {
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

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Access Restricted
              </h3>
              <p className="text-gray-500">
                You don't have permission to access transaction processing
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                      Transaction Processing
                    </h1>
                    <p className="text-lg text-gray-600">
                      Core mechanism for processing shareholder data
                      modifications
                    </p>
                    <p className="text-sm text-orange-600 mt-2">
                      Note: Use dedicated pages for creating new shareholders
                      and securities
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Zap className="h-8 w-8 text-orange-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Transaction Form */}
                <Card className="card-glass border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ArrowRightLeft className="mr-2 h-5 w-5" />
                      Process New Transaction
                    </CardTitle>
                    <CardDescription>
                      Select transaction type and enter details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {transactionType && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <p className="text-sm font-medium text-orange-700">
                          {getTransactionHint(transactionType)}
                        </p>
                      </div>
                    )}

                    {/* Transaction Type Selection */}
                    <div>
                      <Label>Transaction Type</Label>
                      <Select
                        value={transactionType}
                        onValueChange={setTransactionType}
                      >
                        <SelectTrigger className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20">
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IPO">
                            Original Issuance (IPO)
                          </SelectItem>
                          <SelectItem value="DWAC Deposit">
                            DWAC Deposit
                          </SelectItem>
                          <SelectItem value="DWAC Withdrawal">
                            DWAC Withdrawal
                          </SelectItem>
                          <SelectItem value="Transfer Credit">
                            Transfer Credit
                          </SelectItem>
                          <SelectItem value="Transfer Debit">
                            Transfer Debit
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Security Selection */}
                    <div>
                      <Label>Security</Label>
                      <Select
                        value={selectedSecurity}
                        onValueChange={setSelectedSecurity}
                      >
                        <SelectTrigger className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20">
                          <SelectValue placeholder="Select security" />
                        </SelectTrigger>
                        <SelectContent>
                          {securities.map((security) => (
                            <SelectItem key={security.id} value={security.id}>
                              {security.issue_name} - {security.cusip || "N/A"}{" "}
                              ({security.class_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Shareholder Selection */}
                    <div>
                      <Label>Shareholder</Label>
                      <Select
                        value={selectedShareholder}
                        onValueChange={setSelectedShareholder}
                      >
                        <SelectTrigger className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20">
                          <SelectValue placeholder="Select shareholder" />
                        </SelectTrigger>
                        <SelectContent>
                          {shareholders.map((shareholder) => (
                            <SelectItem
                              key={shareholder.id}
                              value={shareholder.id}
                            >
                              {shareholder.account_number} -{" "}
                              {shareholder.first_name} {shareholder.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Share Quantity */}
                    <div>
                      <Label>Share Quantity</Label>
                      <Input
                        type="number"
                        placeholder="Enter number of shares"
                        value={shareQuantity}
                        onChange={(e) => setShareQuantity(e.target.value)}
                        className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                      />
                    </div>

                    {/* Transaction Date */}
                    <div>
                      <Label>Transaction Date</Label>
                      <Input
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <Label>Notes (Optional)</Label>
                      <Textarea
                        placeholder="Enter transaction notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                      />
                    </div>

                    {/* Restriction Option for Credit Transactions */}
                    {(() => {
                      const isCredit =
                        transactionType === "IPO" ||
                        transactionType === "DWAC Deposit" ||
                        transactionType === "Transfer Credit";

                      if (!isCredit) return null;

                      return (
                        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="addRestriction"
                              checked={addRestriction}
                              onChange={(e) =>
                                setAddRestriction(e.target.checked)
                              }
                              className="rounded"
                            />
                            <Label
                              htmlFor="addRestriction"
                              className="text-blue-800 font-medium"
                            >
                              Add restriction to these shares
                            </Label>
                          </div>

                          {addRestriction && (
                            <div className="space-y-3 ml-6">
                              <div>
                                <Label>Restriction Type</Label>
                                <Select
                                  value={restrictionType}
                                  onValueChange={setRestrictionType}
                                >
                                  <SelectTrigger className="border-blue-200 focus:border-blue-500">
                                    <SelectValue placeholder="Select restriction type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Lock-up">
                                      Lock-up Period
                                    </SelectItem>
                                    <SelectItem value="Trading Restriction">
                                      Trading Restriction
                                    </SelectItem>
                                    <SelectItem value="Transfer Restriction">
                                      Transfer Restriction
                                    </SelectItem>
                                    <SelectItem value="Voting Restriction">
                                      Voting Restriction
                                    </SelectItem>
                                    <SelectItem value="SEC Rule 144">
                                      SEC Rule 144
                                    </SelectItem>
                                    <SelectItem value="Custom">
                                      Custom Restriction
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Restriction Description</Label>
                                <Textarea
                                  placeholder="Enter restriction details..."
                                  value={restrictionDescription}
                                  onChange={(e) =>
                                    setRestrictionDescription(e.target.value)
                                  }
                                  className="border-blue-200 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Action Buttons */}
                    <div className="flex space-x-4">
                      <Button
                        variant="outline"
                        onClick={previewTransaction}
                        className="flex-1 border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </Button>
                      <Button
                        onClick={processTransaction}
                        disabled={!previewData || processing}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                      >
                        {processing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Process Transaction
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Split Calculation for DWAC Withdrawal */}
                    {transactionType === "DWAC Withdrawal" &&
                      isCedeSelected && (
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                            Split Calculation
                          </h4>
                          <p className="text-sm text-gray-700">
                            {shareQuantity} Unit(s) will split into:
                          </p>

                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {splitRatios[transactionType]?.classA !==
                              undefined && (
                              <div>
                                <Label>Class A Shares</Label>
                                <Input
                                  type="number"
                                  value={classAShares}
                                  onChange={(e) =>
                                    setClassAShares(
                                      Math.floor(parseFloat(e.target.value)) ||
                                        0,
                                    )
                                  }
                                  className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20 mt-1"
                                />
                              </div>
                            )}

                            {splitRatios[transactionType]?.rights !==
                              undefined && (
                              <div>
                                <Label>Rights / Warrants</Label>
                                <Input
                                  type="number"
                                  value={rights}
                                  onChange={(e) =>
                                    setRights(
                                      Math.floor(parseFloat(e.target.value)) ||
                                        0,
                                    )
                                  }
                                  className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20 mt-1"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>

                  {/* Transaction Preview */}
                <Card className="card-glass border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="mr-2 h-5 w-5" />
                      Transaction Preview
                    </CardTitle>
                    <CardDescription>
                      Review transaction details before processing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!previewData ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <Database className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No Preview Available
                          </h3>
                          <p className="text-gray-500">
                            Fill out the form and click Preview to see
                            transaction details
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-600">
                              Transaction Type
                            </Label>
                            <div className="flex items-center mt-1">
                              <Badge variant="outline" className="text-sm">
                                {previewData.display_transaction_type}
                              </Badge>
                              <Badge
                                variant={
                                  previewData.credit_debit === "Credit"
                                    ? "default"
                                    : "secondary"
                                }
                                className="ml-2"
                              >
                                {previewData.credit_debit}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <Label className="text-gray-600">Security</Label>
                            <div className="text-sm font-medium text-gray-900 mt-1">
                              {previewData.security.issue_name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {previewData.security.cusip || "N/A"} -{" "}
                              {previewData.security.class_name}
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-600">
                              Share Quantity (Units)
                            </Label>
                            <div className="text-2xl font-extrabold text-gray-900 mt-1">
                              {previewData.share_quantity.toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-gray-50 border rounded-md p-3">
                            <Label className="text-gray-600">
                              Split Breakdown
                            </Label>
                            <div className="mt-1 text-sm text-gray-800">
                              {previewData.class_a?.toLocaleString() || 0} Class
                              A <br />
                              {previewData.rights?.toLocaleString() || 0}{" "}
                              Rights/Warrants
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <Label className="text-gray-600">
                            Transaction Date
                          </Label>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            {new Date(
                              previewData.transaction_date,
                            ).toLocaleDateString()}
                          </div>
                        </div>

                        {previewData.notes && (
                          <>
                            <Separator />
                            <div>
                              <Label className="text-gray-600">Notes</Label>
                              <div className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded-md">
                                {previewData.notes}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Restrictions Check */}
                        {(() => {
                          const applicableRestrictions = restrictions.filter(
                            (r) =>
                              r.shareholder_id === previewData.shareholder.id &&
                              r.cusip === previewData.security.cusip &&
                              r.is_active,
                          );

                          if (applicableRestrictions.length > 0) {
                            return (
                              <>
                                <Separator />
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                                  <div className="flex items-start">
                                    <Shield className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                                    <div>
                                      <h4 className="text-sm font-medium text-yellow-800">
                                        Restrictions Applied
                                      </h4>
                                      <div className="text-sm text-yellow-700 mt-1">
                                        {applicableRestrictions.map((r) => (
                                          <div
                                            key={r.id}
                                            className="flex items-center mt-1"
                                          >
                                            <Badge
                                              variant="outline"
                                              className="mr-2"
                                            >
                                              {r.restriction_type}
                                            </Badge>
                                            <span>{r.description}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          }
                          return null;
                        })()}

                        <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mt-6">
                          <div className="flex items-start">
                            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 mr-2" />
                            <div>
                              <h4 className="text-sm font-medium text-orange-800">
                                Ready to Process
                              </h4>
                              <p className="text-sm text-orange-700 mt-1">
                                This transaction will be permanently added to
                                the transfer journal and update all related
                                records.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Type Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <Card className="card-glass border-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <Plus className="mr-2 h-5 w-5 text-blue-600" />
                      IPO Processing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">
                      Process IPO share issuances to initial shareholders
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Creates credit entries</li>
                      <li>• Validates against authorized shares</li>
                      <li>• Updates shareholder positions</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <ArrowRightLeft className="mr-2 h-5 w-5 text-green-600" />
                      DWAC Processing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">
                      Handle DTC deposits and withdrawals
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• DWAC Deposits (DTC → Direct)</li>
                      <li>• DWAC Withdrawals (Direct → DTC)</li>
                      <li>• Cede & Co. integration</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="card-glass border-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <User className="mr-2 h-5 w-5 text-purple-600" />
                      Transfer Processing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">
                      Process shareholder-to-shareholder transfers
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Transfer credits and debits</li>
                      <li>• Restriction validation</li>
                      <li>• Multi-step workflows</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}