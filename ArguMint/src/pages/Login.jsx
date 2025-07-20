import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return alert(error.message);
    navigate('/dashboard');
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 text-white p-6"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h1
        className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 text-transparent bg-clip-text mb-4"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Login to ArguMint
      </motion.h1>

      <motion.p
        className="mb-6 text-slate-300 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Enter your credentials to continue.
      </motion.p>

      <motion.div
        className="flex flex-col w-full max-w-md space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="p-3 rounded-lg bg-slate-800"
          whileFocus={{ scale: 1.02 }}
        />

        <motion.input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="p-3 rounded-lg bg-slate-800"
          whileFocus={{ scale: 1.02 }}
        />

        <motion.button
          onClick={handleLogin}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg font-semibold hover:shadow-xl transition-all"
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03 }}
        >
          {loading ? 'Logging in...' : 'Log in'}
        </motion.button>
      </motion.div>

      <motion.p
        className="mt-4 text-sm text-slate-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        Don’t have an account?{' '}
        <Link to="/signup" className="text-cyan-400 hover:underline">
          Sign up here
        </Link>
      </motion.p>

      <motion.p
        className="mt-2 text-sm text-slate-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Forgot your password?{' '}
        <Link to="/forgot-password" className="text-cyan-400 hover:underline">
          Reset it
        </Link>
      </motion.p>
    </motion.div>
  );
}
