"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, subDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from "date-fns"

export default function CalendarTransferJournal({ records, shareholders, userRole, issuerId, currentIssuer }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentDate, setCurrentDate] = useState(new Date())

  // Get records for selected date
  const getRecordsForDate = (date) => {
    return records.filter(record => {
      const recordDate = new Date(record.transaction_date || record.created_at)
      return isSameDay(recordDate, date)
    })
  }

  // Group records by security type/CUSIP
  const getRecordsBySecurityType = (dateRecords) => {
    const grouped = {}
    
    dateRecords.forEach(record => {
      const cusip = record.cusip || 'N/A'
      const securityType = record.security_type || 'Unknown'
      const issueName = record.issue_name || `${currentIssuer?.issuer_name || 'Unknown Issuer'} ${securityType}`
      
      const key = `${cusip}-${securityType}`
      
      if (!grouped[key]) {
        grouped[key] = {
          cusip,
          securityType,
          issueName,
          records: []
        }
      }
      
      grouped[key].records.push(record)
    })
    
    return Object.values(grouped)
  }

  // Calendar navigation
  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      setCurrentDate(prev => subMonths(prev, 1))
    } else {
      setCurrentDate(prev => addMonths(prev, 1))
    }
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    
    const days = []
    let day = calendarStart
    
    while (day <= calendarEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    
    return days
  }

  // Get shareholder name
  const getShareholderName = (shareholderId) => {
    const shareholder = shareholders.find(s => s.id === shareholderId)
    return shareholder ? `${shareholder.first_name || ''} ${shareholder.last_name || ''}`.trim() : "Unknown"
  }

  // Get shareholder account
  const getShareholderAccount = (shareholderId) => {
    const shareholder = shareholders.find(s => s.id === shareholderId)
    return shareholder?.account_number || "N/A"
  }

  const selectedDateRecords = getRecordsForDate(selectedDate)
  const groupedRecords = getRecordsBySecurityType(selectedDateRecords)
  const calendarDays = generateCalendarDays()

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card className="card-glass border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="h-6 w-6 text-orange-600" />
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Transfer Journal - Calendar View
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Select a date to view transfers organized by security type
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="border-gray-300 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="border-gray-300 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Calendar Grid */}
          <div className="space-y-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const dayRecords = getRecordsForDate(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isSelected = isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)
                const hasRecords = dayRecords.length > 0
                
                return (
                  <button
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      p-2 min-h-[60px] text-sm border rounded-lg transition-all duration-200
                      flex flex-col items-center justify-center space-y-1
                      ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : 'text-gray-900'}
                      ${isSelected ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-500' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}
                      ${isTodayDate && !isSelected ? 'border-orange-400 bg-orange-50' : ''}
                    `}
                  >
                    <span className="font-medium">{format(day, 'd')}</span>
                    {hasRecords && (
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Records */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Transfers for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <Badge variant="outline" className="border-orange-300 text-orange-700">
            {selectedDateRecords.length} record{selectedDateRecords.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {selectedDateRecords.length === 0 ? (
          <Card className="card-glass border-0">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No transfers found</h4>
              <p className="text-gray-500 text-center">
                There are no transfer journal records for {format(selectedDate, 'MMMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedRecords.map((group, index) => (
              <Card key={index} className="card-glass border-0">
                {/* Transfer Journal Header */}
                <div className="bg-white border-b px-6 py-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">EFFICIENCY INC TRANSFER JOURNAL</h3>
                    <div className="grid grid-cols-2 gap-8 text-sm">
                      <div className="text-left">
                        <p><span className="font-semibold">ISSUER:</span> {currentIssuer?.issuer_name?.toUpperCase() || 'UNKNOWN ISSUER'}</p>
                        <p><span className="font-semibold">Date:</span> {format(selectedDate, 'M/d/yy')}</p>
                      </div>
                      <div className="text-right">
                        <p><span className="font-semibold">SECURITY TYPE:</span> {group.securityType.toUpperCase()}</p>
                        <p><span className="font-semibold">CUSIP:</span> {group.cusip}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <CardContent className="p-0">
                  {/* Table Header */}
                  <div className="bg-gray-50 border-b">
                    <div className="grid grid-cols-9 gap-1 px-4 py-2 text-xs font-semibold text-gray-700">
                      <div className="text-center">ACCOUNT #</div>
                      <div className="text-center">REGISTRATION</div>
                      <div className="text-center">CERTIFICATE #</div>
                      <div className="text-center">TICKET #</div>
                      <div className="text-center">DATE</div>
                      <div className="text-center">DEBIT</div>
                      <div className="text-center">SHARES</div>
                      <div className="text-center">CREDIT</div>
                      <div className="text-center">SHARES</div>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y">
                    {group.records.map((record, recordIndex) => {
                      const isCredit = record.credit_debit === 'Credit'
                      const isDebit = record.credit_debit === 'Debit'
                      
                      return (
                        <div key={record.id} className="grid grid-cols-9 gap-1 px-4 py-3 text-sm hover:bg-gray-50">
                          <div className="text-center font-medium">
                            {getShareholderAccount(record.shareholder_id)}
                          </div>
                          <div className="text-center">
                            {getShareholderName(record.shareholder_id)}
                          </div>
                          <div className="text-center">Book Entry</div>
                          <div className="text-center">N/A</div>
                          <div className="text-center">
                            {format(selectedDate, 'M/d/yy')}
                          </div>
                          <div className="text-center text-red-600 font-medium">
                            {isDebit ? record.transaction_type : ''}
                          </div>
                          <div className="text-center text-red-600 font-bold">
                            {isDebit ? record.share_quantity?.toLocaleString() : ''}
                          </div>
                          <div className="text-center text-green-600 font-medium">
                            {isCredit ? record.transaction_type : ''}
                          </div>
                          <div className="text-center text-green-600 font-bold">
                            {isCredit ? record.share_quantity?.toLocaleString() : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Totals Row */}
                  <div className="border-t-2 bg-gray-50">
                    <div className="grid grid-cols-9 gap-1 px-4 py-3">
                      <div className="col-span-5 text-right font-bold text-gray-900">
                        TOTAL {group.securityType && group.securityType !== 'Unknown' ? group.securityType.toUpperCase() : 'SHARES'}
                      </div>
                      <div className="text-center font-bold text-red-600">
                        {(() => {
                          const debitTotal = group.records
                            .filter(r => r.credit_debit === 'Debit')
                            .reduce((sum, r) => sum + (r.share_quantity || 0), 0)
                          return debitTotal > 0 ? debitTotal.toLocaleString() : ''
                        })()}
                      </div>
                      <div></div>
                      <div className="text-center font-bold text-green-600">
                        {(() => {
                          const creditTotal = group.records
                            .filter(r => r.credit_debit === 'Credit')
                            .reduce((sum, r) => sum + (r.share_quantity || 0), 0)
                          return creditTotal > 0 ? creditTotal.toLocaleString() : ''
                        })()}
                      </div>
                      <div></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}