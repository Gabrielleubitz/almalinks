import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Filter, Users, MapPin, Briefcase, Mail, Linkedin, 
  Phone, Eye, UserPlus, MessageCircle, X, Grid, List,
  ChevronDown, Globe, Building2, Hash
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { UserCard, UserDirectoryFilters } from '../types/user';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ImageWithCrop from '../components/profile/ImageWithCrop';
import { TrusteeMentorStar } from '../components/common/TrusteeMentorStar';
import { compareMembersByDisplayName } from '../utils/memberSort';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

const UserDirectoryPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserCard[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<UserDirectoryFilters>({});
  
  // Filter options
  const [skillOptions, setSkillOptions] = useState<FilterOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<FilterOption[]>([]);
  const [cityOptions, setCityOptions] = useState<FilterOption[]>([]);
  const [companyOptions, setCompanyOptions] = useState<FilterOption[]>([]);

  useEffect(() => {
    loadUsers();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, filters]);

  const loadUsers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const directoryUsers = await UserService.getUserDirectory(
        user.uid,
        user.role,
        {},
        100
      );
      
      setUsers(directoryUsers);
      generateFilterOptions(directoryUsers);
      
    } catch (error) {
      console.error('❌ Error loading user directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateFilterOptions = (users: UserCard[]) => {
    // Generate skill options
    const skillMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const companyMap = new Map<string, number>();

    users.forEach(user => {
      // Skills
      user.skills?.forEach(skill => {
        skillMap.set(skill, (skillMap.get(skill) || 0) + 1);
      });

      // Countries
      if (user.country) {
        countryMap.set(user.country, (countryMap.get(user.country) || 0) + 1);
      }

      // Cities
      if (user.city) {
        cityMap.set(user.city, (cityMap.get(user.city) || 0) + 1);
      }

      // Companies
      if (user.company) {
        companyMap.set(user.company, (companyMap.get(user.company) || 0) + 1);
      }
    });

    // Convert to sorted arrays
    setSkillOptions(
      Array.from(skillMap.entries())
        .map(([skill, count]) => ({ label: skill, value: skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Top 20 skills
    );

    setCountryOptions(
      Array.from(countryMap.entries())
        .map(([country, count]) => ({ label: country, value: country, count }))
        .sort((a, b) => b.count - a.count)
    );

    setCityOptions(
      Array.from(cityMap.entries())
        .map(([city, count]) => ({ label: city, value: city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15) // Top 15 cities
    );

    setCompanyOptions(
      Array.from(companyMap.entries())
        .map(([company, count]) => ({ label: company, value: company, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15) // Top 15 companies
    );
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.displayName.toLowerCase().includes(term) ||
        user.title?.toLowerCase().includes(term) ||
        user.company?.toLowerCase().includes(term) ||
        user.city?.toLowerCase().includes(term) ||
        user.country?.toLowerCase().includes(term) ||
        user.skills.some(skill => skill.toLowerCase().includes(term))
      );
    }

    // Skills filter
    if (filters.skills && filters.skills.length > 0) {
      filtered = filtered.filter(user => 
        filters.skills!.some(skill => 
          user.skills.some(userSkill => 
            userSkill.toLowerCase().includes(skill.toLowerCase())
          )
        )
      );
    }

    // Location filters
    if (filters.country) {
      filtered = filtered.filter(user => user.country === filters.country);
    }

    if (filters.city) {
      filtered = filtered.filter(user => user.city === filters.city);
    }

    // Company filter
    if (filters.company) {
      filtered = filtered.filter(user => user.company === filters.company);
    }

    // Title filter
    if (filters.title) {
      filtered = filtered.filter(user => 
        user.title?.toLowerCase().includes(filters.title!.toLowerCase())
      );
    }

    filtered.sort(compareMembersByDisplayName);
    setFilteredUsers(filtered);
  };

  const updateFilter = (key: keyof UserDirectoryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const removeSkillFilter = (skillToRemove: string) => {
    const updatedSkills = filters.skills?.filter(skill => skill !== skillToRemove) || [];
    updateFilter('skills', updatedSkills.length > 0 ? updatedSkills : undefined);
  };

  const addSkillFilter = (skill: string) => {
    const currentSkills = filters.skills || [];
    if (!currentSkills.includes(skill)) {
      updateFilter('skills', [...currentSkills, skill]);
    }
  };

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
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : true)
  ) || searchTerm;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <Header />
      
      <div className="pt-[var(--content-offset-top)] pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Member Directory
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover and connect with professionals in our community. Find people by skills, location, or interests.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, title, company, skills, or location..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
              </div>

              {/* View Mode and Filter Toggle */}
              <div className="flex items-center space-x-4">
                {/* View Mode */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors duration-200 ${
                      viewMode === 'grid' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <Grid className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors duration-200 ${
                      viewMode === 'list' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl border transition-colors duration-200 ${
                    showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <span className="bg-brand-dark text-white text-xs rounded-full px-2 py-0.5">
                      {[
                        searchTerm ? 1 : 0,
                        filters.skills?.length || 0,
                        filters.country ? 1 : 0,
                        filters.city ? 1 : 0,
                        filters.company ? 1 : 0,
                        filters.title ? 1 : 0
                      ].reduce((a, b) => a + b)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Skills Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Skills
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {skillOptions.map((skill) => (
                        <label
                          key={skill.value}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.skills?.includes(skill.value) || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                addSkillFilter(skill.value);
                              } else {
                                removeSkillFilter(skill.value);
                              }
                            }}
                            className="rounded border-gray-300 text-brand-blue focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {skill.label} ({skill.count})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Country Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Country
                    </label>
                    <select
                      value={filters.country || ''}
                      onChange={(e) => updateFilter('country', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Countries</option>
                      {countryOptions.map((country) => (
                        <option key={country.value} value={country.value}>
                          {country.label} ({country.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      City
                    </label>
                    <select
                      value={filters.city || ''}
                      onChange={(e) => updateFilter('city', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Cities</option>
                      {cityOptions.map((city) => (
                        <option key={city.value} value={city.value}>
                          {city.label} ({city.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Company Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Company
                    </label>
                    <select
                      value={filters.company || ''}
                      onChange={(e) => updateFilter('company', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Companies</option>
                      {companyOptions.map((company) => (
                        <option key={company.value} value={company.value}>
                          {company.label} ({company.count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters */}
                {hasActiveFilters && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {filters.skills?.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm"
                          >
                            <Hash className="h-3 w-3" />
                            <span>{skill}</span>
                            <button
                              onClick={() => removeSkillFilter(skill)}
                              className="text-brand-blue hover:text-brand-blue-hover"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        
                        {filters.country && (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                            <Globe className="h-3 w-3" />
                            <span>{filters.country}</span>
                            <button
                              onClick={() => updateFilter('country', undefined)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                        
                        {filters.city && (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                            <MapPin className="h-3 w-3" />
                            <span>{filters.city}</span>
                            <button
                              onClick={() => updateFilter('city', undefined)}
                              className="text-brand-dark hover:text-purple-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                        
                        {filters.company && (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                            <Building2 className="h-3 w-3" />
                            <span>{filters.company}</span>
                            <button
                              onClick={() => updateFilter('company', undefined)}
                              className="text-yellow-600 hover:text-yellow-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                      
                      <button
                        onClick={clearFilters}
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Grid/List */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {hasActiveFilters ? 'No matching members' : 'No members found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {hasActiveFilters 
                  ? 'Try adjusting your search criteria or clearing filters'
                  : 'Members will appear here once they join the platform'
                }
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-mid transition-colors duration-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }>
              {filteredUsers.map((userCard) => {
                const avatarColor = getAvatarColor(userCard.displayName);
                const avatarFallback = (
                  <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-xl`}>
                    {userCard.displayName.charAt(0)}
                  </div>
                );

                return viewMode === 'grid' ? (
                  // Grid Card
                  <div
                    key={userCard.uid}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                  >
                    <div className="p-6">
                      <div className="flex items-center space-x-4 mb-4">
                        <Link
                          to={`/profile/${userCard.uid}`}
                          className="block w-16 h-16 rounded-full overflow-hidden flex-shrink-0 relative"
                        >
                          <ImageWithCrop
                            src={String(userCard.avatarUrl || '')}
                            crop={null}
                            shape="circle"
                            alt={userCard.displayName}
                            className="rounded-full"
                            urlIsCropped={true}
                            fallback={avatarFallback}
                          />
                        </Link>
                        
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/profile/${userCard.uid}`}
                            className="block"
                          >
                            <h3 className="font-bold text-gray-900 truncate group-hover:text-brand-blue transition-colors duration-200 flex items-center gap-1.5 min-w-0">
                              <span className="truncate min-w-0">{userCard.displayName}</span>
                              <TrusteeMentorStar isTrustee={userCard.isTrustee} isMentor={userCard.isMentor} />
                            </h3>
                            {(userCard.title || userCard.company) && (
                              <p className="text-gray-600 text-sm truncate">
                                {userCard.title && userCard.company 
                                  ? `${userCard.title} @ ${userCard.company}`
                                  : userCard.title || userCard.company
                                }
                              </p>
                            )}
                          </Link>
                        </div>
                      </div>

                      {(userCard.city || userCard.country) && (
                        <div className="flex items-center text-gray-500 text-sm mb-4">
                          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">
                            {[userCard.city, userCard.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Skills */}
                      {userCard.skills && userCard.skills.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1">
                            {userCard.skills.slice(0, 3).map((skill, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                            {userCard.skills.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                                +{userCard.skills.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {userCard.canConnect && (
                          <button className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors duration-200 text-sm font-medium">
                            <UserPlus className="h-4 w-4" />
                            <span>Connect</span>
                          </button>
                        )}
                        
                        <Link
                          to={`/profile/${userCard.uid}`}
                          className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  // List Item
                  <div
                    key={userCard.uid}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6 flex-1">
                        <Link
                          to={`/profile/${userCard.uid}`}
                          className="block w-16 h-16 rounded-full overflow-hidden flex-shrink-0 relative"
                        >
                          <ImageWithCrop
                            src={String(userCard.avatarUrl || '')}
                            crop={null}
                            shape="circle"
                            alt={userCard.displayName}
                            className="rounded-full"
                            urlIsCropped={true}
                            fallback={avatarFallback}
                          />
                        </Link>
                        
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${userCard.uid}`}>
                            <h3 className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors duration-200 mb-1 flex items-center gap-1.5 min-w-0">
                              <span className="truncate min-w-0">{userCard.displayName}</span>
                              <TrusteeMentorStar isTrustee={userCard.isTrustee} isMentor={userCard.isMentor} />
                            </h3>
                          </Link>
                          
                          {(userCard.title || userCard.company) && (
                            <p className="text-gray-600 mb-2">
                              {userCard.title && userCard.company 
                                ? `${userCard.title} @ ${userCard.company}`
                                : userCard.title || userCard.company
                              }
                            </p>
                          )}
                          
                          {(userCard.city || userCard.country) && (
                            <div className="flex items-center text-gray-500 text-sm">
                              <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>
                                {[userCard.city, userCard.country].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Skills in List View */}
                        {userCard.skills && userCard.skills.length > 0 && (
                          <div className="hidden lg:block flex-shrink-0">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {userCard.skills.slice(0, 4).map((skill, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                >
                                  {skill}
                                </span>
                              ))}
                              {userCard.skills.length > 4 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                                  +{userCard.skills.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-3">
                        {userCard.canConnect && (
                          <button className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors duration-200 font-medium">
                            <UserPlus className="h-4 w-4" />
                            <span>Connect</span>
                          </button>
                        )}
                        
                        <Link
                          to={`/profile/${userCard.uid}`}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Profile</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserDirectoryPage;