import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { issuerId, shareholderId, statementDate, data } =
      await request.json();

    // Generate the statement content as text
    const statementContent = generateStatementText(data);

    // Create a buffer with the statement content
    const buffer = Buffer.from(statementContent, "utf-8");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="statement-${shareholderId}-${statementDate}.txt"`,
      },
    });
  } catch (error) {
    console.error("Error generating statement:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 },
    );
  }
}

function generateStatementText(data) {
  const { shareholder, statement_date, holdings } = data;

  let content = "";

  // Header
  content += "=".repeat(60) + "\n";
  content += "                    SHAREHOLDER STATEMENT\n";
  content += "=".repeat(60) + "\n\n";

  // Statement date
  content += `Statement Date: ${new Date(statement_date).toLocaleDateString()}\n\n`;

  // Shareholder information
  content += "SHAREHOLDER INFORMATION\n";
  content += "-".repeat(30) + "\n";
  content += `Name: ${shareholder.last_name || "-"}, ${shareholder.first_name || "-"}\n`;
  content += `Account Number: ${shareholder.account_number || "-"}\n`;
  if (shareholder.address) content += `Address: ${shareholder.address}\n`;
  if (shareholder.city && shareholder.state) {
    content += `City: ${shareholder.city}, ${shareholder.state} ${shareholder.zip || ""}\n`;
  }
  content += "\n";

  // Holdings section
  content += "SECURITY HOLDINGS\n";
  content += "-".repeat(30) + "\n";

  if (holdings.length > 0) {
    // Table header
    content +=
      "Security".padEnd(25) +
      "Shares".padEnd(15) +
      "Market Value".padEnd(15) +
      "Restrictions\n";
    content += "-".repeat(70) + "\n";

    // Holdings data
    holdings.forEach((holding) => {
      const securityName = (
        holding.security_name || "Unknown Security"
      ).substring(0, 24);
      const shares = holding.shares_outstanding.toLocaleString();
      const marketValue = `$${holding.market_value_total.toFixed(2)}`;
      const restrictions = holding.restrictions_text.includes("No restrictions")
        ? "None"
        : "Restricted";

      content +=
        securityName.padEnd(25) +
        shares.padEnd(15) +
        marketValue.padEnd(15) +
        restrictions +
        "\n";

      // Add CUSIP info on next line
      content += `  CUSIP: ${holding.cusip}\n`;
      content += `  Type: ${holding.security_type || "Unknown Type"}\n`;
      content += `  Price per share: $${holding.market_value_per_share.toFixed(2)}\n\n`;
    });
  } else {
    content += "No holdings found for this shareholder\n\n";
  }

  // Footer
  content += "=".repeat(60) + "\n";
  content +=
    "This statement is generated as of the statement date and reflects\n";
  content += "the shareholder's position at that time.\n\n";
  content += "For questions regarding this statement, please contact the\n";
  content += "transfer agent.\n";
  content += "=".repeat(60) + "\n";

  return content;
}
