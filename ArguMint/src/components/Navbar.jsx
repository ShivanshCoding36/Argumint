import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBrain, FaUserCircle } from 'react-icons/fa';

export default function Navbar() {
  const [showDebateDropdown, setShowDebateDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null); // To store user ID for profile lookup
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async (id) => {
      if (!id) {
        setUsername('');
        return;
      }
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
          console.error('Error fetching profile:', error);
          setUsername('');
        } else if (profile) {
          setUsername(profile.name);
        } else {
          setUsername(''); // No profile found for the user ID
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setUsername('');
      }
    };

    // Initial check for the user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchUserProfile(user.id);
      } else {
        setUserId(null);
        setUsername('');
      }
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          fetchUserProfile(session.user.id);
        } else {
          // User logged out or session expired
          setUserId(null);
          setUsername('');
        }
      }
    );

    // Cleanup the subscription on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      // Supabase's onAuthStateChange will handle setting username/userId to null
      navigate('/login');
    }
  };

  return (
    <nav className="w-full bg-slate-900 text-white px-6 py-3 shadow-md border-b border-cyan-700/30 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo + Name */}
        <Link to="/" className="flex items-center space-x-2 text-cyan-300 font-bold text-xl">
          <FaBrain className="text-cyan-400 text-2xl" />
          <span>ArguMint</span>
        </Link>

        {/* Center: Nav Items */}
        <div className="hidden md:flex space-x-6 items-center relative">
          <Link to="/" className="hover:text-cyan-400 transition">
            Home
          </Link>
          {/* Debate Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setShowDebateDropdown(true)}
            onMouseLeave={() => setShowDebateDropdown(false)}
          >
            {/* The Link for "Debate" itself, without making it a dropdown toggle text */}
            <Link
                    to="/debate-select"
                    className="block mx-4 my-2 rounded text-sm hover:text-cyan-400 transition"
                  >
              Debate ▾
           </Link>
            <AnimatePresence>
              {showDebateDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-8 left-0 bg-slate-800 border border-white/10 rounded-md shadow-md p-2 z-50 min-w-[140px]"
                >
                  <Link
                    to="/debate"
                    className="block px-4 py-2 hover:bg-slate-700 rounded text-sm"
                  >
                    Debate vs AI
                  </Link>
                  <Link
                    to="/debate-select"
                    className="block px-4 py-2 hover:bg-slate-700 rounded text-sm"
                  >
                    Debate vs Human
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link to="/generate-topic" className="hover:text-cyan-400 transition">
            Topic Generator
          </Link>
          <Link to="/dashboard" className="hover:text-cyan-400 transition">
            Dashboard
          </Link>
        </div>

        {/* Right: Profile Dropdown */}
        {username ? (
          <div
            className="relative cursor-pointer"
            onMouseEnter={() => setShowProfileDropdown(true)}
            onMouseLeave={() => setShowProfileDropdown(false)}
          >
            <div className="flex items-center space-x-2">
              <FaUserCircle className="text-2xl text-cyan-300" />
              <span className="text-sm text-slate-300 hidden sm:inline">
                {username}
              </span>
            </div>

            <AnimatePresence>
              {showProfileDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-10 right-0 bg-slate-800 border border-white/10 rounded-md shadow-md p-2 z-50 min-w-[140px]"
                >
                  <Link
                    to="/profile"
                    className="block px-4 py-2 hover:bg-slate-700 rounded text-sm"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 rounded text-sm"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          // Show login/signup links if not logged in
          <div className="flex items-center space-x-4">
            <Link to="/login" className="hover:text-cyan-400 transition">
              Login
            </Link>
            <Link to="/signup" className="hover:text-cyan-400 transition">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}