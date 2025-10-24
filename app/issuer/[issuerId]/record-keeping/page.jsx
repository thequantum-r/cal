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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function RecordKeepingPage({ params: paramsPromise }) {
  const {
    user,
    userRole,
    currentIssuer,
    availableIssuers,
    issuerSpecificRole,
    loading: pageLoading,
    initialized,
    validateAndSetIssuer,
    canEdit,
  } = useAuth();
  const router = useRouter();
  const [issuerId, setIssuerId] = useState(null);
  const [data, setData] = useState({
    securities: [],
    shareholders: [],
    transactions: [],
    restrictions: [],
    restrictionTemplates: [],
    stats: {
      totalTransactions: 0,
      totalCredits: 0,
      totalDebits: 0,
      netOutstanding: 0,
    },
  });
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCusip, setSelectedCusip] = useState("all");
  const [selectedShareholder, setSelectedShareholder] = useState("all");
  const [selectedTransactionType, setSelectedTransactionType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Sorting states
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Modal states
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [showAddSecurity, setShowAddSecurity] = useState(false);

  // Shareholder form state
  const [shareholderForm, setShareholderForm] = useState({
    account_number: '',
    shareholder_name: '',
    first_name: '',
    last_name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    taxpayer_id: '',
    email: '',
    phone: '',
    date_of_birth: '',
    holder_type: ''
  });
  const [submittingShareholder, setSubmittingShareholder] = useState(false);

  useEffect(() => {
    const getParams = async () => {
      const params = await paramsPromise;
      setIssuerId(params.issuerId);
    };
    getParams();
  }, [paramsPromise]);

  useEffect(() => {
    if (!initialized || !issuerId || !user) return;
    checkAuthAndFetchData();
  }, [initialized, issuerId, user]);

  useEffect(() => {
    applyFilters();
  }, [
    data.transactions,
    searchTerm,
    selectedCusip,
    selectedShareholder,
    selectedTransactionType,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const checkAuthAndFetchData = async () => {
    try {
      if (!user) {
        router.push("/login");
        return;
      }

      const { hasAccess } = await validateAndSetIssuer(issuerId);

      if (!hasAccess) {
        router.push("/?error=no_access");
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
      setLoading(true);

      // Fetch all data in parallel
      const [
        securitiesRes,
        shareholdersRes,
        transferJournalRes,
        restrictionsRes,
        restrictionTemplatesRes,
      ] = await Promise.all([
        fetch(`/api/securities?issuerId=${issuerId}`),
        fetch(`/api/shareholders?issuerId=${issuerId}`),
        fetch(`/api/record-keeping-transactions?issuerId=${issuerId}`),
        fetch(`/api/shareholder-restrictions?issuerId=${issuerId}`),
        fetch(`/api/restriction-templates?issuerId=${issuerId}`),
      ]);

      const securities = await securitiesRes.json();
      const shareholders = await shareholdersRes.json();
      const enrichedTransactions = await transferJournalRes.json();
      const restrictions = await restrictionsRes.json();
      const restrictionTemplates = await restrictionTemplatesRes.json();

      console.log("🔍 Enriched transactions sample:", enrichedTransactions[0]);
      console.log("🔍 Restriction templates:", restrictionTemplates);

      // Use the enriched data from the API directly (already contains all fields)
      const transactions = enrichedTransactions;

      // Calculate stats
      const totalTransactions = transactions.length;
      const totalCredits = transactions
        .filter((t) => t.credit_debit === "Credit")
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      const totalDebits = transactions
        .filter((t) => t.credit_debit === "Debit")
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      const netOutstanding = totalCredits - totalDebits;

      setData({
        securities,
        shareholders,
        transactions,
        restrictions,
        restrictionTemplates,
        stats: { totalTransactions, totalCredits, totalDebits, netOutstanding },
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data.transactions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.shareholder_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.shareholder_first_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.shareholder_last_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.cusip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.issue_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.issue_ticker?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.trading_platform
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.security_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.transaction_type
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.credit_debit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.certificate_type
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          t.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.zip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.taxpayer_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.tin_status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.holder_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.lei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.notes?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // CUSIP filter
    if (selectedCusip !== "all") {
      filtered = filtered.filter((t) => t.cusip === selectedCusip);
    }

    // Shareholder filter
    if (selectedShareholder !== "all") {
      filtered = filtered.filter(
        (t) => t.shareholder_id === selectedShareholder,
      );
    }

    // Transaction type filter
    if (selectedTransactionType !== "all") {
      filtered = filtered.filter(
        (t) => t.transaction_type === selectedTransactionType,
      );
    }

    // Date filters
    if (dateFrom) {
      filtered = filtered.filter((t) => t.transaction_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((t) => t.transaction_date <= dateTo);
    }

    // Apply sorting to filtered transactions
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        
        // Handle different data types
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        if (aVal instanceof Date && bVal instanceof Date) {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCusip("all");
    setSelectedShareholder("all");
    setSelectedTransactionType("all");
    setDateFrom("");
    setDateTo("");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortValue = (transaction, field) => {
    switch (field) {
      case 'transaction_date':
        return new Date(transaction.transaction_date);
      case 'quantity':
        return Number(transaction.quantity) || 0;
      case 'ownership_percentage':
        return Number(transaction.ownership_percentage) || 0;
      case 'date_of_birth':
        return transaction.date_of_birth ? new Date(transaction.date_of_birth) : new Date(0);
      case 'ofac_date':
        return transaction.ofac_date ? new Date(transaction.ofac_date) : new Date(0);
      default:
        return transaction[field] || '';
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
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  const getRestrictionDescription = (code) => {
    // Look for restriction template with matching restriction_type (which is the code)
    const template = data.restrictionTemplates.find(t => t.restriction_type === code);
    return template?.description || getStaticRestrictionDescription(code);
  };

  const getStaticRestrictionDescription = (code) => {
    const staticDescriptions = {
      'A': 'Restricted securities that cannot be freely traded',
      'B': 'Securities subject to holding period requirements',
      'C': 'Securities restricted under Rule 144',
      'D': 'Insider trading restrictions apply',
      'E': 'Lock-up period restrictions',
      'F': 'Transfer restrictions due to agreement',
    };
    return staticDescriptions[code] || `Restriction code: ${code}`;
  };

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handleAddShareholder = async () => {
    if (!shareholderForm.account_number.trim()) {
      alert('Account number is required');
      return;
    }
    
    if (!shareholderForm.first_name.trim()) {
      alert('First name is required');
      return;
    }

    setSubmittingShareholder(true);
    try {
      const response = await fetch('/api/shareholders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...shareholderForm,
          issuer_id: issuerId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add shareholder');
      }

      const newShareholder = await response.json();
      
      // Update the shareholders list
      setData(prevData => ({
        ...prevData,
        shareholders: [newShareholder, ...prevData.shareholders]
      }));

      // Reset form and close modal
      setShareholderForm({
        account_number: '',
        shareholder_name: '',
        first_name: '',
        last_name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        taxpayer_id: '',
        email: '',
        phone: '',
        date_of_birth: '',
        holder_type: ''
      });
      setShowAddShareholder(false);
      
      alert('Shareholder added successfully!');
    } catch (error) {
      console.error('Error adding shareholder:', error);
      alert(error.message || 'Failed to add shareholder');
    } finally {
      setSubmittingShareholder(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "CUSIP",
      "Issue Name",
      "Issue Ticker",
      "Trading Platform",
      "Security Type",
      "Transaction Type",
      "Credit/Debit",
      "Quantity",
      "Status",
      "Certificate Type",
      "Account Number",
      "Shareholder Name",
      "First Name",
      "Last Name",
      "Address",
      "City",
      "State",
      "Zip",
      "Country",
      "Taxpayer ID",
      "TIN Status",
      "Email",
      "Phone",
      "Date of Birth",
      "Ownership %",
      "LEI",
      "Holder Type",
      "OFAC Date",
      "OFAC Results",
    ];

    const csvContent = [
      headers.join(","),
      ...currentTransactions.map((t) =>
        [
          t.transaction_date,
          t.cusip,
          t.issue_name,
          t.issue_ticker,
          t.trading_platform,
          t.security_type,
          t.transaction_type,
          t.credit_debit,
          t.quantity,
          t.status,
          t.certificate_type,
          t.account_number,
          t.shareholder_name,
          t.shareholder_first_name,
          t.shareholder_last_name,
          t.address,
          t.city,
          t.state,
          t.zip,
          t.country,
          t.taxpayer_id,
          t.tin_status,
          t.email,
          t.phone,
          t.date_of_birth,
          t.ownership_percentage,
          t.lei,
          t.holder_type,
          t.ofac_date,
          t.ofac_results,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `record-keeping-book-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (pageLoading || !initialized) {
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
              <p className="text-gray-600">Loading RecordKeeping Book...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission checks using AuthContext

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
                      RecordKeeping Book
                    </h1>
                    <p className="text-lg text-gray-600">
                      Detailed, per-shareholder ledger for tracking all
                      transactions
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {canEdit && (
                      <>
                        <Button
                          variant="outline"
                          className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                          onClick={() => setShowAddShareholder(true)}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Add Shareholder
                        </Button>
                        <Button
                          variant="outline"
                          className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                          onClick={() => setShowAddSecurity(true)}
                        >
                          <Building className="mr-2 h-4 w-4" />
                          Add Security
                        </Button>
                        <Button
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                          onClick={() => setShowAddTransaction(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Transaction
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
                        Total Transactions
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {data.stats.totalTransactions.toLocaleString()}
                      </p>
                    </div>
                    
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Credits
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {data.stats.totalCredits.toLocaleString()}
                      </p>
                    </div>
                    
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Debits
                      </p>
                      <p className="text-3xl font-bold text-red-600">
                        {data.stats.totalDebits.toLocaleString()}
                      </p>
                    </div>
                   
                  </div>
                </div>

                <div className="card-glass p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Net Outstanding
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {data.stats.netOutstanding.toLocaleString()}
                      </p>
                    </div>
                    
                  </div>
                </div>
              </div>

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
    const outstandingByCusip = {};
    data.transactions.forEach((transaction) => {
      if (!outstandingByCusip[transaction.cusip]) {
        outstandingByCusip[transaction.cusip] = {
          cusip: transaction.cusip,
          totalOutstanding: 0,
          security: data.securities.find(
            (s) => s.cusip === transaction.cusip,
          ),
        };
      }

      const quantity = Number(transaction.quantity) || 0;
      const netChange =
        transaction.credit_debit === "Credit" ? quantity : -quantity;
      outstandingByCusip[transaction.cusip].totalOutstanding += netChange;
    });

    return Object.values(outstandingByCusip).map((item) => (
      <TableRow key={item.cusip}>
        {/* ✅ CUSIP font normal */}
        <TableCell className="whitespace-nowrap">
          {item.cusip}
        </TableCell>

        {/* ✅ Issue name font normal */}
        <TableCell className="whitespace-nowrap">
          {item.security?.issue_name || "Unknown Security"}
        </TableCell>

        <TableCell className="whitespace-nowrap">
          {item.security?.class_name ||
            item.security?.security_type ||
            "-"}
        </TableCell>

        {/* ✅ Total Outstanding font normal */}
        <TableCell className="whitespace-nowrap">
          {item.totalOutstanding.toLocaleString()}
        </TableCell>

        <TableCell className="whitespace-nowrap">
          {item.security?.total_authorized_shares?.toLocaleString() || "-"}
        </TableCell>

        <TableCell className="whitespace-nowrap">
          {item.security?.total_authorized_shares
            ? `${(
                (item.totalOutstanding /
                  item.security.total_authorized_shares) *
                100
              ).toFixed(2)}%`
            : "-"}
        </TableCell>
      </TableRow>
    ));
  })()}
</TableBody>

                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Filters & Search */}
              <Card className="card-glass border-0 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Filter className="mr-2 h-5 w-5" />
                      Filters & Search
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-300 hover:bg-orange-50 hover:border-orange-500 text-orange-700"
                        onClick={exportToCSV}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div>
                      <Label>Search</Label>
                      <Input
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CUSIP</Label>
                      <Select
                        value={selectedCusip}
                        onValueChange={setSelectedCusip}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All CUSIPs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All CUSIPs</SelectItem>
                          {data.securities.map((security) => (
                            <SelectItem
                              key={security.id}
                              value={security.cusip}
                            >
                              {security.cusip} - {security.issue_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Shareholder</Label>
                      <Select
                        value={selectedShareholder}
                        onValueChange={setSelectedShareholder}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Shareholders" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Shareholders</SelectItem>
                          {data.shareholders.map((shareholder) => (
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
                    <div>
                      <Label>Transaction Type</Label>
                      <Select
                        value={selectedTransactionType}
                        onValueChange={setSelectedTransactionType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="IPO">IPO</SelectItem>
                          <SelectItem value="DWAC Withdrawal">
                            DWAC Withdrawal
                          </SelectItem>
                          <SelectItem value="DWAC Deposit">
                            DWAC Deposit
                          </SelectItem>
                          <SelectItem value="Transfer Credit">
                            Transfer Credit
                          </SelectItem>
                          <SelectItem value="Transfer Debit">
                            Transfer Debit
                          </SelectItem>
                          <SelectItem value="Dividend">Dividend</SelectItem>
                          <SelectItem value="Stock Split">
                            Stock Split
                          </SelectItem>
                          <SelectItem value="Redemption">Redemption</SelectItem>
                          <SelectItem value="Cancellation">
                            Cancellation
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date From</Label>
                      <Input 
                         type="date"
                         value={dateFrom}
                         onChange={(e) => {
                           let value = e.target.value
                       
                           // If year part > 4 digits, trim it
                           if (/^\d{5,}/.test(value)) {
                             const [year, month, day] = value.split("-")
                             value = `${year.slice(0, 4)}${month ? "-" + month : ""}${day ? "-" + day : ""}`
                           }
                       
                           setDateFrom(value)
                         }}
                      />
                    </div>
                    <div>
                      <Label>Date To</Label>
                      <Input 
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          let value = e.target.value
                      
                          // If year part > 4 digits, trim it
                          if (/^\d{5,}/.test(value)) {
                            const [year, month, day] = value.split("-")
                            value = `${year.slice(0, 4)}${month ? "-" + month : ""}${day ? "-" + day : ""}`
                          }
                      
                          setDateTo(value)
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card className="card-glass border-0">
                <CardHeader>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                    {filteredTransactions.length} transactions found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentTransactions.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Database className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No transactions found
                        </h3>
                        <p className="text-gray-500 mb-4">
                          Try adjusting your filters or add your first
                          transaction to get started
                        </p>
                        {canEdit && (
                          <Button onClick={() => setShowAddTransaction(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Transaction
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableHeader field="transaction_date">
                                Date
                              </SortableHeader>
                              <SortableHeader field="cusip">
                                CUSIP
                              </SortableHeader>
                              <SortableHeader field="issue_name">
                                Issue Name
                              </SortableHeader>
                              <SortableHeader field="issue_ticker">
                                Issue Ticker
                              </SortableHeader>
                              <SortableHeader field="trading_platform">
                                Trading Platform
                              </SortableHeader>
                              <SortableHeader field="security_type">
                                Security Type
                              </SortableHeader>
                              <SortableHeader field="transaction_type">
                                Transaction Type
                              </SortableHeader>
                              <SortableHeader field="credit_debit">
                                Credit/Debit
                              </SortableHeader>
                              <SortableHeader field="quantity">
                                Quantity
                              </SortableHeader>
                              <SortableHeader field="status">
                                Status
                              </SortableHeader>
                              <SortableHeader field="certificate_type">
                                Certificate Type
                              </SortableHeader>
                              <SortableHeader field="account_number">
                                Account Number
                              </SortableHeader>
                              <SortableHeader field="shareholder_name">
                                Shareholder Name
                              </SortableHeader>
                              <SortableHeader field="shareholder_first_name">
                                First Name
                              </SortableHeader>
                              <SortableHeader field="shareholder_last_name">
                                Last Name
                              </SortableHeader>
                              <SortableHeader field="address">
                                Address
                              </SortableHeader>
                              <SortableHeader field="city">
                                City
                              </SortableHeader>
                              <SortableHeader field="state">
                                State
                              </SortableHeader>
                              <SortableHeader field="zip">
                                Zip
                              </SortableHeader>
                              <SortableHeader field="country">
                                Country
                              </SortableHeader>
                              <SortableHeader field="taxpayer_id">
                                Taxpayer ID
                              </SortableHeader>
                              <SortableHeader field="tin_status">
                                TIN Status
                              </SortableHeader>
                              <SortableHeader field="email">
                                Email
                              </SortableHeader>
                              <SortableHeader field="phone">
                                Phone
                              </SortableHeader>
                              <SortableHeader field="date_of_birth">
                                Date of Birth
                              </SortableHeader>
                              <SortableHeader field="ownership_percentage">
                                Ownership %
                              </SortableHeader>
                              <SortableHeader field="lei">
                                LEI
                              </SortableHeader>
                              <SortableHeader field="holder_type">
                                Holder Type
                              </SortableHeader>
                              <SortableHeader field="ofac_date">
                                OFAC Date
                              </SortableHeader>
                              <SortableHeader field="ofac_results">
                                OFAC Results
                              </SortableHeader>
                              <SortableHeader field="restriction_codes">
                                Restrictions
                              </SortableHeader>
                              <SortableHeader field="notes">
                                Notes
                              </SortableHeader>
                              <SortableHeader field="legal_documents">
                                Legal Documents
                              </SortableHeader>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentTransactions.map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(
                                    transaction.transaction_date,
                                  ).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.cusip}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.issue_name}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.issue_ticker}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.trading_platform}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.security_type}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant="outline">
                                    {transaction.transaction_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge
                                    variant={
                                      transaction.credit_debit === "Credit"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {transaction.credit_debit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.quantity?.toLocaleString()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.status}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.certificate_type}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.account_number}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.shareholder_name}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.shareholder_first_name}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.shareholder_last_name}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.address}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.city}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.state}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.zip}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.country}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.taxpayer_id}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.tin_status}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.email}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.phone}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.date_of_birth
                                    ? new Date(
                                        transaction.date_of_birth,
                                      ).toLocaleDateString()
                                    : "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.ownership_percentage
                                    ? `${transaction.ownership_percentage}%`
                                    : "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.lei || "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.holder_type || "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.ofac_date
                                    ? new Date(
                                        transaction.ofac_date,
                                      ).toLocaleDateString()
                                    : "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.ofac_results || "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.restriction_codes ? (
                                    <div className="flex flex-wrap gap-1">
                                      {transaction.restriction_codes
                                        .split(", ")
                                        .map((code, index) => (
                                          <Popover key={index}>
                                            <PopoverTrigger asChild>
                                              <Badge
                                                variant="outline"
                                                className="mr-1 mb-1 cursor-help hover:bg-gray-100"
                                              >
                                                {code}
                                              </Badge>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80" side="top">
                                              <div className="space-y-2">
                                                <h4 className="font-semibold text-sm">
                                                  Restriction: {code}
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                  {getRestrictionDescription(code)}
                                                </p>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        ))}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {transaction.notes || "-"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {(() => {
                                    // Simple check: if notes contain legal authorization, show the legal doc indicator
                                    const notes = transaction.notes || "";
                                    const hasLegalDoc = notes.includes("--- LEGAL AUTHORIZATION DOCUMENT ---");
                                    
                                    if (hasLegalDoc) {
                                      // Extract URL (any URL in the notes)
                                      const urlMatch = notes.match(/https?:\/\/[^\s\n]+/);
                                      const documentUrl = urlMatch ? urlMatch[0] : null;
                                      
                                      return (
                                        <div className="flex items-center space-x-2">
                                          {documentUrl ? (
                                            <a
                                              href={documentUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                                              title="View legal authorization document"
                                            >
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                                <path d="M8 12a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                              </svg>
                                              <span>Legal Document</span>
                                            </a>
                                          ) : (
                                            <div className="flex items-center space-x-1 text-gray-600 text-sm">
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                              </svg>
                                              <span>Legal Document</span>
                                            </div>
                                          )}
                                          <div className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                                            Legal Auth
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    return "-";
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                          <div className="text-sm text-gray-700">
                            Showing {startIndex + 1} to{" "}
                            {Math.min(endIndex, filteredTransactions.length)} of{" "}
                            {filteredTransactions.length} results
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
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
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
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

      {/* Add Transaction Modal */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction to the recordKeeping book
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CUSIP</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select CUSIP" />
                </SelectTrigger>
                <SelectContent>
                  {data.securities.map((security) => (
                    <SelectItem key={security.id} value={security.cusip}>
                      {security.cusip} - {security.issue_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shareholder</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select Shareholder" />
                </SelectTrigger>
                <SelectContent>
                  {data.shareholders.map((shareholder) => (
                    <SelectItem key={shareholder.id} value={shareholder.id}>
                      {shareholder.account_number} - {shareholder.first_name}{" "}
                      {shareholder.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transaction Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IPO">IPO</SelectItem>
                  <SelectItem value="DWAC Withdrawal">
                    DWAC Withdrawal
                  </SelectItem>
                  <SelectItem value="DWAC Deposit">DWAC Deposit</SelectItem>
                  <SelectItem value="Transfer Credit">
                    Transfer Credit
                  </SelectItem>
                  <SelectItem value="Transfer Debit">Transfer Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit/Debit</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" placeholder="Enter quantity" />
            </div>
            <div>
              <Label>Transaction Date</Label>
              <Input type="date" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea placeholder="Enter notes (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddTransaction(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => setShowAddTransaction(false)}>
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shareholder Modal */}
      <Dialog open={showAddShareholder} onOpenChange={setShowAddShareholder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Shareholder</DialogTitle>
            <DialogDescription>
              Add a new shareholder to the system
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Account Number *</Label>
              <Input 
                placeholder="Enter account number" 
                value={shareholderForm.account_number}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, account_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                placeholder="Enter shareholder name" 
                value={shareholderForm.shareholder_name}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, shareholder_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>First Name *</Label>
              <Input 
                placeholder="Enter first name" 
                value={shareholderForm.first_name}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, first_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input 
                placeholder="Enter last name" 
                value={shareholderForm.last_name}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, last_name: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input 
                placeholder="Enter address" 
                value={shareholderForm.address}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input 
                placeholder="Enter city" 
                value={shareholderForm.city}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div>
              <Label>State</Label>
              <Input 
                placeholder="Enter state" 
                value={shareholderForm.state}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, state: e.target.value }))}
              />
            </div>
            <div>
              <Label>Zip</Label>
              <Input 
                placeholder="Enter zip code" 
                value={shareholderForm.zip}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, zip: e.target.value }))}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input 
                placeholder="Enter country" 
                value={shareholderForm.country}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, country: e.target.value }))}
              />
            </div>
            <div>
              <Label>Taxpayer ID</Label>
              <Input 
                placeholder="Enter taxpayer ID" 
                value={shareholderForm.taxpayer_id}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, taxpayer_id: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="Enter email" 
                value={shareholderForm.email}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input 
                placeholder="Enter phone number" 
                value={shareholderForm.phone}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input 
                type="date" 
                value={shareholderForm.date_of_birth}
                onChange={(e) => setShareholderForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>
            <div>
              <Label>Holder Type</Label>
              <Select 
                value={shareholderForm.holder_type}
                onValueChange={(value) => setShareholderForm(prev => ({ ...prev, holder_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Depository">Depository</SelectItem>
                  <SelectItem value="Partnership">Partnership</SelectItem>
                  <SelectItem value="Corporation">Corporation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddShareholder(false)}
              disabled={submittingShareholder}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddShareholder}
              disabled={submittingShareholder || !shareholderForm.account_number.trim() || !shareholderForm.first_name.trim()}
            >
              {submittingShareholder ? "Adding..." : "Add Shareholder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Security Modal */}
      <Dialog open={showAddSecurity} onOpenChange={setShowAddSecurity}>
        <DialogContent>
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
              />
            </div>
            <div>
              <Label>Issue Name</Label>
              <Input placeholder="Enter issue name" />
            </div>
            <div>
              <Label>Issue Ticker</Label>
              <Input placeholder="Enter ticker" />
            </div>
            <div>
              <Label>Trading Platform</Label>
              <Input placeholder="Enter platform" />
            </div>
            <div>
              <Label>Security Type</Label>
              <Select>
                <SelectTrigger>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSecurity(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddSecurity(false)}>
              Add Security
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
