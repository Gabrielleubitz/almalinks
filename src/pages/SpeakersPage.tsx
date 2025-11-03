import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Briefcase, Mic, Calendar, MapPin, Clock, Linkedin } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Speaker {
  id: string;
  name: string;
  email: string;
  bio?: string;
  company?: string;
  role?: string;
  position?: string;
  linkedinUsername?: string;
  profileImage?: string | null;
  imageUrl?: string;
  events?: string[];
}

const SpeakersPage: React.FC = () => {
  const navigate = useNavigate();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpeakers();
  }, []);

  const loadSpeakers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all events to find speakers
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      const speakersMap = new Map<string, Speaker>();
      
      // Extract speakers from all events
      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const eventSpeakers = eventData.speakers || [];
        
        // Add each speaker to the map (to avoid duplicates)
        eventSpeakers.forEach((speaker: any) => {
          if (speaker.userId && speaker.name) {
            speakersMap.set(speaker.userId, {
              id: speaker.userId,
              name: speaker.name,
              email: speaker.email || '',
              position: speaker.position || '',
              linkedinUsername: speaker.linkedinUsername || '',
              profileImage: speaker.profileImage || null,
              events: speakersMap.has(speaker.userId) 
                ? [...(speakersMap.get(speaker.userId)?.events || []), eventDoc.id]
                : [eventDoc.id]
            });
          }
        });
      }
      
      // Also check users with speaker role
      const usersRef = collection(db, 'users');
      const speakersQuery = query(usersRef, where('role', '==', 'speaker'));
      const speakersSnapshot = await getDocs(speakersQuery);
      
      speakersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (!speakersMap.has(doc.id)) {
          speakersMap.set(doc.id, {
            id: doc.id,
            name: userData.displayName || userData.name || 'Unknown Speaker',
            email: userData.email || '',
            bio: userData.bio,
            company: userData.company,
            role: userData.work,
            position: userData.position,
            linkedinUsername: userData.linkedinUsername,
            profileImage: userData.profileImage || null
          });
        } else {
          // Update existing speaker with additional info
          const existingSpeaker = speakersMap.get(doc.id);
          if (existingSpeaker) {
            speakersMap.set(doc.id, {
              ...existingSpeaker,
              bio: userData.bio || existingSpeaker.bio,
              company: userData.company || existingSpeaker.company,
              role: userData.work || existingSpeaker.role,
              position: userData.position || existingSpeaker.position,
              linkedinUsername: userData.linkedinUsername || existingSpeaker.linkedinUsername,
              profileImage: userData.profileImage || existingSpeaker.profileImage
            });
          }
        }
      });
      
      // Convert map to array
      const speakersArray = Array.from(speakersMap.values());
      setSpeakers(speakersArray);
      
      console.log('✅ Loaded speakers:', speakersArray.length);
    } catch (err: any) {
      console.error('❌ Error loading speakers:', err);
      setError('Failed to load speakers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Generate a color based on speaker name for avatar background
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-yellow-500 to-yellow-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600'
    ];
    
    // Simple hash function to get consistent color for same name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Format position for display
  const formatPosition = (position: string | undefined): string => {
    if (!position) return '';
    
    const positionMap: Record<string, string> = {
      'investor': 'Investor',
      'c_level': 'C-Level Executive',
      'vp_level': 'VP Level',
      'director': 'Director',
      'senior_manager': 'Senior Manager',
      'manager': 'Manager',
      'senior_contributor': 'Senior Contributor',
      'individual_contributor': 'Individual Contributor',
      'junior_level': 'Junior Level',
      'founder': 'Founder',
      'consultant': 'Consultant',
      'student': 'Student',
      'other': 'Other'
    };
    
    return positionMap[position] || position;
  };

  // Format LinkedIn username for display
  const formatLinkedinUrl = (username: string | undefined) => {
    if (!username) return '';
    
    // Remove any linkedin.com prefix if present
    const cleanUsername = username.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '');
    
    // Remove trailing slash if present
    return cleanUsername.replace(/\/$/, '');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Previous Page</span>
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 fade-in">
              Our <span className="gradient-text">Speakers</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed fade-in-delay">
              Meet the industry leaders and innovators who share their insights at AlmaLinks network events.
            </p>
          </div>
        </div>
      </section>

      {/* Speakers Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading speakers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-2xl">
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={loadSpeakers}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : speakers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <Mic className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Speakers Found</h3>
              <p className="text-gray-600">
                Check back soon for updates on our upcoming speakers.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {speakers.map((speaker, index) => (
                <div
                  key={speaker.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover-lift slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="p-8">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 rounded-full overflow-hidden">
                        {speaker.profileImage ? (
                          <img 
                            src={speaker.profileImage} 
                            alt={speaker.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                            }}
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(speaker.name)} flex items-center justify-center text-white font-bold text-2xl`}>
                            {speaker.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{speaker.name}</h3>
                        <p className="text-gray-600">{speaker.role || speaker.company || 'Speaker'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {speaker.email && (
                        <div className="flex items-center space-x-3 text-gray-600">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <span>{speaker.email}</span>
                        </div>
                      )}
                      
                      {speaker.position && (
                        <div className="flex items-center space-x-3 text-gray-600">
                          <Briefcase className="h-5 w-5 text-gray-400" />
                          <span>{formatPosition(speaker.position)}</span>
                        </div>
                      )}
                      
                      {speaker.linkedinUsername && (
                        <div className="flex items-center space-x-3 text-gray-600">
                          <Linkedin className="h-5 w-5 text-blue-500" />
                          <a 
                            href={`https://linkedin.com/in/${formatLinkedinUrl(speaker.linkedinUsername)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-light hover:text-brand-mid hover:underline"
                          >
                            {formatLinkedinUrl(speaker.linkedinUsername)}
                          </a>
                        </div>
                      )}
                    </div>

                    {speaker.bio && (
                      <p className="text-gray-600 mb-6 line-clamp-3">
                        {speaker.bio}
                      </p>
                    )}

                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Mic className="h-5 w-5 text-red-600" />
                          <span className="text-gray-700 font-medium">Alma Links Speaker</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-gradient-to-br from-red-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Interested in Speaking at Alma Links?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Share your expertise with our exclusive community of founders, investors, and operators.
          </p>
          <a
            href="mailto:speakers@almalinks.com?subject=Speaking at Alma Links"
            className="inline-flex items-center justify-center bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
          >
            Apply to Speak
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SpeakersPage;