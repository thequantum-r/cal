import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeText(str?: string) {
  if (!str) return ""

  const alwaysUpper = ["LLC", "LP", "INC", "CO", "CA", "LLP", "LLLP", "USA", "IPO"]
  const alwaysLower = ["for", "from", "to", "and", "or", "in", "of", "on", "by", "with", "days", "date", "pricing", "months","after"]

  // Split text into segments separated by line breaks so we can preserve them
  return str
    .split(/\n+/) // Split by newlines
    .map(line => {
      return line
        .toLowerCase()
        .split(/\s+/)
        .map((word, index) => {
          if (!word) return ""

          const cleaned = word.replace(/[.,()]/g, "")

          if (alwaysUpper.includes(cleaned.toUpperCase())) return word.toUpperCase()
          if (alwaysLower.includes(cleaned) && index !== 0) return cleaned

          const match = word.match(/^(\W*)([a-zA-Z])([\w'().-]*)$/)
          if (match) {
            const [, prefix, firstChar, rest] = match
            return prefix + firstChar.toUpperCase() + rest
          }

          return word.charAt(0).toUpperCase() + word.slice(1)
        })
        .join(" ")
    })
    .join("\n") // Put the preserved line breaks back
}



export function splitUSCounsel(input?: string) {
  if (!input) return { issuerCounsel: "", underwritersCounsel: "" }

  // Common separators: " and ", "&", "/", ";", "|"
  // Prefer explicit " and " split first (more natural in legal firm names)
  const primary = input.split(/\s+and\s+/i)
  if (primary.length === 2) {
    return {
      issuerCounsel: primary[0].trim().replace(/[.,]$/, ""),
      underwritersCounsel: primary[1].trim().replace(/[.,]$/, ""),
    }
  }

  // Fallback for other separators
  const alt = input.split(/\s*(?:,|&|\/|\||;)\s*/)
  if (alt.length === 2) {
    return {
      issuerCounsel: alt[0].trim().replace(/[.,]$/, ""),
      underwritersCounsel: alt[1].trim().replace(/[.,]$/, ""),
    }
  }

  // Default fallback
  return { issuerCounsel: input.trim(), underwritersCounsel: "" }
}
