import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [name_, setname_] = useState('');
  const [password, setPassword] = useState('');
  const [interest, setInterest] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setLoading(false);
      return alert(error.message);
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from('profiles').insert({
        id: userId,
        name: name_,
        interests: [interest.trim()]
      });
    }

    alert('Signup successful! You can now log in.');
    navigate('/login');
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 text-white p-6"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h1
        className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 text-transparent bg-clip-text mb-6"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Sign up to ArguMint
      </motion.h1>

      <motion.div
        className="flex flex-col w-full max-w-md space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
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
          type="text"
          placeholder="Name"
          value={name_}
          onChange={e => setname_(e.target.value)}
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
        <motion.input
          type="text"
          placeholder="Your interest (e.g. AI, Ethics, Climate)"
          value={interest}
          onChange={e => setInterest(e.target.value)}
          className="p-3 rounded-lg bg-slate-800"
          whileFocus={{ scale: 1.02 }}
        />

        <motion.button
          onClick={handleSignup}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg font-semibold hover:shadow-xl transition-all"
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03 }}
        >
          {loading ? 'Signing up...' : 'Sign up'}
        </motion.button>
      </motion.div>

      <motion.p
        className="mt-4 text-sm text-slate-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Already have an account?{' '}
        <Link to="/login" className="text-cyan-400 hover:underline">
          Log in here
        </Link>
      </motion.p>
    </motion.div>
  );
}
