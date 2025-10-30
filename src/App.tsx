import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import MarqueeDemo from './components/MarqueeDemo';
import InThePress from './components/InThePress';
import Speakers from './components/Speakers';
import FloatingBubbles from './components/FloatingBubbles';
import UpcomingEvent from './components/UpcomingEvent';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import ChatWidget from './components/chat/ChatWidget';
import SpeakersPage from './pages/SpeakersPage';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import PendingPage from './pages/PendingPage';
// Removed QR-based AdminTools and AdminCheckIn - using EventManagement for manual check-in
import AdminSMS from './pages/admin/AdminSMS';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AddEvent from './pages/admin/AddEvent';
import EditEvent from './pages/admin/EditEvent';
import EventManagement from './pages/admin/EventManagement';
import SpeakerManagement from './pages/admin/SpeakerManagement';
import UserManagement from './pages/admin/UserManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import PendingRegistrations from './pages/admin/PendingRegistrations';
import SystemTestPage from './pages/admin/SystemTestPage';
import ConnectionManagement from './pages/admin/ConnectionManagement';
import AdminUserEdit from './pages/admin/AdminUserEdit';
import ProfileEditPage from './pages/ProfileEditPage';
// Removed badge generator functionality
import AdGenerator from './pages/admin/AdGenerator';
import ProfileSyncTools from './pages/admin/ProfileSyncTools';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ConnectPage from './pages/ConnectPage';
import UserProfilePage from './pages/UserProfilePage';
import MembersPage from './pages/MembersPage';
import ChatsPage from './pages/ChatsPage';
import ChatViewPage from './pages/ChatViewPage';
import DiscoverChatsPage from './pages/DiscoverChatsPage';
import CreateChatGroup from './pages/admin/CreateChatGroup';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthWrapper from './components/auth/AuthWrapper';
import NetworkStatusIndicator from './components/ui/NetworkStatusIndicator';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Home page component
const HomePage = () => (
  <div className="min-h-screen bg-white">
    <Header />
    <Hero />
    <About />
    <MarqueeDemo />
    <InThePress />
    <Speakers />
    <FloatingBubbles />
    <UpcomingEvent />
    <FAQ />
    <Footer />
    <ChatWidget />
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/speakers" element={<SpeakersPage />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        {/* Connection Route */}
        <Route path="/connect" element={<ConnectPage />} />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/events" 
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/events/:slug" 
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/complete-profile" 
          element={
            <ProtectedRoute>
              <CompleteProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/edit" 
          element={
            <ProtectedRoute>
              <ProfileEditPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/members" 
          element={
            <ProtectedRoute>
              <MembersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/chats" 
          element={
            <ProtectedRoute>
              <ChatsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/chats/:chatId" 
          element={
            <ProtectedRoute>
              <ChatViewPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/discover-chats" 
          element={
            <ProtectedRoute>
              <DiscoverChatsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Routes */}
        <Route 
          path="/admin/sms" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSMS />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/announcements" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAnnouncements />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/chats/create" 
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateChatGroup />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/events" 
          element={
            <ProtectedRoute requiredRole="admin">
              <EventManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/events/create" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AddEvent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/events/add" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AddEvent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/events/:eventId/edit" 
          element={
            <ProtectedRoute requiredRole="admin">
              <EditEvent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/speakers" 
          element={
            <ProtectedRoute requiredRole="admin">
              <SpeakerManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/pending-registrations" 
          element={
            <ProtectedRoute requiredRole="admin">
              <PendingRegistrations />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/pending" 
          element={
            <ProtectedRoute requiredRole="admin">
              <PendingRegistrations />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/connections" 
          element={
            <ProtectedRoute requiredRole="admin">
              <ConnectionManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users/:userId/edit" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUserEdit />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/system-test" 
          element={
            <ProtectedRoute requiredRole="admin">
              <SystemTestPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        {/* Removed badge generator routes */}
        <Route 
          path="/admin/ad-generator" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdGenerator />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/profile-sync" 
          element={
            <ProtectedRoute requiredRole="admin">
              <ProfileSyncTools />
            </ProtectedRoute>
          } 
        />
        
        {/* Legacy routes - redirect to new format */}
        
        {/* Catch-all route for 404s */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Network Status Indicator */}
      <NetworkStatusIndicator position="bottom-right" />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </Router>
  );
}

export default App;