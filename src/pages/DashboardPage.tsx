import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ArrowRight, Clock, Users, RotateCcw, User, Mail, Phone, Briefcase, Edit, X, Check, AlertCircle, ChevronDown, Linkedin, Globe, Twitter, CheckCircle, TrendingUp, Heart } from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import { ConnectionService } from '../services/connectionService';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ConnectionsCard from '../components/dashboard/ConnectionsCard';
import DashboardProfileView from '../components/dashboard/DashboardProfileView';
import DashboardUpcomingEvents from '../components/dashboard/DashboardUpcomingEvents';
import ProfilePictureUploader from '../components/profile/ProfilePictureUploader';
import ImageWithCrop from '../components/profile/ImageWithCrop';
import RichTextBioEditor from '../components/profile/RichTextBioEditor';
import BioHtml from '../components/profile/BioHtml';
import type { CropValue } from '../types/crop';
import Favicon from '../components/ui/Favicon';
import { linkedInProfileHref } from '../utils/linkedInUrl';
import SavedIndicator from '../components/ui/SavedIndicator';
import BackButton from '../components/ui/BackButton';
import { resolveDirectoryAvatarUrl } from '../utils/memberHubspotDisplay';
import type { UserProfile } from '../types/user';

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

const DashboardPage: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [showAllPast, setShowAllPast] = useState(false);
  
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
  const [profileImageCrop, setProfileImageCrop] = useState<CropValue | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const profile = user as UserProfile;
      setProfileImageUrl(resolveDirectoryAvatarUrl(profile) || user.profileImage || null);
      setProfileImageCrop((user as { profileImageCrop?: CropValue | null }).profileImageCrop || null);
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
      const { getMyRegistration } = await import('../services/registrationService');
      const registrations = await Promise.all(
        events.map(async (event) => {
          const reg = await getMyRegistration(event.id, user.uid);
          if (!reg) return null;
          let eventLocation: string | null = null;
          let eventVenueAddress: string | null = null;
          if (reg.status === 'approved') {
            const priv = await EventService.getEventPrivateDetails(event.id);
            const primary = (priv?.locationText || event.location || '').trim();
            eventLocation = primary || null;
            eventVenueAddress = (priv?.venueAddress || '').trim() || null;
          }
          return {
            ...reg,
            eventId: event.id,
            eventName: event.name,
            eventDate: event.date,
            eventLocation,
            eventVenueAddress,
            eventImage: event.imageUrl,
            eventSlug: event.slug,
            eventStatus: event.status,
            registrationStatus: reg.status,
          };
        })
      );
      setUserRegistrations(registrations.filter(Boolean) as any[]);
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

  // Auto-save: perform save without closing editor; sets lastSavedAt on success
  const performSave = async () => {
    if (!user) return;
    if (!editFormData.name.trim()) { setProfileUpdateError('Name is required'); return; }
    if (!editFormData.email.trim()) { setProfileUpdateError('Email is required'); return; }
    if (!editFormData.phoneNumber.trim()) { setProfileUpdateError('Phone is required'); return; }
    if (!editFormData.work.trim()) { setProfileUpdateError('Work information is required'); return; }
    if (!editFormData.linkedinUsername.trim()) { setProfileUpdateError('LinkedIn username is required'); return; }
    if (!editFormData.position) { setProfileUpdateError('Position is required'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editFormData.email)) { setProfileUpdateError('Please enter a valid email address'); return; }
    try {
      const formattedPhone = formatPhoneNumber(selectedCountryCode, editFormData.phoneNumber);
      setProfileUpdateLoading(true);
      setProfileUpdateError(null);
      const formattedLinkedin = editFormData.linkedinUsername.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
      const formattedTwitter = editFormData.twitter.replace(/^(https?:\/\/)?(www\.)?(twitter\.com\/|x\.com\/)@?/i, '').replace(/^@/, '');
      const formattedWebsite = editFormData.website && !editFormData.website.startsWith('http') ? `https://${editFormData.website}` : editFormData.website;
      await updateProfile({
        name: editFormData.name.trim(),
        phone: formattedPhone,
        work: editFormData.work.trim(),
        company: editFormData.company.trim(),
        linkedinUsername: formattedLinkedin,
        position: editFormData.position,
        profileImage: profileImageUrl,
        profileImageCrop: profileImageCrop ?? undefined,
        bioTitle: editFormData.bioTitle.trim(),
        bio: editFormData.bio.trim(),
        city: editFormData.city.trim(),
        country: editFormData.country.trim(),
        timezone: editFormData.timezone,
        website: formattedWebsite,
        twitter: formattedTwitter.trim(),
        skills: editFormData.skills
      });
      setLastSavedAt(Date.now());
    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      setProfileUpdateError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  const scheduleAutoSave = () => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    autoSaveDebounceRef.current = setTimeout(performSave, 1200);
  };

  const handleBlurSave = () => {
    if (autoSaveDebounceRef.current) {
      clearTimeout(autoSaveDebounceRef.current);
      autoSaveDebounceRef.current = null;
    }
    performSave();
  };

  // Handle edit profile form changes
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      const digitsOnly = value.replace(/\D/g, '');
      setEditFormData(prev => ({ ...prev, [name]: digitsOnly }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
    scheduleAutoSave();
  };

  // Handle skills input with real-time parsing
  const handleSkillsInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSkillsInputValue(value);
    const skillsArray = value.split(/[,;\n]/).map(skill => skill.trim()).filter(skill => skill);
    setEditFormData(prev => ({ ...prev, skills: skillsArray }));
    scheduleAutoSave();
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
      const profile = user as UserProfile;
      setProfileImageUrl(resolveDirectoryAvatarUrl(profile) || user.profileImage || null);
      setProfileImageCrop((user as { profileImageCrop?: CropValue | null }).profileImageCrop || null);
    }
  };

  // Handle profile picture upload success
  const handleProfilePictureSuccess = async (imageUrl: string, crop?: CropValue) => {
    setProfileImageUrl(imageUrl);
    setProfileImageCrop(crop ?? null);
    setImageUploadError(null);
    try {
      await updateProfile({ profileImage: imageUrl, profileImageCrop: crop ?? undefined });
      setLastSavedAt(Date.now());
    } catch (e) {
      console.error('Failed to save profile picture crop', e);
    }
  };

  // Handle profile picture upload error
  const handleProfilePictureError = (errorMessage: string) => {
    setImageUploadError(errorMessage);
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

  // Format position for display
  const formatPosition = (position: string | undefined): string => {
    if (!position) return '';
    
    const positionOption = POSITION_OPTIONS.find(option => option.value === position);
    return positionOption ? positionOption.label : position;
  };

  const pastEvents = events
    .filter(event => !isUpcoming(event.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const upcomingRsvpRegistrations = [...userRegistrations]
    .filter((r: { eventId?: string; registrationStatus?: string }) => {
      const ev = events.find((e) => e.id === r.eventId);
      if (!ev || !isUpcoming(ev.date)) return false;
      return r.registrationStatus === 'pending' || r.registrationStatus === 'approved';
    })
    .sort((a: { eventId?: string }, b: { eventId?: string }) => {
      const da = events.find((e) => e.id === a.eventId)?.date || '';
      const db = events.find((e) => e.id === b.eventId)?.date || '';
      return new Date(da).getTime() - new Date(db).getTime();
    });

  const pastEventsAttended = pastEvents.filter((event) => {
    const reg = userRegistrations.find(
      (r: { eventId?: string; checkedIn?: boolean }) => r.eventId === event.id
    );
    return reg?.checkedIn === true;
  });
  const pastAttendedDisplay = showAllPast ? pastEventsAttended : pastEventsAttended.slice(0, 3);
  const hasMorePastAttended = pastEventsAttended.length > 3;

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode);

  if (loading) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16">
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
    <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full box-border">
      <Header />
      
      {/* Hero: guests only; admins in user view get a slim action bar */}
      {!user ? (
        <section className="pt-[var(--content-offset-top)] sm:pt-24 md:pt-32 pb-8 sm:pb-12 md:pb-16 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 fade-in px-2">
                AlmaLinks <span className="gradient-text">Events</span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-600 mb-6 sm:mb-8 md:mb-12 max-w-4xl mx-auto leading-relaxed fade-in-delay px-2 sm:px-4">
                Join our exclusive gatherings where founders, investors, and innovators come together to shape the future of business and technology.
              </p>
            </div>
          </div>
        </section>
      ) : isAdmin && isInUserView ? (
        <section className="pt-[var(--content-offset-top)] pb-6 sm:pb-8 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <button
                onClick={switchToAdminView}
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 sm:px-8 py-3 sm:py-3.5 md:py-4 rounded-full hover:shadow-lg active:shadow-md transition-all duration-300 font-semibold text-base sm:text-lg inline-flex items-center justify-center space-x-2 sm:space-x-3 min-h-[44px] md:min-h-0 touch-manipulation"
              >
                <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>Back to Admin Panel</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Main Dashboard Content - Only show if logged in */}
      {user && (
        <section
          className={
            isAdmin && isInUserView
              ? 'pt-6 sm:pt-8 pb-4 sm:pb-6 bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full box-border'
              : 'pt-[var(--content-offset-top)] sm:pt-20 pb-4 sm:pb-6 bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full box-border max-h-[calc(100dvh-4.5rem)] lg:max-h-[calc(100dvh-5rem)] overflow-y-auto'
          }
        >
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 w-full box-border">
            <div className="mb-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Profile</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {profileCompletion.percentage}% complete · {connectionsCount} connection{connectionsCount === 1 ? '' : 's'} · {upcomingRsvpRegistrations.length} upcoming RSVP{upcomingRsvpRegistrations.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className={`grid gap-4 w-full ${isEditingProfile ? '' : 'lg:grid-cols-[1fr_minmax(15rem,17.5rem)]'}`}>
              <div ref={profileSectionRef} className="w-full min-w-0 space-y-3" data-onboarding="chapter">
                <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100 w-full max-w-full min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="text-base font-semibold text-gray-900">Your Profile</h2>
                    {!isEditingProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingProfile(true);
                          setProfileUpdateError(null);
                          setProfileUpdateSuccess(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-dark text-white text-sm font-medium hover:bg-brand-dark-hover shrink-0"
                      >
                        <Edit className="h-4 w-4" />
                        Edit profile
                      </button>
                    )}
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
                    <div className="space-y-6 sm:space-y-8 w-full max-w-full min-w-0">
                      {/* Profile Picture Section */}
                      <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h3>
                        <div className="flex flex-col items-center">
                          <ProfilePictureUploader
                            currentImageUrl={user?.profileImage || profileImageUrl || null}
                            currentCrop={profileImageCrop ?? (user as { profileImageCrop?: CropValue | null })?.profileImageCrop ?? null}
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
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0 overflow-hidden">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                          <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="min-w-0">Basic Information</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full">
                        {/* Name */}
                        <div className="w-full min-w-0">
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name *
                          </label>
                          <div className="relative w-full">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                            <input
                              id="name"
                              name="name"
                              type="text"
                              required
                              value={editFormData.name}
                              onChange={handleEditFormChange}
                              onBlur={handleBlurSave}
                              className="w-full max-w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
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
                              onBlur={handleBlurSave}
                              className="w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0"
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
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full max-w-full">
                            {/* Country Code Dropdown */}
                            <div className="relative flex-shrink-0 w-full sm:w-auto min-w-0">
                              <select
                                value={selectedCountryCode}
                                onChange={(e) => { setSelectedCountryCode(e.target.value); scheduleAutoSave(); }}
                                onBlur={handleBlurSave}
                                className="appearance-none bg-white border border-gray-300 rounded-xl px-3 py-3 sm:py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0 box-border max-w-full"
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
                            <div className="relative flex-1 min-w-0 w-full sm:w-auto">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                              <input
                                id="phoneNumber"
                                name="phoneNumber"
                                type="tel"
                                required
                                value={editFormData.phoneNumber}
                                onChange={handleEditFormChange}
                                onBlur={handleBlurSave}
                                className="w-full max-w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
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
                              onBlur={handleBlurSave}
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
                              onBlur={handleBlurSave}
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
                              onBlur={handleBlurSave}
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
                              onBlur={handleBlurSave}
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
                        <div className="md:col-span-2 w-full min-w-0">
                          <label htmlFor="bioTitle" className="block text-sm font-medium text-gray-700 mb-2">
                            Professional Bio Title
                          </label>
                          <input
                            id="bioTitle"
                            name="bioTitle"
                            type="text"
                            value={editFormData.bioTitle}
                            onChange={handleEditFormChange}
                            onBlur={handleBlurSave}
                            className="w-full max-w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
                            placeholder="e.g., Passionate about AI and startups"
                            disabled={profileUpdateLoading}
                          />
                        </div>
                        </div>
                      </div>

                      {/* Location & Contact Information Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0 overflow-hidden">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="min-w-0">Location & Contact</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full">
                          {/* City */}
                          <div className="w-full min-w-0">
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                              City
                            </label>
                            <input
                              id="city"
                              name="city"
                              type="text"
                              value={editFormData.city}
                              onChange={handleEditFormChange}
                              onBlur={handleBlurSave}
                              className="w-full max-w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
                              placeholder="e.g., New York, London, Tel Aviv"
                              disabled={profileUpdateLoading}
                            />
                          </div>

                          {/* Country */}
                          <div className="w-full min-w-0">
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                              Country
                            </label>
                            <input
                              id="country"
                              name="country"
                              type="text"
                              value={editFormData.country}
                              onChange={handleEditFormChange}
                              onBlur={handleBlurSave}
                              className="w-full max-w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
                              placeholder="e.g., United States, Israel, United Kingdom"
                              disabled={profileUpdateLoading}
                            />
                          </div>

                          {/* Timezone */}
                          <div className="w-full min-w-0">
                            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                              Timezone
                            </label>
                            <select
                              id="timezone"
                              name="timezone"
                              value={editFormData.timezone}
                              onChange={handleEditFormChange}
                              onBlur={handleBlurSave}
                              className="w-full max-w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
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
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0 overflow-hidden">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                          <Globe className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500 flex-shrink-0" />
                          <span className="min-w-0">Social Media & Online Presence</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full">
                          {/* Website */}
                          <div className="w-full min-w-0">
                            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                              Website
                            </label>
                            <div className="relative w-full">
                              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                              <input
                                id="website"
                                name="website"
                                type="url"
                                value={editFormData.website}
                                onChange={handleEditFormChange}
                                onBlur={handleBlurSave}
                                className="w-full max-w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
                                placeholder="e.g., mycompany.com or https://myportfolio.com"
                                disabled={profileUpdateLoading}
                              />
                            </div>
                          </div>

                          {/* Twitter */}
                          <div className="w-full min-w-0">
                            <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 mb-2">
                              Twitter/X Username
                            </label>
                            <div className="relative w-full">
                              <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                              <input
                                id="twitter"
                                name="twitter"
                                type="text"
                                value={editFormData.twitter}
                                onChange={handleEditFormChange}
                                onBlur={handleBlurSave}
                                className="w-full max-w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-base min-h-[44px] md:min-h-0 box-border"
                                placeholder="e.g., johndoe (without @ or twitter.com)"
                                disabled={profileUpdateLoading}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* About You Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 w-full max-w-full min-w-0 overflow-hidden">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">About You</h3>
                        <div className="space-y-4 sm:space-y-6 w-full max-w-full">
                          {/* Bio */}
                          <div className="w-full min-w-0">
                            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                              Personal Bio
                            </label>
                            <RichTextBioEditor
                              value={editFormData.bio}
                              onChange={(html) => handleEditFormChange({ target: { name: 'bio', value: html } } as React.ChangeEvent<HTMLTextAreaElement>)}
                              onBlur={handleBlurSave}
                              placeholder="Tell us about yourself, your background, interests, and what you're passionate about..."
                              disabled={profileUpdateLoading}
                              maxLength={2000}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Share your story, interests, and what drives you professionally. Use the toolbar for bold, italic, underline, and highlight.
                            </p>
                          </div>

                          {/* Skills */}
                          <div className="w-full min-w-0">
                            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-2">
                              Skills & Expertise
                            </label>
                            <textarea
                              id="skills"
                              name="skills"
                              rows={3}
                              value={skillsInputValue}
                              onChange={handleSkillsInputChange}
                              onBlur={handleBlurSave}
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
                              className="w-full max-w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none text-base sm:text-base min-h-[100px] sm:min-h-[80px] box-border"
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
                      <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <p className="text-xs sm:text-sm text-gray-600">
                            Changes are saved automatically when you click away or after you stop typing.
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4 w-full sm:w-auto">
                            <SavedIndicator savedAt={lastSavedAt} saving={profileUpdateLoading} />
                            <div className="flex gap-3 sm:space-x-4">
                              <button
                                onClick={handleCancelEdit}
                                disabled={profileUpdateLoading}
                                className="px-6 py-3 sm:py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:shadow-sm active:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation w-full sm:w-auto"
                              >
                                <div className="flex items-center justify-center sm:justify-start space-x-2">
                                  <X className="h-4 w-4" />
                                  <span>Cancel</span>
                                </div>
                              </button>
                              <button
                                onClick={() => setIsEditingProfile(false)}
                                disabled={profileUpdateLoading}
                                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 sm:px-8 py-3 rounded-xl hover:shadow-lg active:shadow-md transition-all duration-300 font-medium flex items-center justify-center sm:justify-start space-x-2 disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation w-full sm:w-auto"
                              >
                                <Check className="h-4 w-4" />
                                <span>Done</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DashboardProfileView
                      user={user as import('../types/user').UserProfile}
                      profileImageUrl={profileImageUrl}
                      profileImageCrop={profileImageCrop}
                      imageUploadError={imageUploadError}
                      formatPosition={formatPosition}
                    />
                  )}

                </div>
              </div>

              {!isEditingProfile && (
                <aside className="space-y-3 min-w-0 lg:sticky lg:top-[calc(var(--content-offset-top)+0.5rem)] lg:self-start">
                  <DashboardUpcomingEvents
                    events={events}
                    upcomingRsvpRegistrations={upcomingRsvpRegistrations}
                    registrationsLoading={registrationsLoading}
                  />
                  <ConnectionsCard sidebar />
                  <div
                    className={`rounded-xl p-3 border ${
                      profileCompletion.percentage === 100
                        ? 'bg-green-50 border-green-100'
                        : 'bg-gradient-to-br from-brand-light to-blue-50 border-blue-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">Profile strength</h3>
                      {profileCompletion.percentage === 100 ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-brand-blue" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            profileCompletion.percentage === 100
                              ? 'bg-green-500'
                              : 'bg-brand-blue'
                          }`}
                          style={{ width: `${profileCompletion.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{profileCompletion.percentage}%</span>
                    </div>
                  </div>
                  {pastEventsAttended.length > 0 && (
                    <div className="px-1 pt-0.5">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                        Attended
                      </p>
                      <ul className="space-y-0 max-h-9 overflow-y-auto leading-tight">
                        {pastAttendedDisplay.map((event) => (
                          <li key={event.id} className="leading-none">
                            <button
                              type="button"
                              onClick={(e) => handleEventClick(e, event.slug)}
                              className="text-[10px] text-gray-500 hover:text-brand-dark truncate max-w-full text-left py-px"
                            >
                              {event.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {hasMorePastAttended && !showAllPast && (
                        <button
                          type="button"
                          onClick={() => setShowAllPast(true)}
                          className="text-[9px] text-brand-blue font-medium mt-0.5"
                        >
                          +{pastEventsAttended.length - 3} more
                        </button>
                      )}
                    </div>
                  )}
                </aside>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-brand-gold/15 to-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-xs text-gray-700 flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-brand-gold fill-current" />
                  Support AlmaLinks
                </p>
                <a
                  href="https://almalinks.org/donate.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-gold hover:text-amber-700"
                >
                  Donate →
                </a>
            </div>
          </div>
        </section>
      )}

      {/* No Events State */}
      {events.length === 0 && (
        <section className="py-12 sm:py-16 bg-white overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
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
              <BackButton
                fallbackTo="/events"
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-xl hover:shadow-lg active:shadow-md transition-all duration-300 font-medium inline-flex items-center justify-center min-h-[44px] sm:min-h-0 touch-manipulation"
                iconClassName="h-4 w-4"
              />
            </div>
          </div>
        </section>
      )}

      <Footer />

    </div>
  );
};

export default DashboardPage;