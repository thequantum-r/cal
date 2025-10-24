"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Users,
  Shield,
  Key,
  Clock,
  AlertTriangle,
  Crown,
  UserCheck,
  Plus,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { roleLabels, roleColors, roleIcons } from "@/lib/constants";

export default function IssuerUsersTable({
  users,
  invitedUsers,
  currentUserId,
  currentUserRole,
  issuerId,
  currentIssuer,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const itemsPerPage = 10;
  const router = useRouter();

  // Get available roles (admin can manage admin, transfer_team, read_only)
  const availableRoles = [
    { value: "admin", label: "Admin" },
    { value: "transfer_team", label: "Transfer Team" },
    { value: "read_only", label: "Read Only" },
  ];

  // Filter users based on search term
  const filteredUsers = users.filter((user) =>
    user.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter invited users based on search term
  const filteredInvitedUsers = invitedUsers.filter(
    (invitedUser) =>
      invitedUser.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invitedUser.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Paginate users
  const totalUsers = filteredUsers.length + filteredInvitedUsers.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Combine and paginate
  const combinedUsers = [
    ...filteredUsers.map((u) => ({ type: "active", ...u })),
    ...filteredInvitedUsers.map((u) => ({ type: "invited", ...u })),
  ];
  const paginatedUsers = combinedUsers.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleEditRole = (user) => {
    setSelectedUser(user);
    setNewRole(user.roles?.name || "");
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;

    const supabase = createClient();

    try {
      // Get the role ID for the new role
      const { data: roleData, error: roleError } = await supabase
        .from("roles_new")
        .select("id")
        .eq("role_name", newRole)
        .single();

      if (roleError) throw roleError;

      // Update the user's role in the issuer_users table
      const { error: updateError } = await supabase
        .from("issuer_users_new")
        .update({ role_id: roleData.id })
        .eq("user_id", selectedUser.user_id)
        .eq("issuer_id", issuerId);

      if (updateError) throw updateError;

      router.refresh();
      setEditDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Error updating user role: " + error.message);
      setErrorDialogOpen(true);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserRole) return;

    const supabase = createClient();

    try {
      // Get the role ID for the selected role
      const { data: roleData, error: roleError } = await supabase
        .from("roles_new")
        .select("id")
        .eq("name", newUserRole)
        .single();

      if (roleError) throw roleError;

      // Add to invited_users table
      const { error: inviteError } = await supabase
        .from("invited_users_new")
        .insert({
          email: newUserEmail,
          name: newUserName || newUserEmail.split("@")[0],
          issuer_id: issuerId,
          role_id: roleData.id,
          invited_at: new Date().toISOString(),
        });

      if (inviteError) throw inviteError;

      // Reset form and close dialog
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("");
      setAddUserDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error inviting user:", error);
      setErrorMessage("Error inviting user: " + error.message);
      setErrorDialogOpen(true);
    }
  };

  const getRoleBadge = (roleName) => {
    const roleConfig = {
      superadmin: {
        label: "Super Admin",
        icon: Crown,
        color: "from-purple-500 to-indigo-500",
      },
      admin: {
        label: "Admin",
        icon: Shield,
        color: "from-red-500 to-orange-500",
      },
      transfer_team: {
        label: "Transfer Team",
        icon: UserCheck,
        color: "from-blue-500 to-cyan-500",
      },
      read_only: {
        label: "Read Only",
        icon: Users,
        color: "from-gray-500 to-slate-500",
      },
    };

    const config = roleConfig[roleName] || roleConfig.read_only;
    const Icon = config.icon;

    return (
      <div
        className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r ${config.color} text-white shadow-lg`}
      >
        <Icon className="h-3 w-3 mr-1.5" />
        {config.label}
      </div>
    );
  };

  const canEditUser = (user) => {
    // Can't edit yourself
    if (user.user_id === currentUserId) return false;

    // Admins can edit other users in their issuer (but not superadmins)
    if (currentUserRole === "admin") {
      return user.roles?.name !== "superadmin";
    }

    // Superadmins can edit anyone
    return currentUserRole === "superadmin";
  };

  return (
    <div className="space-y-6">
      {/* Search and Add Button */}
      <div className="flex justify-between items-center">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
          />
        </div>
        <Button
          onClick={() => setAddUserDialogOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Table */}
      <div className="card-glass overflow-hidden">
        <div className="overflow-x-auto table-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/30">
                <TableHead className="font-semibold text-gray-900">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Email
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Name
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Role
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Joined
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((item, index) => (
                <TableRow
                  key={`${item.type}-${item.user_id || item.email}-${index}`}
                  className="hover:bg-white/20 transition-colors"
                >
                  <TableCell>
                    {item.type === "active" ? (
                      <div className="flex items-center text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600">
                        <Clock className="h-4 w-4 mr-2" />
                        Invited
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="font-medium text-gray-900">
                    {item.type === "active" ? item.users?.email : item.email}
                  </TableCell>

                  <TableCell className="text-gray-700">
                    {item.type === "active"
                      ? item.users?.email?.split("@")[0] || "-"
                      : item.name || "-"}
                  </TableCell>

                  <TableCell>
                    {item.type === "active"
                      ? getRoleBadge(item.roles?.name)
                      : getRoleBadge(item.roles?.name)}
                  </TableCell>

                  <TableCell className="text-gray-700">
                    {item.type === "active"
                      ? new Date(item.users?.created_at).toLocaleDateString()
                      : new Date(item.invited_at).toLocaleDateString()}
                  </TableCell>

                  <TableCell>
                    <div className="flex space-x-2">
                      {item.type === "active" && canEditUser(item) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(item)}
                          className="border-white/20 bg-white/50 hover:bg-white/70"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {paginatedUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-500 py-8"
                  >
                    No users found matching your search criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + itemsPerPage, totalUsers)} of {totalUsers}{" "}
            results
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

      {/* Edit Role Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Edit className="h-5 w-5 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-gray-900">
                  Edit User Role
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Change the role for {selectedUser?.users?.email}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm border border-white/20">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateRole}
              disabled={!newRole || newRole === selectedUser?.roles?.name}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Role
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

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Invite User
                </DialogTitle>
                <p className="text-sm text-gray-600">
                  Invite a new user to{" "}
                  {currentIssuer?.display_name || currentIssuer?.name}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <Label
                htmlFor="name"
                className="text-sm font-medium text-gray-700"
              >
                Name (Optional)
              </Label>
              <Input
                id="name"
                placeholder="User's full name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <Label
                htmlFor="role"
                className="text-sm font-medium text-gray-700"
              >
                Role *
              </Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger className="mt-1 bg-white/50 backdrop-blur-sm border border-white/20">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAddUserDialogOpen(false);
                setNewUserEmail("");
                setNewUserName("");
                setNewUserRole("");
              }}
              className="border-white/30 bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!newUserEmail || !newUserRole}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
