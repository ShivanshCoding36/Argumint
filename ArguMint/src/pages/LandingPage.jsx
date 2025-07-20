import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
const features = [
  { title: 'Live AI Debates', description: 'Engage in live debates against adaptive AI.', icon: '🧠' },
  { title: 'Real-time Transcription', description: 'Every word is transcribed with whisper-accuracy.', icon: '🎙️' },
  { title: 'Judging + Feedback', description: 'AI judges your logic, clarity, and structure.', icon: '⚖️' }
];

export default function LandingPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 flex items-center justify-center px-6 py-16"
    >
      <div className="max-w-3xl w-full text-center">
        <motion.h1
          className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-400 bg-clip-text text-transparent mb-4 tracking-tight animate-pulse"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          Welcome to ArguMint
        </motion.h1>

        <motion.p
          className="text-slate-300 text-lg sm:text-xl font-light mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Sharpen your wit, anytime, anywhere.
        </motion.p>
<Link to="/debate-select">
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="px-8 py-4 bg-gradient-to-r from-sky-500 to-teal-400 text-white font-semibold text-lg rounded-xl shadow-md hover:shadow-cyan-400 transition-all"
        >
           
                     
                   
          Start Debating 
        </motion.button></Link>

        <div className="mt-20 grid sm:grid-cols-3 gap-6">
          {features.map((card, idx) => (
            <motion.div
              key={idx}
              className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg hover:shadow-teal-500/30"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + idx * 0.15, duration: 0.6 }} // Added duration for initial animation
              whileHover={{
                y: -5, // Lift up
                // Explicitly define a quick transition for whileHover
                transition: {
                  type: "tween", // Use a tween for predictable, linear motion
                  duration: 0.1, // Very short duration for immediate feel
                  ease: "easeOut" // Smooth deceleration
                }
              }}
            >
              <div className="text-3xl mb-2">{card.icon}</div>
              <h2 className="text-white text-lg font-semibold">{card.title}</h2>
              <p className="text-slate-300 mt-1 text-sm">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}