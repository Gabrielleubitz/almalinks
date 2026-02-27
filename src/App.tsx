import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PoweredByIgani from './components/PoweredByIgani';
import IganiWatermark from './components/IganiWatermark';
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
import RejectedPage from './pages/RejectedPage';
// Admin check-in: use EventManagement for manual check-in
import AdminEmail from './pages/admin/AdminEmail';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AddEvent from './pages/admin/AddEvent';
import EditEvent from './pages/admin/EditEvent';
import EventManagement from './pages/admin/EventManagement';
import EventRegistrationsPage from './pages/admin/EventRegistrationsPage';
import AdminCheckIn from './pages/admin/AdminCheckIn';
import UserManagement from './pages/admin/UserManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import PendingRegistrations from './pages/admin/PendingRegistrations';
import SystemTestPage from './pages/admin/SystemTestPage';
import HubSpotImportPage from './pages/admin/HubSpotImportPage';
import ConnectionManagement from './pages/admin/ConnectionManagement';
import AdminUserEdit from './pages/admin/AdminUserEdit';
import ActivityManagement from './pages/admin/ActivityManagement';
import AdminLayout from './components/admin/AdminLayout';
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
import { useAuth } from './hooks/useAuth';
import NetworkStatusIndicator from './components/ui/NetworkStatusIndicator';
import ActivityTracker from './components/ActivityTracker';
import OnboardingTour from './components/onboarding/OnboardingTour';

function App() {
  const { user, loading: authLoading } = useAuth();

  return (
    <Router>
      <ActivityTracker />
      <TermsGate user={user} authLoading={authLoading} />
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col">
          <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
        <Route path="/rejected" element={<RejectedPage />} />
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
        
        {/* Admin Routes — shared layout with sidebar */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="email" element={<AdminEmail />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="chats" element={<AdminChatManagement />} />
          <Route path="chats/create" element={<CreateChatGroup />} />
          <Route path="events" element={<EventManagement />} />
          <Route path="check-in" element={<AdminCheckIn />} />
          <Route path="events/create" element={<AddEvent />} />
          <Route path="events/add" element={<AddEvent />} />
          <Route path="events/:eventId/edit" element={<EditEvent />} />
          <Route path="event-registrations" element={<EventRegistrationsPage />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="pending-registrations" element={<PendingRegistrations />} />
          <Route path="pending" element={<PendingRegistrations />} />
          <Route path="connections" element={<ConnectionManagement />} />
          <Route path="activity" element={<ActivityManagement />} />
          <Route path="users/:userId/edit" element={<AdminUserEdit />} />
          <Route path="system-test" element={<SystemTestPage />} />
          <Route path="hubspot-import" element={<HubSpotImportPage />} />
        </Route>
        {/* Legacy routes - redirect to new format */}
        
        {/* Catch-all route for 404s */}
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {/* First-time onboarding overlay (modal + spotlight); only when user has not completed onboarding */}
        <OnboardingTour />
        <PoweredByIgani />
        {/* Igani watermark: always bottom-right on every page */}
        <IganiWatermark position="bottom-right" size="sm" opacity={0.3} />
      </div>
      
      {/* Network Status Indicator */}
      <NetworkStatusIndicator position="bottom-right" />
    </Router>
  );
}

// Only show terms modal for approved users on the dashboard (not pending users)
const TermsGate: React.FC<{ user: any; authLoading: boolean }> = ({
  user,
  authLoading,
}) => {
  const location = useLocation();
  const [showTermsModal, setShowTermsModal] = React.useState(false);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setShowTermsModal(false);
      return;
    }

    // Only show for approved users on the member dashboard
    const isApproved = user.status === 'approved';
    const path = (location && location.pathname) || '';
    const onDashboard = path === '/dashboard';

    if (!isApproved || !onDashboard) {
      setShowTermsModal(false);
      return;
    }

    if (!getTermsAgreed()) {
      setShowTermsModal(true);
    }
  }, [user, authLoading, location]);

  if (!showTermsModal || !user) return null;
  return <TermsAgreementModal onAgree={() => setShowTermsModal(false)} />;
};

export default App;