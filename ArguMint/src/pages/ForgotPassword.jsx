import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) return alert(error.message);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-semibold mb-6">Reset password</h1>
      <input
        type="email" placeholder="Enter your email"
        value={email} onChange={e => setEmail(e.target.value)}
        className="w-full max-w-md p-3 rounded-lg bg-slate-800 mb-4"
      />
      <button
        onClick={handleReset}
        disabled={sent}
        className="w-full max-w-md px-4 py-2 bg-teal-500 rounded-lg font-medium"
      >
        {sent ? 'Check your inbox' : 'Send reset link'}
      </button>
    </div>
  );
}
