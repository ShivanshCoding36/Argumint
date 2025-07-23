import React from 'react';
import { FaLinkedin, FaEnvelope, FaYoutube } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-white py-12 px-6 border-t border-white/10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-8 text-sm text-slate-300">
        
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">ArguMint</h3>
          <p>Debate smarter, with AI-driven clarity.</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Legal</h3>
          <ul className="space-y-1">
            <li><a href="#" className="text-cyan-400 hover:underline">Privacy Policy</a></li>
            <li><a href="#" className="text-cyan-400 hover:underline">Terms & Conditions</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Founder</h3>
          <div className="flex items-center gap-4 mt-2">
            <a href="https://www.linkedin.com/in/ShivanshMathur9/" target="_blank" rel="noreferrer">
              <FaLinkedin className="hover:text-cyan-400" size={18} />
            </a>
            <a href="mailto:shivanshmathur221@gmail.com">
              <FaEnvelope className="hover:text-cyan-400" size={18} />
            </a>
            <a href="https://www.youtube.com/@shivanshmathur9" target="_blank" rel="noreferrer">
              <FaYoutube className="hover:text-cyan-400" size={20} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Connect With Us</h3>
          <div className="flex items-center gap-4 mt-2">
            <a href="https://youtube.com" target="_blank" rel="noreferrer">
              <FaYoutube className="hover:text-cyan-400" size={20} />
            </a>
            <a href="">
              <FaEnvelope className="hover:text-cyan-400" size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center text-xs text-slate-400">
        © 2025 ArguMint. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
