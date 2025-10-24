import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  const { symbol } = params

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`
    )
    const data = await response.json()

    const result = data.chart.result[0]
    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close

    // Group into weekly (every 5 trading days)
    const weeklyData = []
for (let i = 0; i < timestamps.length; i += 5) {
  const slice = closes
    .slice(i, i + 5)
    .filter(v => typeof v === "number" && !isNaN(v) && v < 1000) // filters junk
  if (slice.length) {
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length
    const weekNum = Math.ceil((i + 1) / 5)
    weeklyData.push({
      week: `Week ${weekNum}`,
      price: Number(avg.toFixed(2)),
    })
  }
}

console.log("Raw Yahoo Close Prices:", closes.slice(-10))
console.log("Processed Weekly Data:", weeklyData)

    return NextResponse.json({ data: weeklyData })
  } catch (error) {
    console.error("Market fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 })
  }
}
