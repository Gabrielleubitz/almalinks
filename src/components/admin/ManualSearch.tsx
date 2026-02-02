import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface ManualSearchProps {
  onSearch: (email: string) => Promise<void>;
  searching: boolean;
}

const ManualSearch: React.FC<ManualSearchProps> = ({ onSearch, searching }) => {
  const [searchEmail, setSearchEmail] = useState('');

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    await onSearch(searchEmail.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
        <Search className="h-6 w-6" />
        <span>Manual Search</span>
      </h2>

      <div className="space-y-6">
        {/* Search Form */}
        <div>
          <label htmlFor="searchEmail" className="block text-sm font-medium text-gray-700 mb-2">
            Search by Email Address
          </label>
          <div className="flex space-x-3">
            <input
              id="searchEmail"
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter attendee's email address"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchEmail.trim()}
              className="bg-brand-dark text-white px-6 py-3 rounded-xl hover:bg-brand-mid transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {searching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span>{searching ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </div>

        {/* Search Instructions */}
        <div className="bg-gray-50 rounded-2xl p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Manual search:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Enter the attendee's email address</li>
            <li>• Click "Search" to find their registration</li>
            <li>• Useful for manual lookups</li>
            <li>• All registered emails are searchable</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ManualSearch;