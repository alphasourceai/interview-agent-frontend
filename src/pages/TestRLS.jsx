import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function TestRLS() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchRoles = async () => {
      const { data, error } = await supabase.from('roles').select('*');
      if (error) console.error('Error:', error);
      else setData(data);
    };

    fetchRoles();
  }, []);

  return (
    <div>
      <h1>Test RLS Page</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default TestRLS;
