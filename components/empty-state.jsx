import { Users, ArrowRightLeft, Calendar, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

const emptyStates = {
  shareholders: {
    icon: Users,
    title: "No Shareholders Found",
    description: "Get started by adding your first shareholder to the system.",
    actionText: "Add Shareholder",
    actionIcon: Users,
  },
  transfers: {
    icon: ArrowRightLeft,
    title: "No Transfers Found",
    description: "No share transfers have been recorded yet. Create your first transfer.",
    actionText: "New Transfer",
    actionIcon: ArrowRightLeft,
  },
  search: {
    icon: Search,
    title: "No Results Found",
    description: "Try adjusting your search criteria or date range.",
    actionText: "Clear Filters",
    actionIcon: Search,
  },
  snapshots: {
    icon: Calendar,
    title: "No Historical Data",
    description: "No snapshots available for the selected date range.",
    actionText: "View All Data",
    actionIcon: Calendar,
  },
}

export default function EmptyState({ type, onAction, showAction = true }) {
  const config = emptyStates[type]
  const Icon = config.icon

  return (
    <div className="text-center py-12">
      <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-gray-100 mb-6">
        <Icon className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{config.title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">{config.description}</p>
      {showAction && onAction && (
        <Button onClick={onAction} className="bg-blue-600 hover:bg-blue-700">
          <config.actionIcon className="h-4 w-4 mr-2" />
          {config.actionText}
        </Button>
      )}
    </div>
  )
}

