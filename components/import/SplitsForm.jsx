"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function SplitsForm({ splits = [], setSplits }) {
  const [localSplits, setLocalSplits] = useState(splits);

  // keep local state in sync with parent state
  useEffect(() => {
    setLocalSplits(splits);
  }, [splits]);

  const formatDecimal = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    return parseFloat(num.toFixed(1)); // one digit after decimal
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...localSplits];
    updated[index] = {
      ...updated[index],
      [field]:
        field === "class_a_ratio" || field === "rights_ratio"
          ? formatDecimal(value)
          : value,
    };
    setLocalSplits(updated);
    setSplits(updated);
  };

  const addSplit = () => {
    const updated = [
      ...localSplits,
      { transaction_type: "DWAC Withdrawal", class_a_ratio: 1.0, rights_ratio: 0.0 },
    ];
    setLocalSplits(updated);
    setSplits(updated);
  };

  const removeSplit = (index) => {
    const updated = localSplits.filter((_, i) => i !== index);
    setLocalSplits(updated);
    setSplits(updated);
  };

  return (
    <div className="space-y-4">
      {localSplits.map((split, i) => (
        <div
          key={i}
          className="border p-4 rounded-lg bg-white shadow-sm flex flex-col gap-3"
        >
          {/* Transaction Type */}
          <div className="flex gap-2 items-center">
            <label className="w-40 text-sm font-medium">Transaction Type</label>
            <input
              type="text"
              value={split.transaction_type || ""}
              onChange={(e) =>
                handleFieldChange(i, "transaction_type", e.target.value)
              }
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Class A Ratio */}
          <div className="flex gap-2 items-center">
            <label className="w-40 text-sm font-medium">Class A Ratio</label>
            <input
              type="number"
              step="0.1"
              value={split.class_a_ratio ?? ""}
              onChange={(e) =>
                handleFieldChange(i, "class_a_ratio", e.target.value)
              }
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Rights Ratio */}
          <div className="flex gap-2 items-center">
            <label className="w-40 text-sm font-medium">Rights Ratio</label>
            <input
              type="number"
              step="0.1"
              value={split.rights_ratio ?? ""}
              onChange={(e) =>
                handleFieldChange(i, "rights_ratio", e.target.value)
              }
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => removeSplit(i)}
              className="text-red-500"
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={addSplit}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
        >
          + Add Split
        </Button>
      </div>
    </div>
  );
}
