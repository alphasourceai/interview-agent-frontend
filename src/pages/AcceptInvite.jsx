// src/pages/AcceptInvite.jsx
import { useEffect, useState } from 'react';
import { apiPost } from '../lib/api';
import { supabase } from '../lib/supabaseClient';

export default function AcceptInvite() {
  const [status, setStatus] = useState('idle'); // idle | working | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function run() {
      setStatus('working');
      setMessage('Accepting invitation…');

      try {
        // Ensure user is logged in (or has a session) before accepting
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          setStatus('error');
          setMessage('You must be signed in to accept an invite.');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token') || params.get('t') || '';

        if (!token) {
          setStatus('error');
          setMessage('Missing invite token.');
          return;
        }

        // Backend should handle accepting invites at this endpoint
        await apiPost('/invitations/accept', { token });

        setStatus('success');
        setMessage('Invitation accepted! Redirecting…');

        // Optional: redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      } catch (e) {
        setStatus('error');
        setMessage(e.message || 'Failed to accept invitation.');
      }
    }

    run();
  }, []);

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Accept Invitation</h1>
      <p className="text-gray-600 mb-4">
        {status === 'idle' && 'Ready.'}
        {status === 'working' && message}
        {status === 'success' && message}
        {status === 'error' && <span className="text-red-600">{message}</span>}
      </p>
    </div>
  );
}
