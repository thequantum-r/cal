'use client'

import { useDataFetchWithDelay } from '@/hooks/useDataFetchWithDelay'
import { DocumentsTableSkeleton } from '@/components/skeletons/TablesSkeleton'

export function DocumentsTable({ issuerId }) {
  return <DocumentsTableContent issuerId={issuerId} />
}

function DocumentsTableContent({ issuerId }) {
  // ⚡ Using SWR hook - skeleton shows during network latency
  const { data, isLoading, error } = useDataFetchWithDelay(
    issuerId ? `/api/issuers/${issuerId}/documents` : null
  )

  const docs = data?.documents
    ? (data.documents || []).sort((a, b) => new Date(b.filing_date) - new Date(a.filing_date))
    : []

  const formatDate = (dateString) => {
    if (!dateString) return "—"
    const date = new Date(dateString)
    if (isNaN(date)) return "Invalid Date"
    return date
      .toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
      .replaceAll("/", "-")
  }

  if (isLoading) return <DocumentsTableSkeleton />
  if (error) return <p className="text-red-500">{error.message || "Failed to load documents"}</p>

  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-orange-50 text-gray-700">
          <th className="px-3 py-2 text-left">Type</th>
          <th className="px-3 py-2 text-left">Title</th>
          <th className="px-3 py-2 text-left">Filed At</th>
          <th className="px-3 py-2 text-left">Link</th>
        </tr>
      </thead>
      <tbody>
        {docs.length > 0 ? (
          docs.map((doc) => (
            <tr key={doc.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{doc.type}</td>
              <td className="px-3 py-2">{doc.title}</td>
              <td className="px-3 py-2">{formatDate(doc.filing_date)}</td>
              <td className="px-3 py-2">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View PDF
                </a>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="text-center py-4 text-gray-500">
              No documents available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
