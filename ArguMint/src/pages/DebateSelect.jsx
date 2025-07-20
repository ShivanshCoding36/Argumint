import React from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function ProtectedPage({ children }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/login');
    });
  }, []);
  return children;
}


export default function DebateSelect() {
  const navigate = useNavigate();

  const handleAIMode = () => {
    navigate('/debate'); // route to AI-based debate
  };

  const handleHumanMode = () => {
    const roomId = uuidv4(); // generate unique room
    navigate(`/debate-human/${roomId}`);
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-6 py-20 flex flex-col items-center justify-center text-white"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.h1
        className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Choose Your Debate Mode
      </motion.h1>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-lg cursor-pointer transition"
          onClick={handleAIMode}
        >
          <h2 className="text-2xl font-bold text-cyan-300 mb-2">🤖 Debate with AI</h2>
          <p className="text-slate-300">Go head-to-head with our GPT-powered debate engine. Perfect for practice!</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-lg cursor-pointer transition"
          onClick={handleHumanMode}
        >
          <h2 className="text-2xl font-bold text-cyan-300 mb-2">👥 Debate with a Friend</h2>
          <p className="text-slate-300">Create a room and invite a friend to challenge you live.</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
