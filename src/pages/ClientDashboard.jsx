import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CLIENT_ID = '230f8351-f284-450e-b1d8-adeef448b70a'; // temporary hardcoded

export default function ClientDashboard() {
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    const fetchRolesAndCandidates = async () => {
      const { data: rolesData, error } = await supabase
        .from('roles')
        .select('id, title, candidates(id, name, email, reports(report_url))')
        .eq('client_id', CLIENT_ID);

      if (error) {
        console.error('Error fetching roles:', error.message);
      } else {
        setRoles(rolesData);
      }
    };

    fetchRolesAndCandidates();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Client Dashboard</h1>
      {roles.map((role) => (
        <div key={role.id} className="mb-6 border-b pb-4">
          <h2 className="text-lg font-semibold">{role.title}</h2>
          <ul className="ml-4 mt-2">
            {role.candidates?.map((cand) => (
              <li key={cand.id}>
                {cand.name} ({cand.email}) —{' '}
                {cand.reports?.[0]?.report_url ? (
                  <a
                    href={`https://rytlclkkcvvnkoncfaid.supabase.co/storage/v1/object/public/${cand.reports[0].report_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View Report
                  </a>
                ) : (
                  'No report'
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
