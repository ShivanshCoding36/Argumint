import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  const submit = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return alert(error.message);
    alert('Password updated! Please log in.');
    navigate('/login');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/login');
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-semibold mb-6">Set new password</h1>
      <input
        type="password" placeholder="New password"
        value={newPassword} onChange={e => setNewPassword(e.target.value)}
        className="w-full max-w-md p-3 rounded-lg bg-slate-800 mb-4"
      />
      <button
        onClick={submit}
        className="w-full max-w-md px-4 py-2 bg-teal-500 rounded-lg font-medium"
      >
        Update password
      </button>
    </div>
  );
}
