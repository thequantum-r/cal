"use client";

export default function RecordkeepingTransactionsForm({ transactions, setTransactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-gray-500">
        No transactions found in the uploaded file.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Issue Name</th>
            <th className="border px-2 py-1">CUSIP</th>
            <th className="border px-2 py-1">Transaction Type</th>
            <th className="border px-2 py-1">Credit/Debit</th>
            <th className="border px-2 py-1">Date</th>
            <th className="border px-2 py-1">Quantity</th>
            <th className="border px-2 py-1">Certificate Type</th>
            <th className="border px-2 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {transactions.slice(0, 20).map((t, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1">{t.issue_name || "-"}</td>
              <td className="border px-2 py-1">{t.cusip || "-"}</td>
              <td className="border px-2 py-1">{t.transaction_type || "-"}</td>
              <td className="border px-2 py-1">{t.credit_debit || "-"}</td>
              <td className="border px-2 py-1">{t.transaction_date || "-"}</td>
              <td className="border px-2 py-1">{t.share_quantity ?? "-"}</td>
              <td className="border px-2 py-1">{t.certificate_type || "-"}</td>
              <td className="border px-2 py-1">{t.notes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {transactions.length > 20 && (
        <p className="text-xs text-gray-400 mt-2">
          Showing first 20 of {transactions.length} rows...
        </p>
      )}
    </div>
  );
}
