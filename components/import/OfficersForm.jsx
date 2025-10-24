"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function OfficersForm({ officers = [], setOfficers }) {
  const [localOfficers, setLocalOfficers] = useState(officers);

  useEffect(() => {
    setLocalOfficers(officers);
  }, [officers]);

  const handleFieldChange = (index, field, value) => {
    const updated = [...localOfficers];
    updated[index] = { ...updated[index], [field]: value };
    setLocalOfficers(updated);
    setOfficers(updated);
  };

  const addOfficer = () => {
    const updated = [
      ...localOfficers,
      { officer_name: "", officer_position: "" },
    ];
    setLocalOfficers(updated);
    setOfficers(updated);
  };

  const removeOfficer = (index) => {
    const updated = localOfficers.filter((_, i) => i !== index);
    setLocalOfficers(updated);
    setOfficers(updated);
  };

  return (
    <div className="space-y-4">
      {localOfficers.map((o, i) => (
        <div
          key={i}
          className="border p-4 rounded-lg bg-white shadow-sm flex flex-col gap-3"
        >
          <input
            type="text"
            placeholder="Officer Name"
            value={o.officer_name || ""}
            onChange={(e) =>
              handleFieldChange(i, "officer_name", e.target.value)
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Position"
            value={o.officer_position || ""}
            onChange={(e) =>
              handleFieldChange(i, "officer_position", e.target.value)
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => removeOfficer(i)}
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
          onClick={addOfficer}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
        >
          + Add Officer
        </Button>
      </div>
    </div>
  );
}
