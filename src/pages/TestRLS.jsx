import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const TestRLS = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const clientId = '230f8351-f284-450e-b1d8-adeef448b70a'; // 🔐 Test client ID

  useEffect(() => {
    const fetchInterviews = async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('client_id', clientId);

      if (error) {
        console.error('Error fetching interviews:', error.message);
      } else {
        setInterviews(data);
      }
      setLoading(false);
    };

    fetchInterviews();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>RLS Test: Fetch Interviews</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <pre>{JSON.stringify(interviews, null, 2)}</pre>
      )}
    </div>
  );
};

export default TestRLS;
