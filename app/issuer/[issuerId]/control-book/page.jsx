"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function ControlBookPage({ params: paramsPromise }) {
  const [issuerId, setIssuerId] = useState(null);
  const {
    user,
    userRole,
    currentIssuer,
    availableIssuers,
    issuerSpecificRole,
    loading: authLoading,
    validateAndSetIssuer,
    canEdit,
  } = useAuth();
  const router = useRouter();
  const [data, setData] = useState({
    securities: [],
    controlBookData: [],
  });
  const [activeTab, setActiveTab] = useState(""); // Will be set to first CUSIP
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCusip, setSelectedCusip] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sorting states
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Modal states
  const [showAddSecurity, setShowAddSecurity] = useState(false);

  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise;
      setIssuerId(params.issuerId);
    };
    getParams();
  }, [paramsPromise]);

  useEffect(() => {
    if (issuerId && user && !authLoading) {
      initializePage();
    }
  }, [issuerId, user, authLoading]);

  useEffect(() => {
    applyFilters();
  }, [
    data.controlBookData,
    searchTerm,
    activeTab,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const initializePage = async () => {
    try {
      // Validate issuer access using AuthContext
      const { hasAccess } = await validateAndSetIssuer(issuerId);

      if (!hasAccess) {
        router.push("/?error=no_access");
        return;
      }

      // Fetch data
      await fetchData();
    } catch (error) {
      console.error("Error initializing page:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [securitiesRes, transfersRes] = await Promise.all([
        fetch(`/api/securities?issuerId=${issuerId}`),
        fetch(`/api/transfer-journal?issuerId=${issuerId}`),
      ]);

      const securities = await securitiesRes.json();
      const transferTransactions = await transfersRes.json();

      // Debug logging (temporary)
      console.log("🔍 DEBUG - Securities Data:", securities);
      console.log(
        "🔍 DEBUG - Transfer Transactions Data:",
        transferTransactions,
      );
      console.log(
        "🔍 DEBUG - Sample transaction:",
        transferTransactions?.[0]
          ? {
              cusip: transferTransactions[0].cusip,
              transaction_type: transferTransactions[0].transaction_type,
              credit_debit: transferTransactions[0].credit_debit,
              created_at: transferTransactions[0].created_at,
            }
          : "No transactions",
      );

      // Use transfer transactions directly for control book display
      const controlBookData = transferTransactions || [];

      // Set default active tab to first CUSIP
      if (controlBookData.length > 0) {
        const uniqueCusips = [
          ...new Set(
            controlBookData.map((record) => record.cusip).filter(Boolean),
          ),
        ];
        if (uniqueCusips.length > 0 && !activeTab) {
          setActiveTab(uniqueCusips[0]);
        }
      }

      setData({
        securities,
        controlBookData,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data.controlBookData];

    // Filter by active tab (CUSIP)
    if (activeTab) {
      filtered = filtered.filter((entry) => entry.cusip === activeTab);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (entry) =>
          entry.cusip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.issue_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.security_type?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Date filters
    if (dateFrom) {
      filtered = filtered.filter((entry) => {
        const entryDate =
          entry.transaction_date || entry.created_at.split("T")[0];
        return entryDate >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter((entry) => {
        const entryDate =
          entry.transaction_date || entry.created_at.split("T")[0];
        return entryDate <= dateTo;
      });
    }

    // Group by date AND transaction type separately
    const transactionGroups = {};

    filtered.forEach((entry) => {
      const date = entry.transaction_date || entry.created_at.split("T")[0];
      const transactionType = entry.transaction_type;
      const groupKey = `${date}-${transactionType}`;

      if (!transactionGroups[groupKey]) {
        transactionGroups[groupKey] = {
          date: date,
          cusip: entry.cusip,
          transactionType: transactionType,
          totalShares: 0,
          entries: [],
          firstEntry: entry,
        };
      }

      const quantity = Number(entry.share_quantity) || 0;
      const netChange = entry.credit_debit === "Credit" ? quantity : -quantity;
      transactionGroups[groupKey].totalShares += netChange;
      transactionGroups[groupKey].entries.push(entry);
    });

    // Sort by date and transaction type, then calculate running totals
    const sortedGroups = Object.values(transactionGroups).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.transactionType.localeCompare(b.transactionType);
    });

    let runningTotal = 0;

    const aggregatedData = sortedGroups.map((group) => {
      runningTotal += group.totalShares;

      return {
        ...group.firstEntry,
        aggregatedDate: group.date,
        aggregatedNetShares: group.totalShares,
        runningTotal: runningTotal,
        transactionType: group.transactionType,
        entryCount: group.entries.length,
      };
    });

    // Apply final sorting
    aggregatedData.sort((a, b) => {
      let aValue = getSortValue(a, sortField);
      let bValue = getSortValue(b, sortField);

      // Handle numeric sorting
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Handle date sorting
      if (sortField === "transaction_date" || sortField === "created_at") {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      }

      // Handle string sorting (case-insensitive)
      const aStr = String(aValue || "").toLowerCase();
      const bStr = String(bValue || "").toLowerCase();

      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    setFilteredData(aggregatedData);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortValue = (entry, field) => {
    const activeSecurity = data.securities.find((s) => s.cusip === activeTab);

    switch (field) {
      case "issue_name":
        return (
          activeSecurity?.issue_name ||
          (currentIssuer
            ? `${currentIssuer.display_name || currentIssuer.issuer_name}`.trim()
            : "Unknown Security")
        );
      case "issue_ticker":
        return activeSecurity?.issue_ticker || "";
      case "cusip":
        return entry.cusip || "";
      case "transaction_date":
      case "created_at":
        return entry.aggregatedDate;
      case "security_type":
        return activeSecurity?.class_name || "";
      case "issued_security":
        return entry.aggregatedNetShares || 0;
      case "type_of_issuance":
        return entry.transactionType || "";
      case "outstanding_shares":
        return entry.runningTotal || 0;
      case "authorized_shares":
        return activeSecurity?.total_authorized_shares || 0;
      default:
        return entry[field] || "";
    }
  };

  const SortableHeader = ({ field, children, className = "" }) => (
    <TableHead
      className={`whitespace-nowrap cursor-pointer hover:bg-gray-50 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <ArrowUpDown className="ml-1 h-4 w-4" />
        {sortField === field && (
          <span className="ml-1 text-orange-600">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </TableHead>
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const exportToCSV = () => {
    const headers = [
      "Issue Name",
      "Issue Ticker",
      "Issue CUSIP",
      "Transaction Date",
      "Security Type",
      "Issued Security (#)",
      "Type of Issuance",
      "Total Outstanding Shares (#)",
      "Total Authorized Shares (#)",
    ];

    const csvContent = [
      headers.join(","),
      ...currentData.map((entry) => {
        const typeOfIssuance = entry.transactionType;
        const issuedSecurity = entry.aggregatedNetShares || 0;
        const activeSecurity = data.securities.find(
          (s) => s.cusip === activeTab,
        );
        const fullIssueName =
          activeSecurity?.issue_name ||
          (currentIssuer
            ? `${currentIssuer.display_name || currentIssuer.issuer_name}`.trim()
            : "Unknown Security");

        return [
          fullIssueName,
          entry.issue_ticker || activeSecurity?.issue_ticker || "-",
          entry.cusip,
          new Date(entry.aggregatedDate).toLocaleDateString(),
          entry.security_type || activeSecurity?.class_name || "-",
          issuedSecurity,
          typeOfIssuance,
          entry.runningTotal || "0",
          activeSecurity?.total_authorized_shares || "-",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-book-${activeTab || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || authLoading) {
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
              <p className="text-gray-600">Loading Control Book...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission checks handled by AuthContext

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
                      Control Book
                    </h1>
                    <p className="text-lg text-gray-600">
                      High-level summary ledger showing total outstanding shares
                      for each CUSIP
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {canEdit() && (
                      <Button
                        variant="outline"
                        className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                        onClick={() => setShowAddSecurity(true)}
                      >
                        <Building className="mr-2 h-4 w-4" />
                        Add Security
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                      onClick={exportToCSV}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </div>

              {/* CUSIP Tabs */}
              <Card className="card-glass border-0 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="mr-2 h-5 w-5" />
                    Securities Control Book
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-orange-50 border border-orange-200">
                      {[
                        ...new Set(
                          data.controlBookData
                            .map((record) => record.cusip)
                            .filter(Boolean),
                        ),
                      ].map((cusip) => {
                        const security = data.securities.find(
                          (s) => s.cusip === cusip,
                        );
                        const securityType =
                          security?.class_name ||
                          security?.security_type ||
                          "Unknown";
                        return (
                          <TabsTrigger
                            key={cusip}
                            value={cusip}
                            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
                          >
                            {securityType} ({cusip || "N/A"})
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {/* Search & Date Filters */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Search</Label>
                        <Input
                          placeholder="Search records..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                      <div>
                        <Label>Date From</Label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                      <div>
                        <Label>Date To</Label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Current Outstanding Summary */}
              <Card className="card-glass border-0 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Current Outstanding Shares by CUSIP
                  </CardTitle>
                  <CardDescription>
                    Summary of total outstanding shares for each security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            CUSIP
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Issue Name
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Security Type
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Total Outstanding Shares
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Total Authorized Shares
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Outstanding %
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Calculate current outstanding for each CUSIP
                          const outstandingByCusip = {};

                          data.controlBookData.forEach((record) => {
                            if (!outstandingByCusip[record.cusip]) {
                              outstandingByCusip[record.cusip] = {
                                cusip: record.cusip,
                                totalOutstanding: 0,
                                security: data.securities.find(
                                  (s) => s.cusip === record.cusip,
                                ),
                              };
                            }

                            const quantity = Number(record.share_quantity) || 0;
                            const netChange =
                              record.credit_debit === "Credit"
                                ? quantity
                                : -quantity;
                            outstandingByCusip[record.cusip].totalOutstanding +=
                              netChange;
                          });

                          return Object.values(outstandingByCusip).map(
                            (item) => (
                              <TableRow key={item.cusip}>
                                <TableCell className="whitespace-nowrap">
                                  {item.cusip}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {item.security?.issue_name ||
                                    "Unknown Security"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {item.security?.class_name ||
                                    item.security?.security_type ||
                                    "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {item.totalOutstanding.toLocaleString()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {item.security?.total_authorized_shares?.toLocaleString() ||
                                    "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {item.security?.total_authorized_shares
                                    ? `${((item.totalOutstanding / item.security.total_authorized_shares) * 100).toFixed(2)}%`
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ),
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Control Book Table by CUSIP */}
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Lock className="mr-2 h-5 w-5" />
                      Control Book -{" "}
                      {activeTab
                        ? (() => {
                            const security = data.securities.find(
                              (s) => s.cusip === activeTab,
                            );
                            return (
                              security?.class_name ||
                              security?.security_type ||
                              "Unknown Security"
                            );
                          })()
                        : "Select CUSIP"}
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-200"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Read Only
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Transfer journal records for CUSIP:{" "}
                    {activeTab || "None selected"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentData.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Database className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No records found
                        </h3>
                        <p className="text-gray-500 mb-4">
                          {activeTab
                            ? `No transactions found for CUSIP ${activeTab}`
                            : "Select a CUSIP tab to view records"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
  <TableRow>
    <SortableHeader field="transaction_date">
      Transaction Date
    </SortableHeader>
    <SortableHeader field="issue_name">
      Issue Name
    </SortableHeader>
    <SortableHeader field="issue_ticker">
      Issue Ticker
    </SortableHeader>
    <SortableHeader field="cusip">
      Issue CUSIP
    </SortableHeader>
    <SortableHeader field="security_type">
      Security Type
    </SortableHeader>
    <SortableHeader field="issued_security">
      Issued Security (#)
    </SortableHeader>
    <SortableHeader field="type_of_issuance">
      Type of Issuance
    </SortableHeader>
    <SortableHeader field="outstanding_shares">
      Total Outstanding Shares (#)
    </SortableHeader>
    <SortableHeader field="authorized_shares">
      Total Authorized Shares (#)
    </SortableHeader>
  </TableRow>
</TableHeader>

                          <TableBody>
                            {currentData.map((entry, index) => {
                              const activeSecurity = data.securities.find(
                                (s) => s.cusip === activeTab,
                              );
                              const fullIssueName =
                                activeSecurity?.issue_name ||
                                (currentIssuer
                                  ? `${currentIssuer.display_name || currentIssuer.issuer_name}`.trim()
                                  : "Unknown Security");

                              const typeOfIssuance = entry.transactionType;

                              return (
                                <TableRow
                                  key={`${entry.cusip}-${entry.aggregatedDate}-${entry.transactionType}-${index}`}
                                >
                                  <TableCell className=" whitespace-nowrap">
                                    {new Date(
                                      entry.aggregatedDate,
                                    ).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap ">
                                    {fullIssueName}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {activeSecurity?.issue_ticker || "-"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {entry.cusip}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {activeSecurity?.class_name || "-"}
                                  </TableCell>
                                  <TableCell
                                    className={`whitespace-nowrap font-medium ${
                                      entry.aggregatedNetShares >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {entry.aggregatedNetShares >= 0
                                      ? entry.aggregatedNetShares.toLocaleString()
                                      : `(${Math.abs(entry.aggregatedNetShares).toLocaleString()})`}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge
                                      variant={
                                        typeOfIssuance === "IPO"
                                          ? "default"
                                          : typeOfIssuance === "DWAC Deposit"
                                            ? "default"
                                            : typeOfIssuance ===
                                                "DWAC Withdrawal"
                                              ? "secondary"
                                              : typeOfIssuance ===
                                                  "Transfer Credit"
                                                ? "default"
                                                : typeOfIssuance ===
                                                    "Transfer Debit"
                                                  ? "secondary"
                                                  : "outline"
                                      }
                                    >
                                      {typeOfIssuance}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="  whitespace-nowrap">
                                    {entry.runningTotal.toLocaleString()}
                                  </TableCell>
                                  <TableCell className=" whitespace-nowrap">
                                    {activeSecurity?.total_authorized_shares?.toLocaleString() ||
                                      "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                          <div className="text-sm text-gray-700">
                            Showing {startIndex + 1} to{" "}
                            {Math.min(endIndex, filteredData.length)} of{" "}
                            {filteredData.length} results
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <div className="flex items-center space-x-1">
                              {Array.from(
                                { length: totalPages },
                                (_, i) => i + 1,
                              ).map((page) => (
                                <Button
                                  key={page}
                                  variant={
                                    currentPage === page ? "default" : "outline"
                                  }
                                  size="sm"
                                  className={
                                    currentPage === page
                                      ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                                      : "border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                                  }
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Add Security Modal */}
      <Dialog open={showAddSecurity} onOpenChange={setShowAddSecurity}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Add New Security</DialogTitle>
            <DialogDescription>
              Add a new security to the system
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CUSIP</Label>
              <Input
                placeholder="Enter 9-digit CUSIP or N/A for Class B"
                maxLength={9}
                pattern="[0-9]{9}|N/A"
                className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <Label>Issue Name</Label>
              <Input
                placeholder="Enter issue name"
                className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <Label>Issue Ticker</Label>
              <Input
                placeholder="Enter ticker"
                className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <Label>Trading Platform</Label>
              <Input
                placeholder="Enter platform"
                className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <Label>Security Type</Label>
              <Select>
                <SelectTrigger className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Units">Units</SelectItem>
                  <SelectItem value="Class A">Class A</SelectItem>
                  <SelectItem value="Class B">Class B</SelectItem>
                  <SelectItem value="Rights">Rights</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total Authorized Shares</Label>
              <Input
                type="number"
                placeholder="Enter total authorized shares"
                className="border-orange-200 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
              onClick={() => setShowAddSecurity(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              onClick={() => setShowAddSecurity(false)}
            >
              Add Security
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
