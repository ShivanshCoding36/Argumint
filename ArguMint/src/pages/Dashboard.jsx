import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [debateCount, setDebateCount] = useState(0);
  const [wins, setWins] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data: debates } = await supabase
        .from('debates')
        .select('user_id_a, user_id_b, winner');

      const total = debates.filter(d => d.user_id_a === user.id || d.user_id_b === user.id).length;
      const won = debates.filter(d => {
        return (d.user_id_a === user.id && d.winner === d.user_id_a) ||
               (d.user_id_b === user.id && d.winner === d.user_id_b);
      }).length;

      setDebateCount(total);
      setWins(won);
    };

    fetchStats();
  }, []);

  const stats = [
    { icon: '📊', label: 'Debates', value: debateCount },
    { icon: '🏆', label: 'Wins', value: wins },
  ];

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 flex items-center justify-center px-6 py-16"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-4xl w-full text-center">
        <motion.h1
          className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-400 tracking-tight mb-12"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Your Dashboard
        </motion.h1>

        <div className="grid sm:grid-cols-2 gap-6">
          {stats.map((item, idx) => (
            <motion.div
              key={idx}
              className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg hover:shadow-teal-400/40"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.15 }}
              whileHover={{ y: -5, transition: { duration: 0.15 } }}
            >
              <div className="text-4xl mb-2">{item.icon}</div>
              <h3 className="text-lg font-semibold text-white">{item.label}</h3>
              <p className="text-3xl font-bold text-cyan-300">{item.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
