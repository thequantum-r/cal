"use client"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function WeeklyMarketChart({ data }) {
  const lastUpdated = new Date().toLocaleString()

  return (
    <div className="w-full">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
          >
            {/* Subtle grid lines */}
            <CartesianGrid strokeDasharray="3 3" stroke="#f3d8a8" />

            {/* X-Axis — small, clean ticks */}
            <XAxis
              dataKey="week"
              tick={{
                fontSize: 11,
                fill: "#666",
              }}
              axisLine={{ stroke: "#e5b87f" }}
              tickLine={false}
              height={25}
            />

            {/* Y-Axis — minimalist */}
            <YAxis
              domain={["dataMin - 0.05", "dataMax + 0.05"]}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              tick={{
                fontSize: 11,
                fill: "#666",
              }}
              axisLine={false}
              tickLine={false}
              width={60}
            />

            {/* Tooltip */}
            <Tooltip
              formatter={(value) => `$${value.toFixed(2)}`}
              labelStyle={{ fontWeight: "600", color: "#333" }}
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #f7b063",
                backgroundColor: "#fffaf5",
                fontSize: 12,
                color: "#333",
              }}
            />

            {/* Line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#ec741e"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend below chart */}
      <div className="flex justify-between items-center mt-2 text-[11.5px] text-gray-600 italic">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[#ec741e] rounded-full"></span>
          Stock Price (USD) vs Weeks
        </span>
        <span className="text-gray-500 not-italic">
          Last updated: {lastUpdated}
        </span>
      </div>
    </div>
  )
}
