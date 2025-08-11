import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

function VerifyOtp() {
  const [params] = useSearchParams();
  const emailFromQuery = params.get('email') || '';
  const roleIdFromQuery = params.get('role_id') || '';
  const candidateIdFromQuery = params.get('candidate_id') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const otpInputRef = useRef(null);

  useEffect(() => {
    // Autofocus the OTP field for a smoother UX
    otpInputRef.current?.focus();
  }, []);

  const API_BASE = import.meta.env.VITE_BACKEND_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    // quick client-side check
    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter the 6-digit code.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/candidate/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Backend verify route only requires email + code based on our current server
        body: JSON.stringify({ email, code: otp /* role_id: roleIdFromQuery */ }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Verification failed.');
      } else {
        setMessage(result.message || 'Verified.');
        if (result.redirect_url) {
          // Kick candidate straight into Tavus
          window.location.href = result.redirect_url;
        } else {
          // Fallback: verified but no link yet
          setMessage('Verification complete. Your interview link will be ready shortly.');
        }
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-4">Verify Your OTP</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white shadow-md rounded px-8 py-6">
        <label className="block mb-2 text-sm font-bold text-gray-700">Email</label>
        <input
          type="email"
          className="w-full mb-4 px-3 py-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          // if email was passed from previous page, lock it to avoid mismatch
          readOnly={!!emailFromQuery}
        />

        <label className="block mb-2 text-sm font-bold text-gray-700">6-Digit OTP</label>
        <input
          ref={otpInputRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          pattern="\d{6}"
          className="w-full mb-4 px-3 py-2 border rounded"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
        />

        {error && <p className="text-red-500 mb-4">{error}</p>}
        {message && <p className="text-green-600 mb-4">{message}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#00cfc8] text-white px-4 py-2 rounded hover:bg-[#00b8b1] w-full"
        >
          {submitting ? 'Verifying...' : 'Submit OTP'}
        </button>

        {/* Optional: helpful note while SMS is in sandbox */}
        {import.meta.env.DEV && (
          <p className="text-xs text-gray-500 mt-3">
            Tip: Copy the latest code from the <code>otp_tokens</code> table if SMS is disabled.
          </p>
        )}
      </form>
    </div>
  );
}

export default VerifyOtp;
