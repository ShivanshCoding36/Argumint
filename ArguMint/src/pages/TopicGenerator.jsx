import { supabase } from '../lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export default function TopicGenerator() {
  const [interest, setInterest] = useState('Technology');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDebateOptions, setShowDebateOptions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInterest = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      const { data } = await supabase
        .from('profiles')
        .select('interests')
        .eq('id', user.id)
        .single();

      const firstInterest = data?.interests?.[0] || 'Technology';
      setInterest(firstInterest);
    };

    fetchInterest();
  }, []);

  const fetchTopic = async () => {
  setLoading(true);
  try {
    const res = await fetch('http://localhost:3000/api/generate-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest })
    });
    const data = await res.json();
    setTopic(data.topic || 'Failed to generate topic. Try again.');
    sessionStorage.setItem('currentTopic', data.topic); // Save topic persistently
  } catch (err) {
    console.error('Topic generation failed:', err);
    setTopic('Error generating topic.');
  } finally {
    setLoading(false);
    setShowDebateOptions(true);

  }
};

  const startHumanDebate = () => {
    const roomId = uuidv4();
    navigate(`/debate-human/${roomId}`);
  };

  const startAIDebate = () => {
    navigate('/debate');
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-6 py-20 flex flex-col items-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.h1
        className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300 mb-12 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Generate a Debate Topic
      </motion.h1>

      <motion.div
        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl max-w-2xl w-full text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-lg text-cyan-300 mb-4">
          Based on your interest in <span className="font-semibold text-white">{interest}</span>
        </p>

        <div className="text-2xl font-semibold text-white mb-6">
          {loading ? 'Generating...' : topic || 'Click generate to get started'}
        </div>

        <button
          onClick={fetchTopic}
          className="px-6 py-3 mb-4 rounded-lg font-semibold bg-teal-500 hover:bg-teal-600 transition"
        >
          {topic ? 'Regenerate Topic 🔄' : 'Generate Topic 🎯'}
        </button>

        {/* Slide-in debate options */}
        <AnimatePresence>
          {showDebateOptions && (
            <motion.div
              className="flex flex-col md:flex-row gap-4 justify-center mt-6"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
            >
              <button
                onClick={startAIDebate}
                className="px-6 py-3 rounded-lg font-semibold bg-cyan-500 hover:bg-cyan-600 transition"
              >
                Debate with AI 🤖
              </button>
              <button
                onClick={startHumanDebate}
                className="px-6 py-3 rounded-lg font-semibold bg-sky-500 hover:bg-sky-600 transition"
              >
                Debate with Human 👥
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
