"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User, TrendingUp, ArrowRightLeft, BarChart3, Activity, Building, LogOut } from "lucide-react"

/**
 * ShareholderDashboard
 * ---------------------
 * A reusable dashboard for displaying shareholder info.
 * - Used by self-view (shareholders)
 * - Used by admins/superadmins when clicking 👁 on a row
 *
 * NOTES:
 * - Admins/Superadmins see "Admin View" / "Super Admin View"
 * - Shareholders see only their own profile ("Shareholder")
 * - Can pass in `onSignOut` for self-view; admins don't need it
 */
export default function ShareholderDashboard({ shareholderData, userRole, onSignOut }) {
  if (!shareholderData?.shareholder) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Shareholder Profile Not Found</h2>
            <p className="text-gray-600 mb-6">
              The shareholder profile could not be located. Please verify the record.
            </p>
            {onSignOut && (
              <Button onClick={onSignOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const { shareholder, transactions, currentShares, issuer } = shareholderData
  const totalTransactions = transactions.length
  const creditTransactions = transactions.filter(
    (t) =>
      t.transaction_type !== "DWAC Withdrawal" &&
      t.transaction_type !== "Transfer Debit"
  ).length
  const debitTransactions = totalTransactions - creditTransactions

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Shareholder Portal
              </h1>
              <p className="text-sm text-gray-600">
                {userRole === "shareholder"
                  ? `Welcome, ${shareholder.first_name} ${shareholder.last_name}`
                  : `Viewing: ${shareholder.first_name} ${shareholder.last_name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
              <User className="h-3 w-3 mr-1" />
              {userRole === "shareholder"
                ? "Shareholder"
                : userRole === "admin"
                ? "Admin View"
                : "Super Admin View"}
            </Badge>
            {onSignOut && (
              <Button onClick={onSignOut} variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Issuer Information */}
          {issuer && (
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="mr-2 h-5 w-5" />
                  {issuer.display_name || issuer.issuer_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {issuer.address && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Address</p>
                      <p className="text-gray-900">{issuer.address}</p>
                    </div>
                  )}
                  {issuer.telephone && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Phone</p>
                      <p className="text-gray-900">{issuer.telephone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard label="Current Shares" value={currentShares.toLocaleString()}  />
            <StatsCard label="Total Transactions" value={totalTransactions} icon={ArrowRightLeft} />
            <StatsCard label="Credit Transactions" value={creditTransactions} icon={TrendingUp} color="text-green-600" />
            <StatsCard label="Ownership %" value={`${shareholder.ownership_percentage || "0"}%`} icon={Activity} />
          </div>

          {/* Shareholder Profile */}
          <Card className="card-glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Shareholder Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ProfileItem label="Account Number" value={shareholder.account_number} />
                <ProfileItem label="Full Name" value={`${shareholder.first_name} ${shareholder.last_name || ""}`} />
                {shareholder.email && <ProfileItem label="Email" value={shareholder.email} />}
                {shareholder.phone && <ProfileItem label="Phone" value={shareholder.phone} />}
                {shareholder.address && <ProfileItem label="Address" value={`${shareholder.address}, ${shareholder.city || ""}, ${shareholder.state || ""} ${shareholder.zip || ""}`} />}
                {shareholder.holder_type && <ProfileItem label="Holder Type" value={shareholder.holder_type} />}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <Card className="card-glass border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ArrowRightLeft className="mr-2 h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.slice(0, 10).map((transaction, index) => (
                    <TransactionRow key={transaction.id || index} transaction={transaction} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

/* --- Small helper components to keep it clean --- */

function StatsCard({ label, value, icon: Icon, color = "text-gray-900" }) {
  return (
    <Card className="card-glass border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}

function ProfileItem({ label, value }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function TransactionRow({ transaction }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/30 rounded-lg">
      <div className="flex items-center space-x-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            transaction.transaction_type === "DWAC Withdrawal" ||
            transaction.transaction_type === "Transfer Debit"
              ? "bg-red-100 text-red-600"
              : "bg-green-100 text-green-600"
          }`}
        >
          <ArrowRightLeft className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{transaction.transaction_type}</p>
          <p className="text-sm text-gray-600">
            {new Date(transaction.transaction_date).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`font-bold text-lg ${
            transaction.transaction_type === "DWAC Withdrawal" ||
            transaction.transaction_type === "Transfer Debit"
              ? "text-red-600"
              : "text-green-600"
          }`}
        >
          {transaction.transaction_type === "DWAC Withdrawal" ||
          transaction.transaction_type === "Transfer Debit"
            ? "-"
            : "+"}
          {Number(transaction.share_quantity || 0).toLocaleString()}
        </p>
        <p className="text-sm text-gray-600">shares</p>
      </div>
    </div>
  )
}
