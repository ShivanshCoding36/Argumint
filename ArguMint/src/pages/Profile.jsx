import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Profile() {
  const [debates, setDebates] = useState([]);
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [editing, setEditing] = useState(false);
  const [opponentNames, setOpponentNames] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, interests')
        .eq('id', user.id)
        .single();

      if (profile) {
        setName(profile.name || '');
        setInterest((profile.interests && profile.interests[0]) || '');
      }

      const { data: debatesData } = await supabase
        .from('debates')
        .select('*')
        .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`);

      const opponentIds = debatesData.map(d =>
        d.user_id_a === user.id ? d.user_id_b : d.user_id_a
      ).filter(Boolean);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', opponentIds);

      const opponentMap = {};
      profiles?.forEach(p => opponentMap[p.id] = p.name);

      setOpponentNames(opponentMap);
      setDebates(debatesData || []);
    };

    fetchUserData();
  }, []);

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ name, interests: [interest] })
      .eq('id', user.id);

    if (error) {
      alert('Failed to update profile: ' + error.message);
    } else {
      setEditing(false);
      alert('Profile updated!');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 flex items-center justify-center px-6 py-16"
    >
      <h1 className="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">
        Your Profile
      </h1>

      <div className="bg-white/10 p-6 rounded-xl border border-white/20 mb-10 max-w-xl">
        {editing ? (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full mb-3 p-3 bg-slate-800 rounded-lg text-white"
            />
            <input
              type="text"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="Your interest (e.g. AI)"
              className="w-full mb-3 p-3 bg-slate-800 rounded-lg text-white"
            />
            <button
              onClick={handleUpdate}
              className="bg-teal-500 px-4 py-2 rounded-lg text-white font-semibold mr-4"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-slate-400 underline"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="text-lg mb-2"><strong>Name:</strong> {name}</p>
            <p className="text-lg mb-4"><strong>Interest:</strong> {interest}</p>
            <button
              onClick={() => setEditing(true)}
              className="bg-teal-500 px-4 py-2 rounded-lg text-white font-semibold"
            >
              Edit Profile
            </button>
          </>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4 text-cyan-300">Your Debate History</h2>
      <div className="space-y-4">
        {debates.map((d, i) => {
          const isWinner = d.winner === user.id;
          const opponentId = d.user_id_a === user.id ? d.user_id_b : d.user_id_a;
          const opponentName = opponentNames[opponentId] || 'Opponent';
          return (
            <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/20">
              <h2 className="text-lg text-cyan-300 font-bold">{d.topic}</h2>
              <p className="text-sm mt-1 text-slate-300">
                Winner: {isWinner ? 'You' : opponentName}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Your Score: {user.id === d.user_id_a ? d.score_a : d.score_b} | 
                Opponent Score: {user.id === d.user_id_a ? d.score_b : d.score_a}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
