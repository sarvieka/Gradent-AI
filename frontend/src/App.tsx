import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider } from './context/SidebarContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import NewGrading from './pages/NewGrading';
import GradingReview from './pages/GradingReview';
import History from './pages/History';

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <Router>
          <Routes>
            {/* Public authentication routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected application routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <NewGrading />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/:id"
              element={
                <ProtectedRoute>
                  <GradingReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <GradingReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SidebarProvider>
    </AuthProvider>
  );
}
