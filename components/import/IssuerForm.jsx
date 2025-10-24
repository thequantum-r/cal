"use client";

export default function IssuerForm({ issuer, setIssuer }) {
  const fields = [
    { key: "issuer_name", label: "Issuer Name" },
    { key: "display_name", label: "Display Name" },
    { key: "address", label: "Address" },
    { key: "telephone", label: "Telephone" },
    { key: "tax_id", label: "Tax ID" },
    { key: "incorporation", label: "Incorporation" },
    { key: "underwriter", label: "Underwriter" },
    { key: "share_info", label: "Share Information" },
    { key: "notes", label: "Notes" },
    { key: "forms_sl_status", label: "Forms SL Status" },
    { key: "timeframe_for_separation", label: "Timeframe for Separation" },
    { key: "separation_ratio", label: "Separation Ratio" },
    { key: "exchange_platform", label: "Exchange Platform" },
    { key: "timeframe_for_bc", label: "Timeframe for BC" },
    { key: "us_counsel", label: "US Counsel" },
    { key: "offshore_counsel", label: "Offshore Counsel" },
  ];

  const handleChange = (field, value) => {
    setIssuer({
      ...issuer,
      [field]: value,
    });
  };

  return (
    <div className="space-y-3">
      {fields.map(({ key, label }) => (
        <div key={key} className="flex flex-col">
          <label className="text-sm font-semibold text-gray-800 mb-1">
            {label}
          </label>
          {key === "notes" || key === "share_info" ? (
            <textarea
              value={issuer?.[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm resize-vertical"
              placeholder={`Enter ${label}...`}
            />
          ) : (
            <input
              type="text"
              value={issuer?.[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder={`Enter ${label}...`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
