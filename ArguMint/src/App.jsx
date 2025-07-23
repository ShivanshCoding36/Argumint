import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ResultScreen from './pages/ResultScreen';
import NotFound from './pages/NotFound';
import DebateSelect from './pages/DebateSelect';
import HumanDebateRoom from './pages/HumanDebateRoom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DebateRoom from './pages/DebateRoom'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Navbar from './components/Navbar';
import ProtectedPage from './components/ProtectedPage';
import TopicGenerator from './pages/TopicGenerator';
import RealtimeTestComponent from './pages/testMessaging';
import WhisperUploader from './components/WhisperUploader';
import AssemblyTest from './pages/test_assembly';
import Footer from './components/Footer';

export default function App() {
  return (
    <>
    <Navbar/>
    <Routes>
      
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<ProtectedPage><Dashboard/></ProtectedPage>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/profile" element={<ProtectedPage><Profile /></ProtectedPage>} />
      <Route path="/debate" element={<ProtectedPage><DebateRoom /></ProtectedPage>} />
      <Route path="/results" element={<ProtectedPage><ResultScreen /></ProtectedPage>} />
      <Route path="/debate-select" element={<ProtectedPage><DebateSelect /></ProtectedPage>} />
      <Route path="/debate-human/:roomId" element={<ProtectedPage><HumanDebateRoom /></ProtectedPage>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/generate-topic" element={<TopicGenerator />} />
      <Route path="/test" element={<WhisperUploader />} />
      <Route path="/test2" element={<AssemblyTest />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <Footer />
    </>
  );
}
