"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit,
  Trash2,
  Plus,
  Search,
  ArrowUpDown,
  Users,
  Hash,
  Calendar,
  BarChart3,
  AlertTriangle,
  Eye,
  Building,
  Shield,
} from "lucide-react";
import ShareholderModal from "./shareholder-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ShareholdersTable({
  shareholders,
  userRole,
  issuerId,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("first_name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShareholder, setSelectedShareholder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareholderToDelete, setShareholderToDelete] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedShareholderForView, setSelectedShareholderForView] =
    useState(null);
  const itemsPerPage = 10;
  const router = useRouter();

  // Filter shareholders based on search term
  const filteredShareholders = shareholders.filter((shareholder) => {
    const fullName = shareholder.first_name
      ? `${shareholder.first_name} ${shareholder.last_name || ""}`
          .trim()
          .toLowerCase()
      : (shareholder.name || "").toLowerCase();

    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      (shareholder.taxpayer_id || shareholder.tax_id || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (shareholder.account_number || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (shareholder.holder_type || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  // Sort shareholders
  const sortedShareholders = [...filteredShareholders].sort((a, b) => {
    let aValue, bValue;

    if (sortField === "name") {
      // Handle name sorting specially
      aValue = a.first_name
        ? `${a.first_name} ${a.last_name || ""}`.trim()
        : a.name || "";
      bValue = b.first_name
        ? `${b.first_name} ${b.last_name || ""}`.trim()
        : b.name || "";
    } else if (sortField === "ownership_percentage") {
      // Handle ownership percentage sorting with calculated values
      aValue = parseFloat(
        a.calculated_ownership_percentage || a.ownership_percentage || 0,
      );
      bValue = parseFloat(
        b.calculated_ownership_percentage || b.ownership_percentage || 0,
      );
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Paginate shareholders
  const totalPages = Math.ceil(sortedShareholders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedShareholders = sortedShareholders.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleEdit = (shareholder) => {
    setSelectedShareholder(shareholder);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedShareholder(null);
    setIsModalOpen(true);
  };

  const handleViewDetails = (shareholder) => {
    setSelectedShareholderForView(shareholder);
    setViewDetailsOpen(true);
  };

  const handleDeleteClick = (shareholder) => {
    setShareholderToDelete(shareholder);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!shareholderToDelete) return;

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("shareholders_new")
        .delete()
        .eq("id", shareholderToDelete.id);

      if (error) throw error;

      router.refresh();
      setDeleteDialogOpen(false);
      setShareholderToDelete(null);
    } catch (error) {
      console.error("Error deleting shareholder:", error);
      setErrorMessage("Error deleting shareholder: " + error.message);
      setErrorDialogOpen(true);
    }
  };

  const canEdit = userRole === "admin" || userRole === "transfer_team";
  const canDelete = userRole === "admin";
  const canCreate = userRole === "admin";

  return (
    <div className="space-y-6">
      {/* Search and Add Button */}
      <div className="flex justify-between items-center">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name, taxpayer ID, account number, or holder type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>
        {canCreate && (
          <Button
            onClick={handleAdd}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Shareholder
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card-glass overflow-hidden">
        <div className="overflow-x-auto table-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/30">
                <TableHead
                  className="cursor-pointer hover:bg-white/50 transition-colors font-semibold text-gray-900"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Name</span>
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Address
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Taxpayer ID
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Account
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Holder Type
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-white/50 transition-colors font-semibold text-gray-900"
                  onClick={() => handleSort("ownership_percentage")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Ownership %</span>
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  OFAC Status
                </TableHead>
                {canEdit && (
                  <TableHead className="font-semibold text-gray-900">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedShareholders.map((shareholder) => (
                <TableRow
                  key={shareholder.id}
                  className="hover:bg-white/20 transition-colors"
                >
                  <TableCell className="font-medium text-gray-900">
                    {shareholder.first_name
                      ? `${shareholder.first_name} ${shareholder.last_name || ""}`.trim()
                      : shareholder.name || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-gray-700">
                    {shareholder.address
                      ? `${shareholder.address}, ${shareholder.city || ""}, ${shareholder.state || ""} ${shareholder.zip || ""}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {shareholder.taxpayer_id || shareholder.tax_id || "-"}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {shareholder.account_number || "-"}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {shareholder.holder_type || "-"}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {shareholder.calculated_ownership_percentage
                      ? `${shareholder.calculated_ownership_percentage}%`
                      : shareholder.ownership_percentage
                        ? `${shareholder.ownership_percentage}%`
                        : "0.00%"}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {shareholder.OFAC_results || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
  variant="outline"
  size="sm"
  onClick={() => router.push(`/shareholder/${shareholder.id}`)}  // 👈 go to dynamic page
  className="border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700"
>
  <Eye className="h-4 w-4" />
</Button>

                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(shareholder)}
                          className="border-white/20 bg-white/50 hover:bg-white/70"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(shareholder)}
                          className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + itemsPerPage, sortedShareholders.length)} of{" "}
            {sortedShareholders.length} results
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="border-white/20 bg-white/50 hover:bg-white/70"
            >
              Previous
            </Button>
            <span className="flex items-center px-3 py-2 text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="border-white/20 bg-white/50 hover:bg-white/70"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modal */}
      <ShareholderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shareholder={selectedShareholder}
        userRole={userRole}
        issuerId={issuerId}
      />

      {/* View Details Modal */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Shareholder Details
                </DialogTitle>
                <p className="text-sm text-gray-600">
                  View detailed information for{" "}
                  {selectedShareholderForView?.name}
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedShareholderForView && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-500" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Name
                    </Label>
                    <p className="text-gray-900 font-medium">
                      {selectedShareholderForView.first_name &&
                        `${selectedShareholderForView.first_name} `}
                      {selectedShareholderForView.last_name &&
                        ` ${selectedShareholderForView.last_name}`}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Account Number
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.account_number || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Taxpayer ID
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.taxpayer_id ||
                        selectedShareholderForView.tax_id ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Ownership Percentage
                    </Label>
                    <p className="text-gray-900 font-semibold">
                      {selectedShareholderForView.calculated_ownership_percentage
                        ? `${selectedShareholderForView.calculated_ownership_percentage}%`
                        : selectedShareholderForView.ownership_percentage
                          ? `${selectedShareholderForView.ownership_percentage}%`
                          : "0.00%"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Current Shares
                    </Label>
                    <p className="text-gray-900 font-semibold">
                      {selectedShareholderForView.current_shares
                        ? selectedShareholderForView.current_shares.toLocaleString()
                        : "0"}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Address
                  </Label>
                  <p className="text-gray-900">
                    {selectedShareholderForView.address
                      ? `${selectedShareholderForView.address}, ${selectedShareholderForView.city || ""}, ${selectedShareholderForView.state || ""} ${selectedShareholderForView.ZIP || ""}, ${selectedShareholderForView.country || ""}`
                          .replace(/,\s*,/g, ",")
                          .replace(/,\s*$/, "")
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-500" />
                  Additional Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      LEI
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.lei || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Holder Type
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.holder_type || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      TIN Status
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.tin_status || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      OFAC Results
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.ofac_results || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      OFAC Date
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.ofac_date
                        ? new Date(
                            selectedShareholderForView.ofac_date,
                          ).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Date of Birth
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.dob
                        ? new Date(
                            selectedShareholderForView.dob,
                          ).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-orange-500" />
                  Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Email
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.email || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Phone
                    </Label>
                    <p className="text-gray-900">
                      {selectedShareholderForView.phone || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-gray-900">
                  Delete Shareholder
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Are you sure you want to delete this shareholder? This action
                  cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white w-full sm:w-auto"
            >
              Delete Shareholder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-gray-900">
                  Error
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  {errorMessage}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogAction
              onClick={() => setErrorDialogOpen(false)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
