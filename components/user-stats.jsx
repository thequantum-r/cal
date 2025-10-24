export default function UserStats({ users }) {
  // Calculate role stats based on users' highest role across all issuers
  const roleStats = users.reduce((acc, user) => {
    // Check if user is superadmin first
    if (user.is_super_admin) {
      acc.superadmin = (acc.superadmin || 0) + 1
      return acc
    }

    // Find user's highest role across all issuer memberships
    const roleHierarchy = ['admin', 'transfer_team', 'shareholder', 'read_only'];
    let userHighestRole = 'read_only'; // default

    if (user.memberships && user.memberships.length > 0) {
      for (const roleLevel of roleHierarchy) {
        const hasRole = user.memberships.some(membership => 
          membership.roles?.some(role => role.name === roleLevel)
        );
        if (hasRole) {
          userHighestRole = roleLevel;
          break;
        }
      }
    }

    acc[userHighestRole] = (acc[userHighestRole] || 0) + 1
    return acc
  }, { superadmin: 0, admin: 0, transfer_team: 0, shareholder: 0, read_only: 0 })

  const stats = [
    {
      name: "Total Users",
      value: users.length,
      color: "bg-blue-500",
    },
    {
      name: "Superadmins",
      value: roleStats.superadmin,
      color: "bg-purple-500",
    },
    {
      name: "Admins",
      value: roleStats.admin,
      color: "bg-red-500",
    },
    {
      name: "Transfer Team",
      value: roleStats.transfer_team,
      color: "bg-green-500",
    },
    {
      name: "Shareholders",
      value: roleStats.shareholder,
      color: "bg-orange-500",
    },
    {
      name: "Read Only",
      value: roleStats.read_only,
      color: "bg-gray-500",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${stat.color} rounded-full flex items-center justify-center`}>
                  <span className="text-white text-sm font-medium">{stat.value}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                  <dd className="text-lg font-medium text-gray-900">{stat.value}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
