export default function KPICard({ title, value, subtitle, icon: Icon, color = "orange" }) {
  const colorClasses = {
    orange: "from-orange-400 to-red-500",
    red: "from-red-400 to-orange-500", 
    yellow: "from-yellow-400 to-orange-500",
    green: "from-green-400 to-blue-500"
  }

  return (
    <div className="card-glass overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            {subtitle && (
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-sm text-gray-500">{subtitle}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      </div>
    </div>
  )
}
