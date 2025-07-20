import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 text-white text-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div>
        <h1 className="text-6xl font-extrabold bg-gradient-to-r from-red-500 via-yellow-500 to-pink-500 bg-clip-text text-transparent">
          404
        </h1>
        <p className="text-xl mt-4 text-slate-300">Oops! Page not found.</p>
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="px-8 py-4 bg-gradient-to-r from-sky-500 to-teal-400 text-white font-semibold text-lg rounded-xl shadow-md hover:shadow-cyan-400 transition-all m-8"
        
        ><a href="/">
          Home</a>
        </motion.button>
      </div>
    </motion.div>
  );
}
