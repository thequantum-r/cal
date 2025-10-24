// File: app/(whatever)/components/import/ImportForm.jsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

// Modular entity forms (assumes these files exist)
import IssuerForm from "@/components/import/IssuerForm";
import SplitsForm from "@/components/import/SplitsForm";
import SecuritiesForm from "@/components/import/SecuritiesForm";
import OfficersForm from "@/components/import/OfficersForm";
import ShareholdersForm from "@/components/import/ShareholdersForm";
import RecordKeepingBookForm from "@/components/import/RecordKeepingBookForm";
import RecordkeepingTransactionsForm from "@/components/import/RecordkeepingTransactionForm";


export default function ImportForm({ onClose }) {
  const [formData, setFormData] = useState(null);
  const [shareholderMap, setShareholderMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [activeTab, setActiveTab] = useState("issuer");
  const [saveProgress, setSaveProgress] = useState(null); // null, 'saving', 'complete', 'error'
  const [saveResults, setSaveResults] = useState(null);

  // --- Helpers -------------------------------------------------------------
  const evalFraction = (str) => {
    if (!str && str !== 0) return 0;
    if (typeof str !== "string" && typeof str !== "number") return 0;
    const s = String(str).trim();
    if (s.includes("/")) {
      const [num, den] = s.split("/").map((x) => Number(x));
      if (!isFinite(num) || !isFinite(den) || den === 0) return 0;
      return Number((num / den).toFixed(1));
    }
    const n = Number(s);
    if (isNaN(n)) return 0;
    return Number(n.toFixed(1));
  };

  // find header index by matching keywords (loose)
  const findHeaderIndex = (headers, keywords) => {
    if (!headers || !headers.length) return -1;
    const normalized = headers.map((h) =>
      (h || "").toString().toLowerCase().trim()
    );
    for (const key of keywords) {
      const idx = normalized.findIndex((h) => h.includes(key));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Convert Excel serial date to JS Date
  const excelDateToJSDate = (serial) => {
  if (serial == null || serial === "") return null;
  if (serial instanceof Date) return serial;

  let n = Number(serial);
  if (isNaN(n)) return null;

  try {
    const utc_days = Math.floor(n - 25569);
    const utc_value = utc_days * 86400; // seconds
    const fractional_day = n - Math.floor(n);
    const total_seconds = Math.round(fractional_day * 86400);
    const d = new Date((utc_value + total_seconds) * 1000);

   const year = d.getUTCFullYear();
   if (year < 1900 || year > new Date().getFullYear() + 5) {
     return null; // 🚫 invalid Excel date
   }

    return d;
  } catch (err) {
    return null;
  }
};

  // --- File upload & parsing (multi-sheet) --------------------------------
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        console.info("Workbook sheets:", workbook.SheetNames);

        const extracted = {
          issuer: {},
          splits: [],
          securities: [],
          officers: [],
          shareholders: [],
          recordkeeping: [],
          transactions: [],
        };

        // iterate sheets
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // defval: '' ensures empty cells become "" instead of undefined
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          if (!rows || !rows.length) return;

          console.debug(`Parsing sheet: "${sheetName}" (rows: ${rows.length})`);

          // Normalize sheetName for detection
          const sName = String(sheetName).toLowerCase();

if (/issuer|company|spac/i.test(sName)) {
  const fieldMap = {
    "spac name": "issuer_name",
    "issuer name": "issuer_name",
    "company name": "issuer_name",

    "address": "address",
    "headquarters": "address",

    "telephone": "telephone",
    "phone": "telephone",
    "contact": "telephone",

    "tax id": "tax_id",
    "ein": "tax_id",

    "incorporation": "incorporation",
    "place of incorporation": "incorporation",
    "jurisdiction": "incorporation",

    "underwriter": "underwriter",
    "lead underwriter": "underwriter",

    "share information": "share_info",
    "share info": "share_info",
    "authorized shares": "share_info", // map into share_info text

    "security types being issued": "share_info", // combine into share_info as well

    "notes": "notes",
    "remarks": "notes",

    "forms sl status": "forms_sl_status",
    "form sl status": "forms_sl_status",
    "form s-1": "forms_sl_status", // map S-1 status into forms_sl_status

    "timeframe for separation": "timeframe_for_separation",
    "separation ratio": "separation_ratio",

    "exchange": "exchange_platform",
    "exchange platform": "exchange_platform",
    "trading platform": "exchange_platform",
    "listing exchange": "exchange_platform",

    "timeframe for bc": "timeframe_for_bc",
    "business combination timeframe": "timeframe_for_bc",

    "us counsel": "us_counsel",
    "u.s. counsel": "us_counsel",

    "offshore counsel": "offshore_counsel",

    "description": "description",
    "summary": "description",

    "class a ipo issuance": "share_info",
    "class b ipo issuance": "share_info",
    "warrant ipo issuance": "share_info",
    "redemptions": "notes",
  };

  rows.forEach(([key, value]) => {
    if (!key || (value === undefined || value === null)) return;

    const normKey = String(key).replace(/[:]/g, "").trim().toLowerCase();
    const mappedField = fieldMap[normKey];
    if (mappedField) {
      extracted.issuer[mappedField] = value;
      if (mappedField === "issuer_name") {
        extracted.issuer.display_name = value;
      }
    }
  });
}


          // --- Securities-ish sheet detection ---
          if (/security|cusip|cusip details|securities/i.test(sName)) {
            const headers = rows[0] || [];
            const idxIssueName = findHeaderIndex(headers, ["issue name", "issue"]);
            const idxTicker = findHeaderIndex(headers, ["ticker", "issue ticker"]);
            const idxPlatform = findHeaderIndex(headers, ["platform", "trading platform"]);
            const idxCusip = findHeaderIndex(headers, ["cusip"]);
            const idxType = findHeaderIndex(headers, ["security type", "class"]);
            rows.slice(1).forEach((row) => {
              if (!row || row.length === 0) return;
              const cusip = (row[idxCusip] || "").toString().trim();
              if (!cusip) return;
              extracted.securities.push({
                class_name: row[idxType] || "Unknown",
                cusip,
                issue_name: row[idxIssueName] || (row[0] || ""),
                issue_ticker: row[idxTicker] || "",
                trading_platform: row[idxPlatform] || "",
                _raw: row,
              });
            });
          }

          // --- Officers sheet detection ---
          if (/officer|director|management/i.test(sName)) {
            const headers = rows[0] || [];
            const idxName = findHeaderIndex(headers, ["name", "officer", "director"]);
            const idxPos = findHeaderIndex(headers, ["position", "title", "role"]);
            rows.slice(1).forEach((row) => {
              if (!row || row.length === 0) return;
              const name = row[idxName] || row[0];
              if (!name) return;
              extracted.officers.push({
                officer_name: name,
                officer_position: row[idxPos] || "Unknown",
                _raw: row,
              });
            });
          }

          // --- Shareholders sheet detection ---
          if (/shareholder|shareholders|holder/i.test(sName)) {
            const headers = rows[0] || [];


            const idxAccount = findHeaderIndex(headers, ["account", "account number"]);
            const idxFirst = findHeaderIndex(headers, ["first name", "first"]);
            const idxLast = findHeaderIndex(headers, ["last name", "last"]);
            rows.slice(1).forEach((row) => {
              if (!row || row.length === 0) return;
              const acct = row[idxAccount] || row[0] || "";
              if (!acct) return;
              extracted.shareholders.push({
                account_number: acct,
                first_name: row[idxFirst] || "",
                last_name: row[idxLast] || "",
                _raw: row,
              });
            });
          }

         if (/^record\b|record keeping|record-keeping|recordkeeping/i.test(sName)) {
  const headers = (rows[0] || []).map((h) => (h || "").toString().trim().toLowerCase());

  // indexes for securities mapping
  const idxIssueName = findHeaderIndex(headers, ["issue name", "issue"]);
  const idxTicker = findHeaderIndex(headers, ["ticker", "issue ticker"]);
  const idxPlatform = findHeaderIndex(headers, ["trading platform", "platform", "exchange"]);
  const idxCusip = findHeaderIndex(headers, ["cusip", "issue cusip"]);
  const idxSecurityType = findHeaderIndex(headers, ["security type", "class"]);
  const idxTotalAuth = findHeaderIndex(headers, ["total securities issued", "authorized shares"]);

  rows.slice(1).forEach((row, i) => {
    if (!row || row.length === 0) return;

    const rec = {
      issue_name: (idxIssueName >= 0 ? row[idxIssueName] : "") || "",
      issue_ticker: (idxTicker >= 0 ? row[idxTicker] : "") || "",
      trading_platform: (idxPlatform >= 0 ? row[idxPlatform] : "") || "",
      cusip: (idxCusip >= 0 ? row[idxCusip] : "") || "",
      security_type: (idxSecurityType >= 0 ? row[idxSecurityType] : "") || "",
      total_authorized_shares: (idxTotalAuth >= 0 ? parseInt(String(row[idxTotalAuth]).replace(/[, ]/g, "")) : null),
      _raw: row,
    };

    // keep record for debugging
    if (rec.cusip) {
      extracted.recordkeeping.push(rec);
    }

    // pick only IPO Credit row (first positive issuance)
    // pick unique securities based on CUSIP (works for RAAC too)
if (rec.cusip && !extracted.securities.find(s => s.cusip === rec.cusip)) {
  extracted.securities.push({
    class_name: rec.security_type || "Unknown",
    cusip: rec.cusip,
    issue_name: rec.issue_name,
    issue_ticker: rec.issue_ticker,
    trading_platform: rec.trading_platform,
    total_authorized_shares: rec.total_authorized_shares || null,
    status: "ACTIVE",
    _raw: row,
  });
}

  });
}

   // --- Recordkeeping Transactions (force target 2nd sheet) ---
if (workbook.SheetNames.indexOf(sheetName) === 1) {
  console.info("📑 Extracting transactions from 2nd sheet:", sheetName);

  const headers = (rows[0] || []).map((h) => (h || "").toString().trim());
  const headersLower = headers.map((h) => (h || "").toLowerCase());

  // index mapping
  const idxIssueName = findHeaderIndex(headersLower, ["issue name", "issue"]);
  const idxTicker = findHeaderIndex(headersLower, ["ticker", "issue ticker"]);
  const idxPlatform = findHeaderIndex(headersLower, ["platform", "trading platform"]);
  const idxCusip = findHeaderIndex(headersLower, ["cusip", "issue cusip"]);
  const idxSecurityType = findHeaderIndex(headersLower, ["security type", "class"]);
  const idxIssuanceType = findHeaderIndex(headersLower, ["issuance type", "issuance", "type of issuance"]);
  const idxAccount = findHeaderIndex(headersLower, ["account", "holder", "shareholder"]);
  const idxTxType = findHeaderIndex(headersLower, [
    "transaction type",
    "activity",
    "txn type",
    "type of issuance",
    "type of transaction",
  ]);
  const idxCreditDebit = findHeaderIndex(headersLower, ["credit/debit", "credit", "debit"]);
  const idxCreditDate = findHeaderIndex(headersLower, ["credit date"]);
  const idxDebitDate = findHeaderIndex(headersLower, ["debit date"]);
  const idxTxDate = findHeaderIndex(headersLower, ["transaction date", "date"]);
  const idxQty = findHeaderIndex(headersLower, [
    "quantity",
    "qty",
    "shares",
    "total securities processed",
    "total securities issued",
  ]);
  const idxCert = findHeaderIndex(headersLower, ["certificate", "cert"]);
  const idxStatus = findHeaderIndex(headersLower, ["status"]);
  const idxNotes = findHeaderIndex(headersLower, ["notes", "memo", "remarks"]);

  let lastContext = {};

  // Helper to format date as MM/DD/YYYY
  function formatDateForDB(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d)) return null;
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // Helper: check if a field is valid (not NA, N/A, -, empty)
  const validField = (val) => {
    if (!val) return false;
    const s = String(val).trim().toUpperCase();
    return !(s === "" || s === "NA" || s === "N/A" || s === "-");
  };

  rows.slice(1).forEach((row) => {
    if (!row || row.length === 0 || row.every((c) => c === "")) return;

    const issueName = validField(row[idxIssueName]) ? row[idxIssueName] : lastContext.issue_name || "";
    const ticker = validField(row[idxTicker]) ? row[idxTicker] : lastContext.issue_ticker || "";
    const platform = validField(row[idxPlatform]) ? row[idxPlatform] : lastContext.trading_platform || "";
    const cusip = validField(row[idxCusip]) ? String(row[idxCusip]).trim() : lastContext.cusip || "";
    const securityType = validField(row[idxSecurityType]) ? row[idxSecurityType] : lastContext.security_type || "";
    const issuanceType = validField(row[idxIssuanceType]) ? row[idxIssuanceType] : lastContext.issuance_type || "";

    const shareholderAccount = idxAccount >= 0 ? row[idxAccount] : "";
    const txnType = idxTxType >= 0 ? row[idxTxType] : "";
    const creditDebit = idxCreditDebit >= 0 ? row[idxCreditDebit] : "";

    // --- Date parsing ---
    const rawCreditDate = idxCreditDate >= 0 ? row[idxCreditDate] : null;
    const rawDebitDate = idxDebitDate >= 0 ? row[idxDebitDate] : null;
    const rawTxDate = idxTxDate >= 0 ? row[idxTxDate] : null;

    let rawDate = rawCreditDate || rawDebitDate || rawTxDate;
    let transaction_date = null;

    if (rawDate instanceof Date) {
      transaction_date = rawDate;
    } else if (typeof rawDate === "number") {
      transaction_date = excelDateToJSDate(rawDate);
    } else if (rawDate) {
      const parts = String(rawDate).split("/");
      if (parts.length === 3) {
        const [m, d, y] = parts.map((p) => parseInt(p, 10));
        const fullYear = y < 100 ? 2000 + y : y;
        transaction_date = new Date(fullYear, m - 1, d);
      } else {
        const tryD = new Date(String(rawDate).trim());
        if (!isNaN(tryD)) transaction_date = tryD;
      }
    }

    const formattedDate = formatDateForDB(transaction_date);

    // Quantity parsing
    const rawQty = idxQty >= 0 ? row[idxQty] : 0;
    const share_quantity =
      typeof rawQty === "number"
        ? Math.floor(rawQty)
        : parseInt(String(rawQty || "0").replace(/[, ]+/g, ""), 10) || 0;

    const certificateType = idxCert >= 0 ? row[idxCert] : "";
    let rawStatus = idxStatus >= 0 ? String(row[idxStatus] || "").trim().toUpperCase() : "";
    const status = rawStatus && rawStatus !== "-" ? rawStatus : "ACTIVE";

    const notes = idxNotes >= 0 && row[idxNotes] ? String(row[idxNotes]).trim() : "NIL";

    // Push transaction row
    extracted.transactions.push({
      issuer_id: extracted.issuer?.id || null,
      cusip,
      transaction_type: txnType || issuanceType || "UNKNOWN",
      share_quantity,
      shareholder_id: "f6d974d5-8696-4fba-99b9-25805601acbb",
      restriction_id: null,
      transaction_date: formattedDate,
      status,
      notes,
      certificate_type: certificateType || "Book Entry",
      _raw: row,
      issue_name: issueName,
      issue_ticker: ticker,
      trading_platform: platform,
      security_type: securityType,
      issuance_type: issuanceType,
      shareholder_account: shareholderAccount,
      credit_debit: creditDebit,
    });

    // ✅ Update context safely (no NA overwrites)
    lastContext = {
      issue_name: validField(issueName) ? issueName : lastContext.issue_name,
      issue_ticker: validField(ticker) ? ticker : lastContext.issue_ticker,
      trading_platform: validField(platform) ? platform : lastContext.trading_platform,
      cusip: validField(cusip) ? cusip : lastContext.cusip,
      security_type: validField(securityType) ? securityType : lastContext.security_type,
      issuance_type: validField(issuanceType) ? issuanceType : lastContext.issuance_type,
    };
  });

  console.info(`✅ Extracted ${extracted.transactions.length} transactions from sheet[1] (${sheetName})`);
}

// --- Shareholders sheet detection (2nd sheet usually, but detect keywords) ---
// --- Recordkeeping Book (transactions + shareholders) ---
if (/recordkeeping book/i.test(sName)) {
  console.info("📑 Extracting from Recordkeeping Book:", sheetName);

  const headers = (rows[0] || []).map((h) => (h || "").toString().trim());
  const headersLower = headers.map((h) => (h || "").toLowerCase());

  // --- Transaction indexes ---
  const idxIssueName = findHeaderIndex(headersLower, ["issue name", "issue"]);
  const idxTicker = findHeaderIndex(headersLower, ["ticker", "issue ticker"]);
  const idxPlatform = findHeaderIndex(headersLower, ["platform", "trading platform"]);
  const idxCusip = findHeaderIndex(headersLower, ["cusip", "issue cusip"]);
  const idxSecurityType = findHeaderIndex(headersLower, ["security type", "class"]);
  const idxIssuanceType = findHeaderIndex(headersLower, ["issuance type", "issuance", "type of issuance"]);
  const idxAccount = findHeaderIndex(headersLower, ["account", "account no", "account number"]);
  const idxTxType = findHeaderIndex(headersLower, ["transaction type", "activity", "txn type"]);
  const idxCreditDebit = findHeaderIndex(headersLower, ["credit/debit", "credit", "debit"]);
  const idxCreditDate = findHeaderIndex(headersLower, ["credit date"]);
  const idxDebitDate = findHeaderIndex(headersLower, ["debit date"]);
  const idxTxDate = findHeaderIndex(headersLower, ["transaction date", "date"]);
  const idxQty = findHeaderIndex(headersLower, ["quantity", "qty", "shares", "total securities issued"]);
  const idxCert = findHeaderIndex(headersLower, ["certificate", "cert"]);
  const idxStatus = findHeaderIndex(headersLower, ["status"]);
  const idxNotes = findHeaderIndex(headersLower, ["notes", "memo", "remarks"]);

  // --- Shareholder indexes ---
  const idxFirst = findHeaderIndex(headersLower, ["first name", "shareholder first name"]);
  const idxLast = findHeaderIndex(headersLower, ["last name", "shareholder/entity last name"]);
  const idxLei = findHeaderIndex(headersLower, ["lei"]);
  const idxType = findHeaderIndex(headersLower, ["holder type", "type"]);
  const idxAddress = findHeaderIndex(headersLower, ["address"]);
  const idxCity = findHeaderIndex(headersLower, ["city"]);
  const idxState = findHeaderIndex(headersLower, ["state"]);
  const idxZip = findHeaderIndex(headersLower, ["zip", "postal"]);
  const idxCountry = findHeaderIndex(headersLower, ["country"]);
  const idxTaxId = findHeaderIndex(headersLower, ["taxpayer id", "tin"]);
  const idxTinStatus = findHeaderIndex(headersLower, ["tin status"]);
  const idxEmail = findHeaderIndex(headersLower, ["email"]);
  const idxPhone = findHeaderIndex(headersLower, ["phone", "contact"]);
  const idxOwnership = findHeaderIndex(headersLower, ["% ownership", "ownership"]);
  const idxOfac = findHeaderIndex(headersLower, ["ofac", "ofac date"]);
  const idxDob = findHeaderIndex(headersLower, ["dob", "date of birth"]);

  let lastContext = {};

  rows.slice(1).forEach((row) => {
  if (!row || row.length === 0 || row.every((c) => c === "")) return;

  // --- Transaction row ---
  const issueName = row[idxIssueName] || lastContext.issue_name || "";
  const ticker = row[idxTicker] || lastContext.issue_ticker || "";
  const platform = row[idxPlatform] || lastContext.trading_platform || "";
  const cusip = row[idxCusip] || lastContext.cusip || "";
  const securityType = row[idxSecurityType] || lastContext.security_type || "";   // ✅ FIXED
  const issuanceType = row[idxIssuanceType] || lastContext.issuance_type || "";   // ✅ FIXED

  const txnType = row[idxTxType] || "";
  const creditDebit = row[idxCreditDebit] || "";

  const rawDate = row[idxCreditDate] || row[idxDebitDate] || row[idxTxDate];
  const transaction_date = excelDateToJSDate(rawDate);
  const share_quantity = parseInt(String(row[idxQty] || "0").replace(/[, ]+/g, ""), 10) || 0;

  extracted.transactions.push({
    issuer_id: extracted.issuer?.id || null,
    cusip,
    transaction_type: txnType || issuanceType || "UNKNOWN",
    share_quantity,
    shareholder_account: row[idxAccount] || "",
    transaction_date,
    certificate_type: row[idxCert] || "Book Entry",
    status: row[idxStatus] || "ACTIVE",
    notes: row[idxNotes] || "NIL",
    issue_name: issueName,
    issue_ticker: ticker,
    trading_platform: platform,
    security_type: securityType,   // ✅ FIXED reference
    issuance_type: issuanceType,   // ✅ FIXED reference
    credit_debit: creditDebit,
    _raw: row,
  });

  // Update context
  lastContext = { 
    issue_name: issueName, 
    issue_ticker: ticker, 
    trading_platform: platform, 
    cusip, 
    security_type: securityType, 
    issuance_type: issuanceType 
  };

  // --- Shareholder row ---
extracted.shareholders.push({
  account_number: row[idxAccount] || "",
  first_name: row[idxFirst] || "",
  last_name: row[idxLast] || "",
  lei: row[idxLei] || "",
  holder_type: row[idxType] || "",
  address: row[idxAddress] || "",
  city: row[idxCity] || "",
  state: row[idxState] || "",
  zip: row[idxZip] || "",
  country: row[idxCountry] || "",
  taxpayer_id: row[idxTaxId] || "",
  tin_status: row[idxTinStatus] || "",
  email: row[idxEmail] || "",
  phone: row[idxPhone] || "",
  ownership_percentage: idxOwnership >= 0 ? parseFloat(String(row[idxOwnership]).replace(/[%]/g, "")) || 0 : null,
  ofac_date: idxOfac >= 0 ? excelDateToJSDate(row[idxOfac]) : null,
  dob: idxDob >= 0 ? excelDateToJSDate(row[idxDob]) : null,
  _raw: row,
});

});

  console.info(`✅ Extracted ${extracted.transactions.length} transactions`);
  console.info(`✅ Extracted ${extracted.shareholders.length} shareholders`);
}


 // end transactions sheet detection
        }); // end sheets loop

        // debugging summary
        console.groupCollapsed("Import parse summary");
        console.log("Issuer:", extracted.issuer);
        console.log("Splits count:", extracted.splits.length);
        console.log("Securities count:", extracted.securities.length);
if (extracted.securities.length > 0) {
  console.table(extracted.securities.map(s => ({
    issue_name: s.issue_name,
    ticker: s.issue_ticker,
    cusip: s.cusip,
    class: s.class_name,
    platform: s.trading_platform,
    total_auth: s.total_authorized_shares || "NA",
    status: s.status || "NA"
  })));
}


        console.log("Officers count:", extracted.officers.length);
        console.log("Shareholders count:", extracted.shareholders.length);
        console.log("Recordkeeping summary count:", extracted.recordkeeping.length);
        console.log("Transactions count:", extracted.transactions.length);
        if (extracted.transactions.length > 0) {
          console.log("Sample transaction:", extracted.transactions[0]);
        }
        console.groupEnd();

        setFormData(extracted);
        setActiveTab("issuer");
      } catch (err) {
        console.error("File parse error:", err);
        setSaveProgress('error');
setSaveResults({ type: 'error', message: 'Error parsing uploaded file — check console for details.' });

      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Update section helper ------------------------------------------------
  const updateSection = (section, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: value,
    }));
  };

  // --- Save flow with detailed debug ---------------------------------------
  const saveIssuerAndRelated = async (override = false) => {
    if (!formData) {
     setSaveProgress('error');
setSaveResults({ type: 'error', message: 'No data to save. Please upload a file first.' });
return;
      
    }
    setLoading(true);
    setSaveProgress('saving');
setSaveResults(null);

    console.info("Saving — parsed payload counts:", {
      splits: formData.splits?.length || 0,
      securities: formData.securities?.length || 0,
      officers: formData.officers?.length || 0,
      shareholders: formData.shareholders?.length || 0,
      recordkeeping: formData.recordkeeping?.length || 0,
      transactions: formData.transactions?.length || 0,
    });

    const results = {
      issuer: null,
      splits: { ok: 0, failed: [] },
      securities: { ok: 0, failed: [] },
      officers: { ok: 0, failed: [] },
      shareholders: { ok: 0, failed: [] },
      recordkeeping: { ok: 0, failed: [] },
      transactions: { ok: 0, failed: [] },
    };

    try {
      // 1) Save issuer -> /api/issuers/import
const resIssuer = await fetch("/api/issuers/import", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    ...formData.issuer,
    override,
  }),
});

      const payloadIssuer = await resIssuer.json().catch(() => ({}));
      console.log("Issuer API response:", resIssuer.status, payloadIssuer);

      if (payloadIssuer?.exists) {
        setConflictData(payloadIssuer.issuer);
        setSaveResults({ type: 'warning', message: 'Issuer already exists — pre-populated. Resolve conflict or choose override.' });
setLoading(false);
return;
      }

      if (!resIssuer.ok) {
        console.error("Issuer save failed:", payloadIssuer);
        throw new Error(payloadIssuer?.error || "Issuer save failed");
      }

      // issuerId safe extraction: support multiple backend shapes
      const issuerId =
        payloadIssuer?.issuer?.id ||
        payloadIssuer?.id ||
        payloadIssuer?.issuer_id ||
        payloadIssuer?.data?.id;

      if (!issuerId) {
        console.error("Could not determine issuer id from response:", payloadIssuer);
        throw new Error("Could not determine saved issuer ID");
      }

      results.issuer = issuerId;
      console.log("Saved issuer id:", issuerId);

      // helper to post array and collect results
      const postMany = async (items, url, entityName, mapBeforeSend) => {
        for (const [i, it] of (items || []).entries()) {
          try {
            const payload = mapBeforeSend ? mapBeforeSend(it) : it;
            const r = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ issuer_id: issuerId, ...payload }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
              console.warn(`${entityName} row ${i} failed`, r.status, body);
              results[entityName].failed.push({ index: i, row: it, status: r.status, body });
            } else {
              results[entityName].ok += 1;
            }
          } catch (err) {
            console.error(`${entityName} row ${i} exception:`, err);
            results[entityName].failed.push({ index: i, row: it, error: String(err) });
          }
        }
      };

      // 2) Splits -> /api/splits
      await postMany(
        formData.splits || [],
        "/api/splits",
        "splits",
        (s) => ({
          transaction_type: s.transaction_type || "DWAC Withdrawa",
          class_a_ratio:
            typeof s.class_a_ratio === "number"
              ? Number(s.class_a_ratio.toFixed(1))
              : Number(parseFloat(s.class_a_ratio || 0).toFixed(1)),
          rights_ratio:
            typeof s.rights_ratio === "number"
              ? Number(s.rights_ratio.toFixed(1))
              : Number(parseFloat(s.rights_ratio || 0).toFixed(1)),
        })
      );


    // 3) Securities -> /api/securities (dedupe by CUSIP per issuer)
if (formData.securities && formData.securities.length > 0) {
  // Deduplicate
  const uniqueSecurities = Array.from(
    new Map((formData.securities || []).map(s => [s.cusip, s])).values()
  );

  console.info(
    `📦 Securities deduped: ${uniqueSecurities.length} unique CUSIPs (from ${formData.securities.length} rows)`
  );

  await postMany(
    uniqueSecurities,
    "/api/securities",
    "securities",
    (s) => ({
      class_name: s.class_name || "Unknown",
      cusip: s.cusip || null,
      issue_name: s.issue_name || null,
      issue_ticker: s.issue_ticker || null,
      trading_platform: s.trading_platform || null,
      total_authorized_shares: Number(s.total_authorized_shares || 0),
      status: s.status || "ACTIVE",
    })
  );
}

      // 4) Officers -> /api/officers
      await postMany(formData.officers || [], "/api/officers", "officers");

  // REPLACE the entire shareholders and transactions section (lines ~420-515) with this:

// 5) Shareholders -> /api/shareholders (bulk insert) - MUST complete before transactions
if (formData.shareholders && formData.shareholders.length > 0) {
  const shPayload = formData.shareholders.map((s) => ({
    issuer_id: issuerId, // ✅ Uses issuer_id from step 1
    account_number: s.account_number || null,
    first_name: s.first_name || null,
    last_name: s.last_name || null,
    address: s.address || null,
    city: s.city || null,
    state: s.state || null,
    zip: s.zip || null,
    country: s.country || null,
    taxpayer_id: s.taxpayer_id || null,
    tin_status: s.tin_status || null,
    email: s.email || null,
    phone: s.phone || null,
    dob: s.dob || null,
    holder_type: s.holder_type || null,
    lei: s.lei || null,
    ownership_percentage: s.ownership_percentage || 0,
    ofac_date: s.ofac_date || null,
  }));

  const res = await fetch("/api/shareholders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(shPayload),
  });

  const shRes = await res.json().catch(() => ({}));
  console.log("Shareholders API response:", res.status, shRes);

  if (!res.ok) {
    console.warn("Shareholders bulk insert failed", shRes);
    results.shareholders.failed.push({ status: res.status, body: shRes });
  } else {
    results.shareholders.ok = shRes.records?.length || shPayload.length;

    // ✅ Build account_number → shareholder_id mapping from DB response
    const accountToShareholderMap = {};
    if (Array.isArray(shRes.records)) {
      shRes.records.forEach((sh) => {
        if (sh.account_number && sh.id) {
          accountToShareholderMap[sh.account_number] = sh.id;
        }
      });
    }

    // ✅ Update state for UI display
    setShareholderMap(
      Object.fromEntries(
        Object.entries(accountToShareholderMap).map(([account, id]) => [
          account,
          {
            id,
            name: shRes.records.find(r => r.id === id) ? 
              `${shRes.records.find(r => r.id === id).first_name || ""} ${shRes.records.find(r => r.id === id).last_name || ""}`.trim() : 
              "Unknown"
          }
        ])
      )
    );

    // 6) Transactions -> /api/recordkeeping/transactions (AFTER shareholders are saved)
    if (formData.transactions && formData.transactions.length > 0) {
      const txPayload = formData.transactions.map((t) => ({
        issuer_id: issuerId, // ✅ Uses issuer_id from step 1
        issue_name: t.issue_name || null,
        issue_ticker: t.issue_ticker || null,
        trading_platform: t.trading_platform || null,
        cusip: t.cusip || null,
        security_type: t.security_type || null,
        issuance_type: t.issuance_type || null,
        
        // ✅ Map shareholder_account → shareholder_id using fresh mapping
        shareholder_id: t.shareholder_account && accountToShareholderMap[t.shareholder_account] 
          ? accountToShareholderMap[t.shareholder_account] 
          : null,
          
        shareholder_account: t.shareholder_account || null,
        transaction_type: t.transaction_type || null,
        credit_debit: t.credit_debit || null,
        transaction_date: t.transaction_date || null,
        share_quantity: Number(t.share_quantity || 0),
        certificate_type: t.certificate_type || null,
        status: t.status || null,
        notes: t.notes || "NIL",
        raw_row: t._raw || null,
      }));

      console.log("Transactions payload sample:", {
        total: txPayload.length,
        sample: txPayload[0],
        mappingCount: Object.keys(accountToShareholderMap).length
      });

      const txRes = await fetch("/api/recordkeeping/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(txPayload),
      });

      const txResBody = await txRes.json().catch(() => ({}));
      console.log("Transactions API response:", txRes.status, txResBody);

      if (!txRes.ok) {
        console.warn("Transactions bulk insert failed", txResBody);
        results.transactions.failed.push({
          status: txRes.status,
          body: txResBody,
        });
      } else {
        results.transactions.ok = txPayload.length;
      }
    }
  }
}

// 7) Recordkeeping summary -> /api/recordkeeping (can run in parallel)
await postMany(formData.recordkeeping || [], "/api/recordkeeping", "recordkeeping");
      



      // 8) Documents reference (one call) -> /api/documents
      try {
        const docRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            issuer_id: issuerId,
            document_type: "import_excel",
            document_name: "Imported File",
            file_url: "/uploads/fake.xlsx",
            file_size: 12345,
            file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        });
        const docBody = await docRes.json().catch(() => ({}));
        console.log("Documents API response:", docRes.status, docBody);
      } catch (err) {
        console.warn("Documents API error:", err);
      }

      // --- Build result message ---
      // --- Build result message ---
const failures = [
  ...results.splits.failed,
  ...results.securities.failed,
  ...results.officers.failed,
  ...results.shareholders.failed,
  ...results.recordkeeping.failed,
  ...results.transactions.failed,
];

// Filter out entities with 0 records
const addedRecords = [];
if (results.splits.ok > 0) addedRecords.push(`Splits: ${results.splits.ok}`);
if (results.securities.ok > 0) addedRecords.push(`Securities: ${results.securities.ok}`);
if (results.officers.ok > 0) addedRecords.push(`Officers: ${results.officers.ok}`);
if (results.shareholders.ok > 0) addedRecords.push(`Shareholders: ${results.shareholders.ok}`);
if (results.recordkeeping.ok > 0) addedRecords.push(`Records: ${results.recordkeeping.ok}`);
if (results.transactions.ok > 0) addedRecords.push(`Transactions: ${results.transactions.ok}`);

if (failures.length > 0) {
  console.warn("Some items failed to save:", failures);
  setSaveProgress('complete');
  setSaveResults({
    type: 'warning',
    message: 'Import completed with some errors',
    addedRecords,
    note: 'Check console for failed rows (detailed).'
  });
} else {
  setSaveProgress('complete');
  setSaveResults({
    type: 'success',
    message: 'All data saved successfully!',
    addedRecords
  });
  if (onClose) setTimeout(onClose, 10000);
}
    } catch (err) {
      console.error("Save flow error:", err);
      setSaveProgress('error');
setSaveResults({ type: 'error', message: 'Save failed — check console for details.' });

    } finally {
      setLoading(false);
      if (saveProgress === 'saving') {
  setSaveProgress('complete');
}
    }
  };

  // --- Tabs list -----------------------------------------------------------
  const tabs = [
    { key: "issuer", label: "Issuer" },
    //{ key: "splits", label: "Splits" },
    { key: "securities", label: "Securities" },
    //{ key: "officers", label: "Officers" },
    { key: "shareholders", label: "Shareholders" },
    //{ key: "recordkeeping", label: "Record Keeping" },
    { key: "transactions", label: "Transactions" },
  ];

const ProgressIndicator = () => (
  <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-64">
    <div className="flex items-center space-x-3">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
      <span className="text-sm font-medium text-gray-700">Saving data...</span>
    </div>
    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
      <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
    </div>
  </div>
);

{/*// Results Modal
<div className="px-6 py-4">
  {results.addedRecords && results.addedRecords.length > 0 && (
    <div className="space-y-2 mb-4">
      <p className="text-sm font-medium text-gray-700">Added records:</p>
      <div className="text-sm space-y-1">
        {results.addedRecords.map((record, index) => (
          <div key={index} className="text-gray-600">• {record}</div>
        ))}
      </div>
    </div>
  )}
  
  {results.note && (
    <p className="text-sm text-gray-600 mb-4">{results.note}</p>
  )}
  
  <div className="flex justify-end">
    <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2">
      Close
    </Button>
  </div>
</div>

*/}

  return (
    <div className="space-y-4">
      {/* File upload */}
      <div>
        <label className="block text-sm font-medium mb-1">Upload Excel</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="block w-full border p-2 rounded"
        />
      </div>

      {/* Tabs + Form */}
      {formData && !conflictData && (
        <>
          <div className="flex space-x-2 border-b mb-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1 ${activeTab === t.key ? "border-b-2 border-red-500 font-bold" : ""}`}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-gray-50 p-3 rounded border min-h-40">
            {activeTab === "issuer" && (
              <IssuerForm issuer={formData.issuer} setIssuer={(u) => updateSection("issuer", u)} />
            )}
            {activeTab === "splits" && (
              <SplitsForm splits={formData.splits} setSplits={(s) => updateSection("splits", s)} />
            )}
            {activeTab === "securities" && (
              <SecuritiesForm securities={formData.securities} setSecurities={(s) => updateSection("securities", s)} />
            )}
            {activeTab === "officers" && (
              <OfficersForm officers={formData.officers} setOfficers={(o) => updateSection("officers", o)} />
            )}
            {activeTab === "shareholders" && (
              <ShareholdersForm shareholders={formData.shareholders} setShareholders={(s) => updateSection("shareholders", s)} />
            )}
            {activeTab === "recordkeeping" && (
              <RecordkeepingBookForm records={formData.recordkeeping} setRecords={(rk) => updateSection("recordkeeping", rk)} />
            )}
            {activeTab === "transactions" && (
  <RecordkeepingTransactionsForm
    transactions={formData.transactions.map((t) => ({
      ...t,
      shareholder_name:
        t.shareholder_account && shareholderMap[t.shareholder_account]
          ? shareholderMap[t.shareholder_account].name
          : "Unmapped",
      shareholder_id:
        t.shareholder_account && shareholderMap[t.shareholder_account]
          ? shareholderMap[t.shareholder_account].id
          : null,
    }))}
    setTransactions={(tx) => updateSection("transactions", tx)}
  />
)}

          </div>

          {/* Actions */}
          <div className="flex justify-end mt-4 space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => saveIssuerAndRelated(false)}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save All"}
            </Button>
          </div>
        
        </>
      )}
{/* Progress Indicator */}
{saveProgress === 'saving' && <ProgressIndicator />}

{/* Results Modal */}
{saveResults && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-lg w-96 p-6">
      {saveResults.addedRecords?.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium text-gray-700">Added records:</p>
          <div className="text-sm space-y-1">
            {saveResults.addedRecords.map((record, index) => (
              <div key={index} className="text-gray-600">• {record}</div>
            ))}
          </div>
        </div>
      )}

      {saveResults.note && (
        <p className="text-sm text-gray-600 mb-4">{saveResults.note}</p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setSaveResults(null);
            setSaveProgress(null);
          }}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2"
        >
          Close
        </Button>
      </div>
    </div>
  </div>
)}


      {/* Conflict overlay */}
      {conflictData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="font-bold text-lg mb-2">Issuer already exists</h3>
            <p className="text-sm text-gray-700 mb-4">
              An issuer with the name <span className="font-semibold">{conflictData.issuer_name || conflictData.display_name}</span> already exists.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => { setConflictData(null); onClose(); }}>
                Cancel
              </Button>
              <Button onClick={() => { setConflictData(null); saveIssuerAndRelated(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                Override & Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
