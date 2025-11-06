import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight, Clock, Users, RotateCcw, User, Mail, Phone, Briefcase, Ticket, Download, Edit, Save, X, Check, AlertCircle, ChevronDown, Linkedin, Globe, Twitter, CheckCircle, TrendingUp, MessageCircle, Compass, Map, Heart } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { EventService, EventData } from '../services/eventService';
import { ConnectionService } from '../services/connectionService';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import Header from '../components/Header';
import Footer from '../components/Footer';
import IganiWatermark from '../components/IganiWatermark';
import AnnouncementsSidebar from '../components/announcements/AnnouncementsSidebar';
import ConnectionsCard from '../components/dashboard/ConnectionsCard';
import ProfilePictureUploader from '../components/profile/ProfilePictureUploader';

// Country codes data for phone editing
const COUNTRY_CODES = [
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+852', name: 'Hong Kong', flag: '🇭🇰' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
];

// Position options
const POSITION_OPTIONS = [
  { value: 'investor', label: 'Investor' },
  { value: 'c_level', label: 'C-Level Executive (CEO, CTO, etc.)' },
  { value: 'vp_level', label: 'VP Level' },
  { value: 'director', label: 'Director' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_contributor', label: 'Senior Contributor' },
  { value: 'individual_contributor', label: 'Individual Contributor' },
  { value: 'junior_level', label: 'Junior Level' },
  { value: 'founder', label: 'Founder' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'student', label: 'Student' },
  { value: 'other', label: 'Other' }
];

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  
  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    work: '',
    company: '',
    linkedinUsername: '',
    position: '',
    bioTitle: '',
    bio: '',
    city: '',
    country: '',
    timezone: '',
    website: '',
    twitter: '',
    skills: [] as string[]
  });
  const [skillsInputValue, setSkillsInputValue] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+972');
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { user, isAdmin, isInUserView, switchToAdminView, updateProfile } = useAuth();
  const profileSectionRef = useRef<HTMLDivElement>(null);

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    if (!user) return { percentage: 0, missingFields: [], completedFields: 0, totalFields: 0 };

    const profileFields = [
      { field: 'displayName', label: 'Full Name', value: user.displayName, required: true },
      { field: 'email', label: 'Email Address', value: user.email, required: true },
      { field: 'phone', label: 'Phone Number', value: user.phone, required: true },
      { field: 'work', label: 'Job Title', value: user.work, required: true },
      { field: 'company', label: 'Company', value: user.company, required: false },
      { field: 'linkedinUsername', label: 'LinkedIn Profile', value: user.linkedinUsername, required: true },
      { field: 'position', label: 'Position Level', value: user.position, required: true },
      { field: 'profileImage', label: 'Profile Picture', value: user.profileImage, required: false },
      { field: 'bioTitle', label: 'Professional Bio Title', value: user.bioTitle, required: false },
      { field: 'bio', label: 'Personal Bio', value: user.bio, required: false },
      { field: 'city', label: 'City', value: user.city, required: false },
      { field: 'country', label: 'Country', value: user.country, required: false },
      { field: 'timezone', label: 'Timezone', value: user.timezone, required: false },
      { field: 'website', label: 'Website', value: user.website, required: false },
      { field: 'twitter', label: 'Twitter/X Username', value: user.twitter, required: false },
      { field: 'skills', label: 'Skills & Expertise', value: user.skills && user.skills.length > 0, required: false }
    ];

    const requiredFields = profileFields.filter(f => f.required);
    const optionalFields = profileFields.filter(f => !f.required);

    const completedRequired = requiredFields.filter(f => f.value && f.value.toString().trim() !== '').length;
    const completedOptional = optionalFields.filter(f => f.value && (typeof f.value === 'boolean' ? f.value : f.value.toString().trim() !== '')).length;

    const totalCompleted = completedRequired + completedOptional;
    const totalFields = profileFields.length;

    // Calculate percentage
    const percentage = Math.round((totalCompleted / totalFields) * 100);

    // Identify missing fields (prioritize required fields)
    const missingRequired = requiredFields
      .filter(f => !f.value || f.value.toString().trim() === '')
      .map(f => f.label);

    const missingOptional = optionalFields
      .filter(f => !f.value || (typeof f.value === 'boolean' ? !f.value : f.value.toString().trim() === ''))
      .map(f => f.label);

    return {
      percentage,
      missingFields: [...missingRequired, ...missingOptional],
      missingRequired,
      missingOptional,
      completedFields: totalCompleted,
      totalFields
    };
  };

  const profileCompletion = calculateProfileCompletion();

  useEffect(() => {
    loadPublicEvents();
    if (user?.uid) {
      loadUserRegistrations();
      loadConnectionsCount();
    }
  }, [user]);

  // Load user connections count
  const loadConnectionsCount = async () => {
    if (!user?.uid) return;

    try {
      const userConnections = await ConnectionService.getUserConnectionsLegacy(user.uid);
      setConnectionsCount(userConnections.length);
    } catch (error) {
      console.error('❌ Error loading connections count:', error);
      setConnectionsCount(0);
    }
  };

  // Initialize edit form data when user data changes
  useEffect(() => {
    if (user && !isEditingProfile) {
      const { countryCode, phoneNumber } = parseExistingPhone(user.phone || '');
      setEditFormData({
        name: user.displayName || '',
        email: user.email || '',
        phoneNumber: phoneNumber,
        work: user.work || '',
        company: user.company || '',
        linkedinUsername: user.linkedinUsername || '',
        position: user.position || '',
        bioTitle: user.bioTitle || '',
        bio: user.bio || '',
        city: user.city || '',
        country: user.country || '',
        timezone: user.timezone || '',
        website: user.website || '',
        twitter: user.twitter || '',
        skills: user.skills || []
      });
      setSkillsInputValue((user.skills || []).join(', '));
      setSelectedCountryCode(countryCode);
      setProfileImageUrl(user.profileImage || null);
    }
  }, [user, isEditingProfile]);

  // Parse existing phone number to extract country code and number
  const parseExistingPhone = (phone: string) => {
    if (!phone) return { countryCode: '+972', phoneNumber: '' };
    
    // Find matching country code
    const matchingCountry = COUNTRY_CODES.find(country => phone.startsWith(country.code));
    
    if (matchingCountry) {
      return {
        countryCode: matchingCountry.code,
        phoneNumber: phone.substring(matchingCountry.code.length)
      };
    }
    
    // Default fallback
    return { countryCode: '+972', phoneNumber: phone.replace(/^\+/, '') };
  };

  const formatPhoneNumber = (countryCode: string, phoneInput: string): string => {
    if (!phoneInput) return '';
    
    let cleanPhone = phoneInput.replace(/\D/g, '');
    
    // Remove leading zero if country code is included
    if (cleanPhone.startsWith('0') && countryCode) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    // Combine country code with phone number
    const fullNumber = `${countryCode}${cleanPhone}`;
    
    // Validate E.164 format (starts with + followed by digits only)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(fullNumber)) {
      throw new Error('Invalid phone number format');
    }
    
    return fullNumber;
  };

  const loadPublicEvents = async () => {
    try {
      const eventsData = await EventService.getPublicEvents();
      // getPublicEvents already filters out non-active events
      setEvents(eventsData);
    } catch (error) {
      console.error('❌ Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRegistrations = async () => {
    if (!user?.uid) return;
    
    try {
      setRegistrationsLoading(true);
      const registrations = [];
      
      // Check each event for user registration
      for (const event of events) {
        const registration = await EventService.getUserRegistration(event.id, user.uid);
        if (registration) {
          registrations.push({
            ...registration,
            eventId: event.id,
            eventName: event.name,
            eventDate: event.date,
            eventLocation: event.location,
            eventImage: event.imageUrl,
            eventSlug: event.slug // Add slug for navigation
          });
        }
      }
      
      setUserRegistrations(registrations);
    } catch (error) {
      console.error('❌ Error loading user registrations:', error);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Reload registrations when events are loaded
  useEffect(() => {
    if (events.length > 0 && user?.uid) {
      loadUserRegistrations();
    }
  }, [events, user?.uid]);

  // Handle edit profile form changes
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // For phone number, only allow digits
    if (name === 'phoneNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      setEditFormData(prev => ({
        ...prev,
        [name]: digitsOnly
      }));
    } else {
      setEditFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle skills input with real-time parsing
  const handleSkillsInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSkillsInputValue(value);
    
    // Parse skills in real-time
    const skillsArray = value
      .split(/[,;\n]/) // Split on comma, semicolon, or newline
      .map(skill => skill.trim())
      .filter(skill => skill);
    
    setEditFormData(prev => ({
      ...prev,
      skills: skillsArray
    }));
  };

  // Start editing profile
  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setProfileUpdateError(null);
    setProfileUpdateSuccess(null);
  };

  // Scroll to profile section and enable editing
  const scrollToProfile = () => {
    setIsEditingProfile(true);
    setProfileUpdateError(null);
    setProfileUpdateSuccess(null);
    setTimeout(() => {
      profileSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  // Cancel editing profile
  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileUpdateError(null);
    setProfileUpdateSuccess(null);
    // Reset form data to original values
    if (user) {
      const { countryCode, phoneNumber } = parseExistingPhone(user.phone || '');
      setEditFormData({
        name: user.displayName || '',
        email: user.email || '',
        phoneNumber: phoneNumber,
        work: user.work || '',
        company: user.company || '',
        linkedinUsername: user.linkedinUsername || '',
        position: user.position || '',
        bioTitle: user.bioTitle || '',
        bio: user.bio || '',
        city: user.city || '',
        country: user.country || '',
        timezone: user.timezone || '',
        website: user.website || '',
        twitter: user.twitter || '',
        skills: user.skills || []
      });
      setSkillsInputValue((user.skills || []).join(', '));
      setSelectedCountryCode(countryCode);
      setProfileImageUrl(user.profileImage || null);
    }
  };

  // Handle profile picture upload success
  const handleProfilePictureSuccess = (imageUrl: string) => {
    setProfileImageUrl(imageUrl);
    setImageUploadError(null);
  };

  // Handle profile picture upload error
  const handleProfilePictureError = (errorMessage: string) => {
    setImageUploadError(errorMessage);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;

    // Validate required fields
    if (!editFormData.name.trim()) {
      setProfileUpdateError('Name is required');
      return;
    }
    if (!editFormData.email.trim()) {
      setProfileUpdateError('Email is required');
      return;
    }
    if (!editFormData.phoneNumber.trim()) {
      setProfileUpdateError('Phone is required');
      return;
    }
    if (!editFormData.work.trim()) {
      setProfileUpdateError('Work information is required');
      return;
    }
    if (!editFormData.linkedinUsername.trim()) {
      setProfileUpdateError('LinkedIn username is required');
      return;
    }
    if (!editFormData.position) {
      setProfileUpdateError('Position is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editFormData.email)) {
      setProfileUpdateError('Please enter a valid email address');
      return;
    }

    // Validate and format phone number
    try {
      const formattedPhone = formatPhoneNumber(selectedCountryCode, editFormData.phoneNumber);
      
      setProfileUpdateLoading(true);
      setProfileUpdateError(null);

      // Format LinkedIn username (remove any linkedin.com prefix)
      const formattedLinkedin = editFormData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');

      // Format social media usernames
      const formattedTwitter = editFormData.twitter.replace(/^(https?:\/\/)?(www\.)?(twitter\.com\/|x\.com\/)@?/i, '').replace(/^@/, '');
      const formattedWebsite = editFormData.website && !editFormData.website.startsWith('http') 
        ? `https://${editFormData.website}` 
        : editFormData.website;

      // Update profile using the auth hook
      await updateProfile({
        name: editFormData.name.trim(),
        phone: formattedPhone,
        work: editFormData.work.trim(),
        company: editFormData.company.trim(),
        linkedinUsername: formattedLinkedin,
        position: editFormData.position,
        profileImage: profileImageUrl,
        bioTitle: editFormData.bioTitle.trim(),
        bio: editFormData.bio.trim(),
        city: editFormData.city.trim(),
        country: editFormData.country.trim(),
        timezone: editFormData.timezone,
        website: formattedWebsite,
        twitter: formattedTwitter.trim(),
        skills: editFormData.skills
      });

      setProfileUpdateSuccess('Profile updated successfully!');
      setIsEditingProfile(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setProfileUpdateSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      setProfileUpdateError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  const downloadQRCode = (registration: any) => {
    const svg = document.getElementById(`qr-code-${registration.eventId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 200;
    canvas.height = 200;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        ctx.drawImage(img, 0, 0, 200, 200);
        
        const link = document.createElement('a');
        link.download = `${registration.eventName.replace(/\s+/g, '-').toLowerCase()}-ticket.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const getStatusBadge = (status: EventData['status']) => {
    const badges = {
      'active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Register Now' },
      'sold-out': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Sold Out' },
      'completed': { bg: 'bg-blue-50', text: 'text-blue-800', label: 'Completed' }
    };
    
    const badge = badges[status as keyof typeof badges];
    if (!badge) return null;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const handleEventClick = (e: React.MouseEvent, slug: string) => {
    // Prevent any default behavior and page jumping
    e.preventDefault();
    e.stopPropagation();
    navigate(`/events/${slug}`); // Use slug instead of eventId
  };

  const handleRegisterClick = (e: React.MouseEvent, slug: string, status: EventData['status']) => {
    // Prevent event bubbling and default behavior
    e.preventDefault();
    e.stopPropagation();

    if (status === 'active') {
      navigate(`/events/${slug}`); // Use slug instead of eventId
    }
  };

  // Format position for display
  const formatPosition = (position: string | undefined): string => {
    if (!position) return '';
    
    const positionOption = POSITION_OPTIONS.find(option => option.value === position);
    return positionOption ? positionOption.label : position;
  };

  // Format LinkedIn username for display
  const formatLinkedinUrl = (username: string | undefined) => {
    if (!username) return '';
    
    // Remove any linkedin.com prefix if present
    const cleanUsername = username.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '');
    
    // Remove trailing slash if present
    return cleanUsername.replace(/\/$/, '');
  };

  const upcomingEvents = events.filter(event => isUpcoming(event.date));
  const pastEvents = events.filter(event => !isUpcoming(event.date));

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="pt-32 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading events...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 fade-in px-2">
              {user ? (
                <>Welcome back, <span className="gradient-text">{user.displayName?.split(' ')[0] || 'Member'}</span></>
              ) : (
                <>Alma Links <span className="gradient-text">Events</span></>
              )}
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed fade-in-delay px-4">
              {user ? (
                "Your dashboard for exclusive Alma Links events and tickets."
              ) : (
                "Join our exclusive gatherings where founders, investors, and innovators come together to shape the future of business and technology."
              )}
            </p>

            {/* Admin Back to Admin Button - Prominent placement for user view */}
            {isAdmin && isInUserView && (
              <div className="mb-8">
                <button
                  onClick={switchToAdminView}
                  className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold text-lg flex items-center space-x-3 mx-auto"
                >
                  <RotateCcw className="h-6 w-6" />
                  <span>Back to Admin Panel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Dashboard Content - Only show if logged in */}
      {user && (
        <section className="py-12 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Dashboard Header */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
                  <p className="text-gray-600">Manage your profile, tickets, and connections</p>
                </div>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <User className="h-6 w-6 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Profile Status</p>
                    <p className="font-semibold text-gray-900">Active Member</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Ticket className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Event Tickets</p>
                    <p className="font-semibold text-gray-900">{userRegistrations.length} Active</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-brand-dark" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Connections</p>
                    <p className="font-semibold text-gray-900">{connectionsCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <button
                  onClick={scrollToProfile}
                  className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 py-3 rounded-xl hover:shadow-lg transition-all shadow-sm font-medium"
                >
                  <Edit className="h-5 w-5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-4 gap-8">

              {/* Profile Section - Takes 3/4 of the space */}
              <div ref={profileSectionRef} className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Your Profile</h2>
                  </div>

                  {/* Success Message */}
                  {profileUpdateSuccess && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <p className="text-green-600 text-sm font-medium">{profileUpdateSuccess}</p>
                    </div>
                  )}

                  {/* Error Message */}
                  {profileUpdateError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <p className="text-red-600 text-sm font-medium">{profileUpdateError}</p>
                    </div>
                  )}

                  {isEditingProfile ? (
                    /* Edit Mode */
                    <div className="space-y-8">
                      {/* Profile Picture Section */}
                      <div className="bg-gray-50 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h3>
                        <div className="flex flex-col items-center">
                          <ProfilePictureUploader
                            currentImageUrl={user?.profileImage || null}
                            onUploadSuccess={handleProfilePictureSuccess}
                            onUploadError={handleProfilePictureError}
                            size="lg"
                          />
                          
                          {imageUploadError && (
                            <p className="text-red-600 text-sm mt-2">{imageUploadError}</p>
                          )}
                          
                          <p className="text-sm text-gray-500 mt-2">
                            Click on the image to upload a new profile picture
                          </p>
                        </div>
                      </div>

                      {/* Basic Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <User className="h-5 w-5 mr-2 text-gray-500" />
                          Basic Information
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name *
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              id="name"
                              name="name"
                              type="text"
                              required
                              value={editFormData.name}
                              onChange={handleEditFormChange}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your full name"
                              disabled={profileUpdateLoading}
                            />
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address *
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              id="email"
                              name="email"
                              type="email"
                              required
                              value={editFormData.email}
                              onChange={handleEditFormChange}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your email"
                              disabled // Email typically shouldn't be editable after account creation
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Email cannot be changed after account creation</p>
                        </div>

                        {/* Phone with Country Code */}
                        <div>
                          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number *
                          </label>
                          <div className="flex space-x-2">
                            {/* Country Code Dropdown */}
                            <div className="relative">
                              <select
                                value={selectedCountryCode}
                                onChange={(e) => setSelectedCountryCode(e.target.value)}
                                className="appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                              >
                                {COUNTRY_CODES.map((country) => (
                                  <option key={country.code} value={country.code}>
                                    {country.flag} {country.code}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>

                            {/* Phone Number Input */}
                            <div className="relative flex-1">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                id="phoneNumber"
                                name="phoneNumber"
                                type="tel"
                                required
                                value={editFormData.phoneNumber}
                                onChange={handleEditFormChange}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder={selectedCountryCode === '+972' ? '0501234567' : 'Phone number'}
                              />
                            </div>
                          </div>
                          
                          {/* Phone Preview */}
                          {editFormData.phoneNumber && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Preview:</span> {selectedCountryCode}{editFormData.phoneNumber.replace(/^0/, '')}
                            </div>
                          )}
                          
                          {/* Country Info */}
                          {selectedCountry && (
                            <div className="mt-1 text-xs text-gray-500">
                              {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
                            </div>
                          )}
                        </div>

                        {/* Job Title */}
                        <div>
                          <label htmlFor="work" className="block text-sm font-medium text-gray-700 mb-2">
                            Job Title *
                          </label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              id="work"
                              name="work"
                              type="text"
                              required
                              value={editFormData.work}
                              onChange={handleEditFormChange}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="e.g., CEO, Software Engineer, Investor, Product Manager"
                            />
                          </div>
                        </div>
                        
                        {/* Company */}
                        <div>
                          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                            Company
                          </label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              id="company"
                              name="company"
                              type="text"
                              value={editFormData.company || ''}
                              onChange={handleEditFormChange}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="e.g., TechCorp, Microsoft, Startup Inc."
                              disabled={profileUpdateLoading}
                            />
                          </div>
                        </div>

                        {/* LinkedIn Username */}
                        <div>
                          <label htmlFor="linkedinUsername" className="block text-sm font-medium text-gray-700 mb-2">
                            LinkedIn Username *
                          </label>
                          <div className="relative">
                            <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              id="linkedinUsername"
                              name="linkedinUsername"
                              type="text"
                              required
                              value={editFormData.linkedinUsername}
                              onChange={handleEditFormChange}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="e.g., johndoe (without linkedin.com/in/)"
                            />
                          </div>
                          {editFormData.linkedinUsername && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Preview:</span> linkedin.com/in/{editFormData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}
                            </div>
                          )}
                        </div>

                        {/* Position */}
                        <div>
                          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                            Position *
                          </label>
                          <div className="relative">
                            <select
                              id="position"
                              name="position"
                              required
                              value={editFormData.position}
                              onChange={handleEditFormChange}
                              className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none"
                            >
                              <option value="" disabled>Select your position...</option>
                              {POSITION_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        </div>
                      </div>

                      {/* Professional Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <Briefcase className="h-5 w-5 mr-2 text-gray-500" />
                          Professional Information
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">

                        {/* Bio Title */}
                        <div className="md:col-span-2">
                          <label htmlFor="bioTitle" className="block text-sm font-medium text-gray-700 mb-2">
                            Professional Bio Title
                          </label>
                          <input
                            id="bioTitle"
                            name="bioTitle"
                            type="text"
                            value={editFormData.bioTitle}
                            onChange={handleEditFormChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="e.g., Passionate about AI and startups"
                            disabled={profileUpdateLoading}
                          />
                        </div>
                        </div>
                      </div>

                      {/* Location & Contact Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <MapPin className="h-5 w-5 mr-2 text-gray-500" />
                          Location & Contact
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* City */}
                          <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                              City
                            </label>
                            <input
                              id="city"
                              name="city"
                              type="text"
                              value={editFormData.city}
                              onChange={handleEditFormChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="e.g., New York, London, Tel Aviv"
                              disabled={profileUpdateLoading}
                            />
                          </div>

                          {/* Country */}
                          <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                              Country
                            </label>
                            <input
                              id="country"
                              name="country"
                              type="text"
                              value={editFormData.country}
                              onChange={handleEditFormChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="e.g., United States, Israel, United Kingdom"
                              disabled={profileUpdateLoading}
                            />
                          </div>

                          {/* Timezone */}
                          <div>
                            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                              Timezone
                            </label>
                            <select
                              id="timezone"
                              name="timezone"
                              value={editFormData.timezone}
                              onChange={handleEditFormChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              disabled={profileUpdateLoading}
                            >
                              <option value="">Select timezone...</option>
                              <option value="America/New_York">Eastern Time (ET)</option>
                              <option value="America/Chicago">Central Time (CT)</option>
                              <option value="America/Denver">Mountain Time (MT)</option>
                              <option value="America/Los_Angeles">Pacific Time (PT)</option>
                              <option value="Europe/London">GMT (London)</option>
                              <option value="Europe/Paris">CET (Paris/Berlin)</option>
                              <option value="Asia/Jerusalem">Israel Time</option>
                              <option value="Asia/Dubai">Gulf Time</option>
                              <option value="Asia/Singapore">Singapore Time</option>
                              <option value="Asia/Tokyo">Japan Time</option>
                              <option value="Australia/Sydney">Australia Eastern</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Social Media & Online Presence Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <Globe className="h-5 w-5 mr-2 text-gray-500" />
                          Social Media & Online Presence
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Website */}
                          <div>
                            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                              Website
                            </label>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                id="website"
                                name="website"
                                type="url"
                                value={editFormData.website}
                                onChange={handleEditFormChange}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="e.g., mycompany.com or https://myportfolio.com"
                                disabled={profileUpdateLoading}
                              />
                            </div>
                          </div>

                          {/* Twitter */}
                          <div>
                            <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 mb-2">
                              Twitter/X Username
                            </label>
                            <div className="relative">
                              <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                id="twitter"
                                name="twitter"
                                type="text"
                                value={editFormData.twitter}
                                onChange={handleEditFormChange}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="e.g., johndoe (without @ or twitter.com)"
                                disabled={profileUpdateLoading}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* About You Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">About You</h3>
                        <div className="space-y-6">
                          {/* Bio */}
                          <div>
                            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                              Personal Bio
                            </label>
                            <textarea
                              id="bio"
                              name="bio"
                              rows={4}
                              value={editFormData.bio}
                              onChange={handleEditFormChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              placeholder="Tell us about yourself, your background, interests, and what you're passionate about..."
                              disabled={profileUpdateLoading}
                            />
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs text-gray-500">
                                Share your story, interests, and what drives you professionally.
                              </p>
                              <p className="text-xs text-gray-500">
                                {editFormData.bio.length}/500 characters
                              </p>
                            </div>
                          </div>

                          {/* Skills */}
                          <div>
                            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-2">
                              Skills & Expertise
                            </label>
                            <textarea
                              id="skills"
                              name="skills"
                              rows={3}
                              value={skillsInputValue}
                              onChange={handleSkillsInputChange}
                              onKeyDown={(e) => {
                                // Allow Enter to add skills
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const currentValue = e.currentTarget.value;
                                  if (!currentValue.endsWith(',') && !currentValue.endsWith(';')) {
                                    const newValue = currentValue + ', ';
                                    setSkillsInputValue(newValue);
                                    // Trigger parsing
                                    const mockEvent = { target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>;
                                    handleSkillsInputChange(mockEvent);
                                  }
                                }
                              }}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              placeholder="Type your skills and press Enter or use commas, semicolons to separate them&#10;e.g., JavaScript&#10;Product Management&#10;Data Analysis&#10;Machine Learning"
                              disabled={profileUpdateLoading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Separate skills with commas (,) semicolons (;) or press Enter. If comma key doesn't work, try semicolon (;) or Enter.
                            </p>
                            {editFormData.skills.length > 0 && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                                <p className="text-xs font-medium text-gray-700 mb-2">Your Skills:</p>
                                <div className="flex flex-wrap gap-2">
                                  {editFormData.skills.map((skill, index) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm flex items-center font-medium"
                                    >
                                      {skill}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newSkills = editFormData.skills.filter((_, i) => i !== index);
                                          setEditFormData(prev => ({
                                            ...prev,
                                            skills: newSkills
                                          }));
                                          setSkillsInputValue(newSkills.join(', '));
                                        }}
                                        className="ml-2 text-brand-blue hover:text-brand-blue-hover text-sm"
                                        disabled={profileUpdateLoading}
                                        title="Remove skill"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="bg-gray-50 rounded-2xl p-6">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600">
                            Make sure all required fields (*) are filled out correctly before saving.
                          </p>
                          <div className="flex space-x-4">
                            <button
                              onClick={handleCancelEdit}
                              disabled={profileUpdateLoading}
                              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 font-medium disabled:opacity-50"
                            >
                              <div className="flex items-center space-x-2">
                                <X className="h-4 w-4" />
                                <span>Cancel</span>
                              </div>
                            </button>
                            <button
                              onClick={handleSaveProfile}
                              disabled={profileUpdateLoading}
                              className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2 disabled:opacity-50"
                            >
                              {profileUpdateLoading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4" />
                                  <span>Save All Changes</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="space-y-8">
                      {/* Profile Picture & Bio Title */}
                      <div className="bg-gray-50 rounded-2xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                          <div className="flex flex-col items-center md:items-start">
                            <ProfilePictureUploader
                              currentImageUrl={user?.profileImage || null}
                              onUploadSuccess={handleProfilePictureSuccess}
                              onUploadError={handleProfilePictureError}
                              size="lg"
                            />
                            
                            {imageUploadError && (
                              <p className="text-red-600 text-sm mt-2">{imageUploadError}</p>
                            )}
                          </div>
                          
                          <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                              {user?.displayName || 'Your Name'}
                            </h3>
                            {/* Bio Title */}
                            {user?.bioTitle && (
                              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                                <p className="text-blue-800 font-medium">
                                  {user.bioTitle}
                                </p>
                              </div>
                            )}
                            
                            {/* Basic contact info */}
                            <div className="text-gray-600 space-y-1">
                              {user?.email && (
                                <div className="flex items-center justify-center md:justify-start space-x-2">
                                  <Mail className="h-4 w-4" />
                                  <span>{user.email}</span>
                                </div>
                              )}
                              {user?.phone && (
                                <div className="flex items-center justify-center md:justify-start space-x-2">
                                  <Phone className="h-4 w-4" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Basic Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <User className="h-5 w-5 mr-2 text-gray-500" />
                          Basic Information
                        </h3>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="flex items-center space-x-3">
                            <Linkedin className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-500">LinkedIn</div>
                              <div className="font-medium">
                                {user?.linkedinUsername ? (
                                  <a
                                    href={`https://linkedin.com/in/${formatLinkedinUrl(user.linkedinUsername)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-blue hover:text-brand-blue-hover hover:underline"
                                  >
                                    {formatLinkedinUrl(user.linkedinUsername)}
                                  </a>
                                ) : (
                                  'Not provided'
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Professional Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                          <Briefcase className="h-5 w-5 mr-2 text-gray-500" />
                          Professional Information
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="flex items-center space-x-3">
                            <Briefcase className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-500">Job Title</div>
                              <div className="font-medium">{user?.work || 'Not provided'}</div>
                            </div>
                          </div>
                          
                          {user?.company && (
                            <div className="flex items-center space-x-3">
                              <Briefcase className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Company</div>
                                <div className="font-medium">{user.company}</div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-3">
                            <User className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-500">Position</div>
                              <div className="font-medium">{formatPosition(user?.position) || 'Not provided'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Location & Contact Section */}
                      {((user?.city || user?.country) || user?.timezone) && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                            <MapPin className="h-5 w-5 mr-2 text-gray-500" />
                            Location & Contact
                          </h3>
                          <div className="grid md:grid-cols-2 gap-6">
                            {(user?.city || user?.country) && (
                              <div className="flex items-center space-x-3">
                                <MapPin className="h-5 w-5 text-gray-400" />
                                <div>
                                  <div className="text-sm text-gray-500">Location</div>
                                  <div className="font-medium">
                                    {[user?.city, user?.country].filter(Boolean).join(', ')}
                                  </div>
                                </div>
                              </div>
                            )}

                            {user?.timezone && (
                              <div className="flex items-center space-x-3">
                                <Clock className="h-5 w-5 text-gray-400" />
                                <div>
                                  <div className="text-sm text-gray-500">Timezone</div>
                                  <div className="font-medium">{user.timezone}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Social Media & Online Presence Section */}
                      {(user?.website || user?.twitter) && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                            <Globe className="h-5 w-5 mr-2 text-gray-500" />
                            Social Media & Online Presence
                          </h3>
                          <div className="grid md:grid-cols-2 gap-6">
                            {user?.website && (
                              <div className="flex items-center space-x-3">
                                <Globe className="h-5 w-5 text-gray-400" />
                                <div>
                                  <div className="text-sm text-gray-500">Website</div>
                                  <div className="font-medium">
                                    <a
                                      href={user.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand-blue hover:text-brand-blue-hover hover:underline"
                                    >
                                      {user.website.replace(/^https?:\/\//, '')}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}

                            {user?.twitter && (
                              <div className="flex items-center space-x-3">
                                <Twitter className="h-5 w-5 text-gray-400" />
                                <div>
                                  <div className="text-sm text-gray-500">Twitter/X</div>
                                  <div className="font-medium">
                                    <a
                                      href={`https://twitter.com/${user.twitter}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-brand-blue hover:text-brand-blue-hover hover:underline"
                                    >
                                      @{user.twitter}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* About You Section */}
                      {(user?.bio || (user?.skills && user.skills.length > 0)) && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6">About You</h3>
                          <div className="space-y-6">
                            {/* Bio */}
                            {user?.bio && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Personal Bio</h4>
                                <div className="bg-gray-50 rounded-xl p-4">
                                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {user.bio}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Skills */}
                            {user?.skills && user.skills.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Skills & Expertise</h4>
                                <div className="flex flex-wrap gap-2">
                                  {user.skills.map((skill, index) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm font-medium"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Connections Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Your Network</h2>
                  </div>
                  <div className="p-6">
                    <ConnectionsCard />
                  </div>
                </div>
              </div>

              
              {/* Sidebar - Takes 1/4 of the space */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Quick Actions Card */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link
                      to="/members"
                      className="w-full flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <Users className="h-5 w-5 text-gray-500 group-hover:text-brand-blue transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Browse Members</span>
                    </Link>

                    <Link
                      to="/events"
                      className="w-full flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <Calendar className="h-5 w-5 text-gray-500 group-hover:text-brand-blue transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">View Events</span>
                    </Link>

                    <Link
                      to="/chats"
                      className="w-full flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <MessageCircle className="h-5 w-5 text-gray-500 group-hover:text-brand-blue transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">My Chats</span>
                    </Link>

                    <Link
                      to="/discover-chats"
                      className="w-full flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <Compass className="h-5 w-5 text-gray-500 group-hover:text-brand-blue transition-colors" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Discover Chats</span>
                    </Link>
                  </div>
                </div>

                {/* Announcements Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
                  </div>
                  <div className="p-0">
                    <AnnouncementsSidebar />
                  </div>
                </div>

                {/* Support AlmaLinks Card */}
                <div className="bg-gradient-to-br from-brand-gold to-amber-500 rounded-2xl shadow-lg p-6 border border-amber-200">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full">
                      <Heart className="h-6 w-6 text-white fill-current" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Support Our Mission</h3>
                  </div>
                  <p className="text-white/90 text-sm mb-4">
                    Help us build stronger connections and empower communities worldwide
                  </p>
                  <a
                    href="https://almalinks.org/donate.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-white text-brand-gold font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 shadow-sm"
                  >
                    Make a Donation
                  </a>
                </div>
                
                {/* Profile Completion Card */}
                <div className={`rounded-2xl p-6 border transition-all duration-300 ${
                  profileCompletion.percentage === 100
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                    : 'bg-gradient-to-br from-brand-light to-blue-50 border-blue-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Profile Strength</h3>
                    {profileCompletion.percentage === 100 ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <TrendingUp className="h-6 w-6 text-brand-blue" />
                    )}
                  </div>

                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          profileCompletion.percentage === 100
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                            : 'bg-gradient-to-r from-brand-blue to-brand-blue-hover'
                        }`}
                        style={{ width: `${profileCompletion.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{profileCompletion.percentage}%</span>
                  </div>

                  {profileCompletion.percentage === 100 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-green-800">
                        Excellent! Your profile is complete.
                      </p>
                      <p className="text-xs text-gray-600">
                        Your comprehensive profile helps you make meaningful connections with other members.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-800">
                        {profileCompletion.missingRequired && profileCompletion.missingRequired.length > 0
                          ? 'Complete your profile to maximize networking opportunities'
                          : 'Enhance your profile for stronger connections'}
                      </p>

                      {profileCompletion.missingRequired && profileCompletion.missingRequired.length > 0 && (
                        <div className="bg-white rounded-lg p-3 mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Required Information:</p>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            {profileCompletion.missingRequired.slice(0, 3).map((field, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-brand-blue mr-1">•</span>
                                {field}
                              </li>
                            ))}
                            {profileCompletion.missingRequired.length > 3 && (
                              <li className="text-gray-500 italic">
                                +{profileCompletion.missingRequired.length - 3} more required field{profileCompletion.missingRequired.length - 3 > 1 ? 's' : ''}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {profileCompletion.missingOptional && profileCompletion.missingOptional.length > 0 && (
                        <div className="bg-white rounded-lg p-3 mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Optional Details:</p>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            {profileCompletion.missingOptional.slice(0, 3).map((field, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-gray-400 mr-1">•</span>
                                {field}
                              </li>
                            ))}
                            {profileCompletion.missingOptional.length > 3 && (
                              <li className="text-gray-500 italic">
                                +{profileCompletion.missingOptional.length - 3} more optional field{profileCompletion.missingOptional.length - 3 > 1 ? 's' : ''}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={scrollToProfile}
                        className="w-full mt-3 text-xs font-medium text-white bg-brand-blue hover:bg-brand-blue-hover py-2 px-3 rounded-lg transition-colors duration-200"
                      >
                        Complete Profile
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Event Tickets Section - Part of main dashboard */}
      {user && (
        <section className="py-8 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Your <span className="gradient-text">Event Tickets</span>
                  </h2>
                  <p className="text-gray-600">Manage your event registrations and tickets</p>
                </div>
                <button 
                  onClick={() => window.location.href = '/events'}
                  className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Browse Events</span>
                </button>
              </div>
            </div>

            {registrationsLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your tickets...</p>
              </div>
            ) : userRegistrations.length > 0 ? (
              <div className="grid lg:grid-cols-2 gap-6">
                {userRegistrations.map((registration, index) => {
                  const isExpired = !isUpcoming(registration.eventDate);
                  
                  return (
                  <div
                    key={registration.eventId}
                    className={`${isExpired ? 'bg-gradient-to-br from-gray-500 to-gray-600' : 'bg-gradient-to-br from-brand-blue-dark to-brand-blue-light'} rounded-3xl p-8 text-white relative overflow-hidden slide-up`}
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                          <Ticket className="h-6 w-6" />
                          <span className="font-semibold">{isExpired ? 'Expired Ticket' : 'Digital Ticket'}</span>
                        </div>
                        <div className="text-sm opacity-90">
                          #{registration.qrCodeUrl?.slice(-8).toUpperCase() || 'TICKET'}
                        </div>
                      </div>
                      
                      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                        <div className="text-2xl font-bold">{registration.eventName}</div>
                        <div className="opacity-90">{formatDate(registration.eventDate).date} • {formatDate(registration.eventDate).time}</div>
                        <div className="opacity-90">{registration.eventLocation}</div>
                      </div>
                      
                      <div className="pt-4 border-t border-white/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm opacity-90">Attendee</div>
                            <div className="font-semibold">{registration.name}</div>
                            <div className="text-sm opacity-75">{registration.email}</div>
                            <div className="text-sm opacity-75">{registration.phone}</div>
                            <div className="text-sm opacity-75">{registration.work}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm opacity-90">QR Code</div>
                            <div className="bg-white p-2 rounded-lg mt-1">
                              <QRCodeSVG
                                id={`qr-code-${registration.eventId}`}
                                value={`https://almalinks.com/connect?to=${user.uid}&event=${registration.eventId}`}
                                size={60}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <button
                              onClick={() => downloadQRCode(registration)}
                              className="mt-2 text-xs text-white/80 hover:text-white flex items-center space-x-1"
                            >
                              <Download className="h-3 w-3" />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 text-center">
                        <p className="text-sm opacity-90">
                          {isExpired ? 'This ticket has expired' : 'Present this ticket at the event entrance'}
                        </p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Ticket className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No tickets yet</h3>
                  <p className="text-gray-600 mb-6">
                    You haven't registered for any events yet. Discover amazing networking opportunities!
                  </p>
                  <button
                    onClick={() => window.location.href = '/events'}
                    className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-medium"
                  >
                    Explore Events
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Upcoming <span className="gradient-text">Events</span>
                  </h2>
                  <p className="text-gray-600">
                    Don't miss these exclusive networking opportunities
                  </p>
                </div>
                <Link
                  to="/events"
                  className="text-brand-blue hover:text-brand-blue-hover font-medium flex items-center space-x-2"
                >
                  <span>View All Events</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {upcomingEvents.map((event, index) => {
                const isRegistered = userRegistrations.some(reg => reg.eventId === event.id);
                
                return (
                  <div
                    key={event.id}
                    className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover-lift cursor-pointer slide-up`}
                    style={{ animationDelay: `${index * 0.2}s` }}
                    onClick={(e) => handleEventClick(e, event.slug)} // Use slug
                  >
                    {/* Event Image */}
                    <div className="h-48 sm:h-56 md:h-64 bg-gray-200 relative">
                      <img
                        src={event.imageUrl}
                        alt={event.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMyMCIgdmlld0JveD0iMCAwIDYwMCAzMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMDAgMTYwQzMwNS41MjMgMTYwIDMxMCAxNTUuNTIzIDMxMCAxNTBTMzA1LjUyMyAxNDAgMzAwIDE0MFMyOTAgMTQ0LjQ3NyAyOTAgMTUwUzI5NC40NzcgMTYwIDMwMCAxNjBaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==';
                        }}
                      />
                      <div className="absolute top-4 right-4">
                        {isRegistered ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            Registered
                          </span>
                        ) : (
                          getStatusBadge(event.status)
                        )}
                      </div>
                    </div>

                    {/* Event Content */}
                    <div className="p-4 sm:p-6 md:p-8">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">{event.name}</h3>
                      
                      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                        <div className="flex items-center space-x-3 text-gray-600">
                          <Calendar className="h-5 w-5 text-red-700" />
                          <span>{formatDate(event.date).date}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-gray-600">
                          <Clock className="h-5 w-5 text-brand-blue" />
                          <span>{formatDate(event.date).time}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-gray-600">
                          <MapPin className="h-5 w-5 text-red-700" />
                          <span>{event.location}</span>
                        </div>
                      </div>

                      <p className="text-gray-600 mb-6 leading-relaxed line-clamp-3">
                        {event.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Users className="h-4 w-4" />
                          <span>Exclusive Event</span>
                        </div>
                        
                        {isRegistered ? (
                          <span className="bg-green-100 text-green-800 px-6 py-3 rounded-full font-semibold">
                            Registered ✓
                          </span>
                        ) : event.status === 'active' ? (
                          <button 
                            onClick={(e) => handleRegisterClick(e, event.slug, event.status)} // Use slug
                            className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold flex items-center space-x-2"
                          >
                            <span>Register Now</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button 
                            disabled
                            className="bg-gray-300 text-gray-500 px-6 py-3 rounded-full font-semibold cursor-not-allowed"
                          >
                            {event.status === 'sold-out' ? 'Sold Out' : 'Registration Closed'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Past <span className="gradient-text">Events</span>
                  </h2>
                  <p className="text-gray-600">
                    Our successful networking gatherings
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover-lift cursor-pointer slide-up`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={(e) => handleEventClick(e, event.slug)} // Use slug
                >
                  {/* Event Image */}
                  <div className="h-48 bg-gray-200 relative">
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDQwMCAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMTkyIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgOTZDMjA1LjUyMyA5NiAyMTAgOTEuNTIzIDIxMCA4NlMyMDUuNTIzIDc2IDIwMCA3NlMxOTAgODAuNDc3IDE5MCA4NlMxOTQuNDc3IDk2IDIwMCA5NloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
                      }}
                    />
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-800">
                        Completed
                      </span>
                    </div>
                  </div>

                  {/* Event Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{event.name}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center space-x-2 text-gray-600 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.date).date}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm line-clamp-2">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* No Events State */}
      {events.length === 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                No Events Available
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                We're working on exciting new events. Check back soon for amazing networking opportunities!
              </p>
              <button
                onClick={() => navigate(-1)}
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-medium inline-flex items-center space-x-2"
              >
                <span>Back to Previous Page</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      <Footer />

      {/* Igani Watermark */}
      <IganiWatermark position="bottom-right" size="sm" opacity={0.25} />
    </div>
  );
};

export default EventsPage;