// File: ShareholdersForm.jsx
"use client";

export default function ShareholdersForm({ shareholders }) {
  if (!shareholders || shareholders.length === 0) {
    return <p className="text-sm text-gray-500">No shareholders parsed.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Account #</th>
            <th className="p-2 border">First Name</th>
            <th className="p-2 border">Last Name</th>
            <th className="p-2 border">Address</th>
            <th className="p-2 border">City</th>
            <th className="p-2 border">State</th>
            <th className="p-2 border">Zip</th>
            <th className="p-2 border">Country</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">% Ownership</th>
          </tr>
        </thead>
        <tbody>
          {shareholders.map((sh, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border">{sh.account_number}</td>
              <td className="p-2 border">{sh.first_name}</td>
              <td className="p-2 border">{sh.last_name}</td>
              <td className="p-2 border">{sh.address}</td>
              <td className="p-2 border">{sh.city}</td>
              <td className="p-2 border">{sh.state}</td>
              <td className="p-2 border">{sh.zip}</td>
              <td className="p-2 border">{sh.country}</td>
              <td className="p-2 border">{sh.email}</td>
              <td className="p-2 border">{sh.phone}</td>
              <td className="p-2 border">{sh.ownership_percentage || 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
