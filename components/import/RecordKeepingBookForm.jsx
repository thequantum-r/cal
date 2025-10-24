"use client";

export default function RecordkeepingBookForm({ records = [], setRecords }) {
  const handleChange = (index, field, value) => {
    const updated = [...records];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setRecords(updated);
  };

  const addRecord = () => {
    setRecords([
      ...records,
      {
        issue_name: "",
        issue_ticker: "",
        trading_platform: "",
        cusip: "",
        security_type: "",
        issuance_type: "",
      },
    ]);
  };

  const removeRecord = (index) => {
    setRecords(records.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {records.map((rec, i) => (
        <div
          key={i}
          className="border p-4 rounded-lg bg-white shadow-sm flex flex-col gap-3"
        >
          {/* Issue Name */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              Issue Name
            </label>
            <input
              type="text"
              value={rec.issue_name || ""}
              onChange={(e) => handleChange(i, "issue_name", e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Enter Issue Name"
            />
          </div>

          {/* Issue Ticker */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              Issue Ticker
            </label>
            <input
              type="text"
              value={rec.issue_ticker || ""}
              onChange={(e) => handleChange(i, "issue_ticker", e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Ticker"
            />
          </div>

          {/* Trading Platform */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              Trading Platform
            </label>
            <input
              type="text"
              value={rec.trading_platform || ""}
              onChange={(e) =>
                handleChange(i, "trading_platform", e.target.value)
              }
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. NASDAQ"
            />
          </div>

          {/* CUSIP */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              CUSIP
            </label>
            <input
              type="text"
              value={rec.cusip || ""}
              onChange={(e) => handleChange(i, "cusip", e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="CUSIP"
            />
          </div>

          {/* Security Type */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              Security Type
            </label>
            <input
              type="text"
              value={rec.security_type || ""}
              onChange={(e) =>
                handleChange(i, "security_type", e.target.value)
              }
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Common, Warrants, Rights..."
            />
          </div>

          {/* Issuance Type */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-800 mb-1">
              Issuance Type
            </label>
            <input
              type="text"
              value={rec.issuance_type || ""}
              onChange={(e) =>
                handleChange(i, "issuance_type", e.target.value)
              }
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="IPO, DWAC, Transfer..."
            />
          </div>

          {/* Remove button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => removeRecord(i)}
              className="text-red-500 text-sm font-medium hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {/* Add new record */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addRecord}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          + Add Record
        </button>
      </div>
    </div>
  );
}
