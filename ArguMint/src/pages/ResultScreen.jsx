import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

function ProtectedPage({ children }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/login');
    });
  }, []);
  return children;
}

export default function ResultScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [opponent, setOpponent] = useState('Opponent');

  const { winner, score, feedback, isHumanDebate, usernames } = state || {};

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || '');

      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (data?.username) setUsername(data.username);
      }
    };

    fetchUser();
  }, []);

  const debaters = isHumanDebate
    ? [
        { label: usernames?.A === username ? 'You' : usernames?.A, key: 'debaterA' },
        { label: usernames?.B === username ? 'You' : usernames?.B, key: 'debaterB' }
      ]
    : [
        { label: 'You', key: 'debaterA' },
        { label: 'AI', key: 'debaterB' }
      ];

  const winnerDisplay = () => {
    if (!winner) return 'Unknown';
    if (isHumanDebate) {
      return usernames?.A === winner ? debaters[0].label : debaters[1].label;
    }
    return winner === 'debaterA' ? 'You' : 'AI';
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-6 py-16 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-sky-400 mb-8">
        Judging Results
      </h1>

      <p className="text-center text-xl mb-10">
        🏆 <strong>{winnerDisplay()}</strong> wins the debate!
      </p>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {debaters.map(({ label, key }, i) => (
          <motion.div
            key={key}
            className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20 shadow-md hover:shadow-teal-400/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
          >
            <h2 className="text-xl font-semibold">{label}</h2>
            <p className="text-cyan-300 text-lg">Score: {score?.[key]}</p>
            <p className="text-slate-300 text-sm mt-2">{feedback?.[key]}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
