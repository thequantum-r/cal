"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search, Edit3, Save, X, Calculator, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SplitRatioManager({ onClose }) {
  const [issuers, setIssuers] = useState([]);
  const [selectedIssuer, setSelectedIssuer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [ratios, setRatios] = useState({
    class_a_ratio: "",
    rights_ratio: ""
  });
  const [inputErrors, setInputErrors] = useState({
    class_a_ratio: "",
    rights_ratio: ""
  });

  // Fetch issuers from issuers_new table
  useEffect(() => {
    fetchIssuers();
  }, []);

  const fetchIssuers = async () => {
    try {
      setInitialLoading(true);
      const response = await fetch("/api/issuers");
      if (!response.ok) {
        throw new Error("Failed to fetch issuers");
      }
      const data = await response.json();
      setIssuers(data);
    } catch (error) {
      console.error("Error fetching issuers:", error);
      showNotification("error", "Failed to load issuers. Please refresh the page.");
    } finally {
      setInitialLoading(false);
    }
  };

  // Show notification helper
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Filter issuers based on search term
  const filteredIssuers = issuers.filter(issuer =>
    issuer.issuer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    issuer.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle issuer selection
  const handleIssuerSelect = (issuer) => {
    setSelectedIssuer(issuer);
    setInputErrors({ class_a_ratio: "", rights_ratio: "" });
    parseExistingRatios(issuer.separation_ratio);
  };

  // Parse existing ratio text to extract numbers - FIXED NaN issue
  const parseExistingRatios = (ratioText) => {
    if (!ratioText || typeof ratioText !== 'string') {
      setRatios({ class_a_ratio: "1", rights_ratio: "0.5" });
      return;
    }

    try {
      // Extract numbers from text like "1 UNIT = 1 CLASS A SHARE AND 1/2 REDEEMABLE WARRANT"
      const classAMatch = ratioText.match(/(\d+(?:\.\d+)?)\s+CLASS\s+A/i);
      
      // Handle both fraction and decimal formats for warrants
      const fractionMatch = ratioText.match(/(\d+)\/(\d+)\s+(REDEEMABLE\s+)?WARRANT/i);
      const decimalMatch = ratioText.match(/(\d+(?:\.\d+)?)\s+(REDEEMABLE\s+)?WARRANT/i);

      let classAValue = "1";
      let rightsValue = "0.5";

      if (classAMatch && classAMatch[1]) {
        const parsed = parseFloat(classAMatch[1]);
        if (!isNaN(parsed) && parsed > 0) {
          classAValue = parsed.toString();
        }
      }

      if (fractionMatch && fractionMatch[1] && fractionMatch[2]) {
        const numerator = parseFloat(fractionMatch[1]);
        const denominator = parseFloat(fractionMatch[2]);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          rightsValue = (numerator / denominator).toString();
        }
      } else if (decimalMatch && decimalMatch[1]) {
        const parsed = parseFloat(decimalMatch[1]);
        if (!isNaN(parsed) && parsed > 0) {
          rightsValue = parsed.toString();
        }
      }

      setRatios({
        class_a_ratio: classAValue,
        rights_ratio: rightsValue
      });
    } catch (error) {
      console.error("Error parsing ratios:", error);
      setRatios({ class_a_ratio: "1", rights_ratio: "0.5" });
    }
  };

  // Validate input
  const validateInput = (value) => {
    if (!value || value.trim() === "") {
      return "This field is required";
    }

    // Handle fraction input
    if (value.includes('/')) {
      const [numerator, denominator] = value.split('/').map(v => v.trim());
      const num = parseFloat(numerator);
      const den = parseFloat(denominator);
      
      if (isNaN(num) || isNaN(den)) {
        return "Invalid fraction format";
      }
      if (den === 0) {
        return "Denominator cannot be zero";
      }
      if (num <= 0 || den <= 0) {
        return "Values must be positive";
      }
      return "";
    }

    // Handle decimal input
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      return "Please enter a valid number";
    }
    if (parsed <= 0) {
      return "Value must be greater than 0";
    }
    if (parsed > 1000) {
      return "Value seems too large";
    }
    return "";
  };

  // Convert fraction input to decimal - FIXED
  const parseFraction = (input) => {
    if (!input || typeof input !== 'string') return "";
    
    const trimmed = input.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 2) {
        const numerator = parseFloat(parts[0].trim());
        const denominator = parseFloat(parts[1].trim());
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return (numerator / denominator).toString();
        }
      }
      return "";
    }
    
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? "" : parsed.toString();
  };

  // Format ratio for display in issuers_new table - FIXED
  const formatRatioText = (classA, rights) => {
    const classANum = parseFloat(classA);
    const rightsNum = parseFloat(rights);
    
    if (isNaN(classANum) || isNaN(rightsNum)) {
      return "Invalid ratio values";
    }

    // Format rights as fraction if it's less than 1
    let rightsFormatted;
    if (rightsNum < 1 && rightsNum > 0) {
      // Convert to simple fraction
      const denominator = Math.round(1 / rightsNum);
      rightsFormatted = `1/${denominator}`;
    } else {
      rightsFormatted = rightsNum.toString();
    }
    
    return `1 UNIT = ${classANum} CLASS A SHARE AND ${rightsFormatted} REDEEMABLE WARRANT`;
  };

  // Handle ratio input changes with validation
  const handleRatioChange = (field, value) => {
    const error = validateInput(value);
    setInputErrors(prev => ({
      ...prev,
      [field]: error
    }));

    setRatios(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save updated ratios
  const saveRatios = async () => {
    if (!selectedIssuer) return;
    
    // Final validation
    const classAError = validateInput(ratios.class_a_ratio);
    const rightsError = validateInput(ratios.rights_ratio);
    
    if (classAError || rightsError) {
      setInputErrors({
        class_a_ratio: classAError,
        rights_ratio: rightsError
      });
      showNotification("error", "Please fix the errors before saving");
      return;
    }

    const classADecimal = parseFraction(ratios.class_a_ratio);
    const rightsDecimal = parseFraction(ratios.rights_ratio);

    if (!classADecimal || !rightsDecimal || isNaN(parseFloat(classADecimal)) || isNaN(parseFloat(rightsDecimal))) {
      showNotification("error", "Invalid ratio values");
      return;
    }
    
    setLoading(true);
    try {
      const formattedText = formatRatioText(classADecimal, rightsDecimal);
      
      // Update issuers_new table
      const issuerResponse = await fetch(`/api/issuers/${selectedIssuer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          separation_ratio: formattedText
        })
      });

      if (!issuerResponse.ok) {
        const errorData = await issuerResponse.json();
        throw new Error(errorData.error || "Failed to update issuer");
      }

      // Create/Update split_events entry
      const splitResponse = await fetch("/api/splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer_id: selectedIssuer.id,
          transaction_type: "DWAC Withdrawal",  // Match the transaction type used in processing
          class_a_ratio: parseFloat(classADecimal),
          rights_ratio: parseFloat(rightsDecimal)
        })
      });

      if (!splitResponse.ok) {
        const errorData = await splitResponse.json();
        throw new Error(errorData.error || "Failed to update split events");
      }

      showNotification("success", "Split ratios updated successfully!");
      setSelectedIssuer(null);
      setRatios({ class_a_ratio: "", rights_ratio: "" });
      fetchIssuers();
      
    } catch (error) {
      console.error("Error saving ratios:", error);
      showNotification("error", `Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Notification */}
      {notification && (
        <div className="mb-4">
          <Alert variant={notification.type === "error" ? "destructive" : "default"} 
                 className={notification.type === "success" ? "bg-green-50 border-green-200" : ""}>
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className={notification.type === "success" ? "text-green-800" : ""}>
              {notification.message}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Issuer Selection Panel */}
        <div className="w-1/2 border-r pr-4 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold text-lg mb-2">Select Issuer</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
            {filteredIssuers.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {filteredIssuers.length} issuer{filteredIssuers.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>

          {initialLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filteredIssuers.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-gray-400">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No issuers found</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1 pr-2">
              {filteredIssuers.map((issuer) => (
                <div
                  key={issuer.id}
                  onClick={() => handleIssuerSelect(issuer)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedIssuer?.id === issuer.id
                      ? "bg-orange-50 border-orange-300 shadow-sm"
                      : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{issuer.issuer_name || issuer.display_name}</div>
                  {issuer.separation_ratio && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {issuer.separation_ratio}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ratio Editor Panel */}
        <div className="w-1/2 pl-4 flex flex-col">
          {selectedIssuer ? (
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-2">Adjust Split Ratios</h3>
                <div className="text-sm text-gray-700 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                  <strong>{selectedIssuer.issuer_name || selectedIssuer.display_name}</strong>
                </div>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                {/* Class A Ratio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class A Share Ratio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ratios.class_a_ratio}
                    onChange={(e) => handleRatioChange("class_a_ratio", e.target.value)}
                    placeholder="e.g., 1"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 transition-all ${
                      inputErrors.class_a_ratio ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {inputErrors.class_a_ratio ? (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {inputErrors.class_a_ratio}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Number of Class A shares per unit
                    </p>
                  )}
                </div>

                {/* Rights/Warrant Ratio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rights/Warrant Ratio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ratios.rights_ratio}
                    onChange={(e) => handleRatioChange("rights_ratio", e.target.value)}
                    placeholder="e.g., 0.5 or 1/2"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 transition-all ${
                      inputErrors.rights_ratio ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {inputErrors.rights_ratio ? (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {inputErrors.rights_ratio}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Accepts decimals (0.5) or fractions (1/2)
                    </p>
                  )}
                </div>

                {/* Preview */}
                {ratios.class_a_ratio && ratios.rights_ratio && !inputErrors.class_a_ratio && !inputErrors.rights_ratio && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calculator className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Preview</span>
                    </div>
                    <div className="text-sm text-blue-700 font-mono">
                      {(() => {
                        const classADecimal = parseFraction(ratios.class_a_ratio);
                        const rightsDecimal = parseFraction(ratios.rights_ratio);
                        return formatRatioText(classADecimal, rightsDecimal);
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIssuer(null);
                    setInputErrors({ class_a_ratio: "", rights_ratio: "" });
                  }}
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={saveRatios}
                  disabled={loading || !ratios.class_a_ratio || !ratios.rights_ratio || 
                           inputErrors.class_a_ratio || inputErrors.rights_ratio}
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Ratios
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Edit3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No Issuer Selected</p>
                <p className="text-sm text-gray-400">Select an issuer from the list to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}