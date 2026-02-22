import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import MarqueeDemo from './components/MarqueeDemo';
import InThePress from './components/InThePress';
import UpcomingEvent from './components/UpcomingEvent';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import PoweredByIgani from './components/PoweredByIgani';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import PendingPage from './pages/PendingPage';
import ReRequestAccessPage from './pages/ReRequestAccessPage';
// Admin check-in: use EventManagement for manual check-in
import AdminEmail from './pages/admin/AdminEmail';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AddEvent from './pages/admin/AddEvent';
import EditEvent from './pages/admin/EditEvent';
import EventManagement from './pages/admin/EventManagement';
import UserManagement from './pages/admin/UserManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import PendingRegistrations from './pages/admin/PendingRegistrations';
import SystemTestPage from './pages/admin/SystemTestPage';
import HubSpotImportPage from './pages/admin/HubSpotImportPage';
import ConnectionManagement from './pages/admin/ConnectionManagement';
import AdminUserEdit from './pages/admin/AdminUserEdit';
import ActivityManagement from './pages/admin/ActivityManagement';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ConnectPage from './pages/ConnectPage';
import UserProfilePage from './pages/UserProfilePage';
import MembersPage from './pages/MembersPage';
import ChatsPage from './pages/ChatsPage';
import ChatViewPage from './pages/ChatViewPage';
import DiscoverChatsPage from './pages/DiscoverChatsPage';
import CreateChatGroup from './pages/admin/CreateChatGroup';
import AdminChatManagement from './pages/admin/AdminChatManagement';
import ThemePreview from './pages/ThemePreview';
import HelpPage from './pages/HelpPage';
import TermsPage from './pages/TermsPage';
import TermsAgreementModal, { getTermsAgreed } from './components/TermsAgreementModal';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthWrapper from './components/auth/AuthWrapper';
import NetworkStatusIndicator from './components/ui/NetworkStatusIndicator';
import ActivityTracker from './components/ActivityTracker';
import OnboardingTour from './components/onboarding/OnboardingTour';

// Home page component
const HomePage = () => (
  <div className="min-h-screen bg-white">
    <Header />
    <Hero />
    <About />
    <MarqueeDemo />
    <InThePress />
    <UpcomingEvent />
    <FAQ />
    <Footer />
  </div>
);

function App() {
  const [showTermsModal, setShowTermsModal] = React.useState(false);

  React.useEffect(() => {
    if (!getTermsAgreed()) {
      setShowTermsModal(true);
    }
  }, []);

  return (
    <Router>
      <ActivityTracker />
      {showTermsModal && (
        <TermsAgreementModal onAgree={() => setShowTermsModal(false)} />
      )}
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col">
          <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/theme-preview" element={<ThemePreview />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/terms" element={<TermsPage />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/re-request-access" element={<ReRequestAccessPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        {/* Connection Route */}
        <Route path="/connect" element={<ConnectPage />} />
        
        {/* Legacy /welcome: redirect to dashboard; onboarding tour overlay shows for first-time users */}
        <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />
        
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
          path="/admin/email" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminEmail />
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
          path="/admin/chats" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminChatManagement />
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
          path="/admin/activity" 
          element={
            <ProtectedRoute requiredRole="admin">
              <ActivityManagement />
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
          path="/admin/hubspot-import" 
          element={
            <ProtectedRoute requiredRole="admin">
              <HubSpotImportPage />
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
        {/* Legacy routes - redirect to new format */}
        
        {/* Catch-all route for 404s */}
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {/* First-time onboarding overlay (modal + spotlight); only when user has not completed onboarding */}
        <OnboardingTour />
        <PoweredByIgani />
      </div>
      
      {/* Network Status Indicator */}
      <NetworkStatusIndicator position="bottom-right" />
    </Router>
  );
}

export default App;