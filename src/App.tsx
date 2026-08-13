/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './components/FirebaseProvider';
import { Loader2 } from 'lucide-react';

// Page imports
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import SkillExchange from './pages/SkillExchange';
import Interview from './pages/Interview';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Materials from './pages/Materials';
import Reviews from './pages/Reviews';
import Premium from './pages/Premium';
import Achievements from './pages/Achievements';

function LoadingScreen({ message = "Initializing SkillX..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthReady } = useAuth();

  if (!isAuthReady || loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthReady, loading } = useAuth();

  if (!isAuthReady || loading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen message="Loading page..." />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/exchange" element={<SkillExchange />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/achievements" element={<Achievements />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}



