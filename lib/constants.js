import { Crown, Shield, Users, UserCheck } from "lucide-react";

export const roleColors = {
  superadmin:
    "bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-md border-0",
  admin: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
  issuer_admin:
    "!bg-gradient-to-r !from-blue-600 !to-indigo-700 !text-white !shadow-md !font-semibold !border-0",
  transfer_team:
    "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md",
  read_only: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
  shareholder:
    "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md border-0",
  custom: "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md",
};

export const roleLabels = {
  superadmin: "Super Admin",
  admin: "Admin",
  issuer_admin: "Issuer Admin",
  transfer_team: "Transfer Team",
  read_only: "Read Only",
  shareholder: "Shareholder",
};

export const roleIcons = {
  superadmin: Crown,
  admin: Shield,
  issuer_admin: UserCheck,
  transfer_team: Shield,
  read_only: Users,
  shareholder: Users,
};

// Helper function to get role display info
export const getRoleDisplay = (role) => {
  return {
    color: roleColors[role] || roleColors.read_only,
    label: roleLabels[role] || "Read Only",
    Icon: roleIcons[role] || Users,
  };
};
