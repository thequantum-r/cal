"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, FileText } from "lucide-react"
import TransferJournalTable from "./transfer-journal-table"
import CalendarTransferJournal from "./calendar-transfer-journal"

export default function TransferJournalView({ records, shareholders, userRole, issuerId, currentIssuer }) {
  const [viewMode, setViewMode] = useState("calendar")

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Transfer Journal</h2>
        <div className="flex items-center space-x-4">
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            className={viewMode === "calendar" ? 
              "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white" :
              "border-gray-300 hover:bg-gray-50"
            }
            onClick={() => setViewMode("calendar")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Calendar View
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            className={viewMode === "table" ? 
              "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white" :
              "border-gray-300 hover:bg-gray-50"
            }
            onClick={() => setViewMode("table")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Table View
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === "calendar" ? (
        <CalendarTransferJournal 
          records={records} 
          shareholders={shareholders} 
          userRole={userRole} 
          issuerId={issuerId}
          currentIssuer={currentIssuer}
        />
      ) : (
        <div className="card-glass border-0 rounded-xl">
          <div className="p-6">
            <TransferJournalTable 
              records={records} 
              shareholders={shareholders} 
              userRole={userRole} 
              issuerId={issuerId}
            />
          </div>
        </div>
      )}
    </div>
  )
}