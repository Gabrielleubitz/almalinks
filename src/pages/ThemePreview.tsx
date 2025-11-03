import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  Star, 
  Heart, 
  MessageCircle, 
  Bell,
  Search,
  Plus,
  Edit,
  Save,
  X,
  Check,
  AlertCircle,
  Info
} from 'lucide-react';

const ThemePreview: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-text mb-4">
            Theme Preview
          </h1>
          <p className="text-xl text-muted">
            Testing the new Alma Links color palette
          </p>
        </div>

        {/* Color Swatches */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Color Palette</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="h-20 bg-brand-dark rounded-lg shadow-sm"></div>
              <div className="text-center">
                <p className="font-medium text-text">Brand Dark</p>
                <p className="text-sm text-muted">#1F2A5A</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="h-20 bg-brand-mid rounded-lg shadow-sm"></div>
              <div className="text-center">
                <p className="font-medium text-text">Brand Mid</p>
                <p className="text-sm text-muted">#195E9B</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="h-20 bg-brand-light rounded-lg shadow-sm"></div>
              <div className="text-center">
                <p className="font-medium text-text">Brand Light</p>
                <p className="text-sm text-muted">#2DA8E8</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="h-20 bg-muted rounded-lg shadow-sm"></div>
              <div className="text-center">
                <p className="font-medium text-text">Muted</p>
                <p className="text-sm text-muted">#6B7280</p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Buttons</h2>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <button className="px-6 py-3 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors font-medium">
                Primary Button
              </button>
              
              <button className="px-6 py-3 border border-brand-dark text-brand-dark rounded-lg hover:bg-brand-dark hover:text-white transition-colors font-medium">
                Secondary Button
              </button>
              
              <button className="px-6 py-3 text-brand-light hover:text-brand-mid transition-colors font-medium">
                Text Button
              </button>
              
              <button className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                Danger Button
              </button>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button className="p-3 bg-brand-dark text-white rounded-full hover:bg-brand-mid transition-colors">
                <Plus className="h-5 w-5" />
              </button>
              
              <button className="p-3 border border-brand-light text-brand-light rounded-full hover:bg-brand-light hover:text-white transition-colors">
                <Edit className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        {/* Form Elements */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Form Elements</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Text Input
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter some text..."
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light text-text"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Select Dropdown
                </label>
                <select className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light text-text">
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Textarea
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter a longer message..."
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light text-text resize-none"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="h-4 w-4 text-brand-light focus:ring-brand-light border-border rounded"
                />
                <label htmlFor="checkbox" className="text-text">
                  Checkbox option
                </label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="radio1"
                    name="radio"
                    className="h-4 w-4 text-brand-light focus:ring-brand-light border-border"
                  />
                  <label htmlFor="radio1" className="text-text">
                    Radio option 1
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="radio2"
                    name="radio"
                    className="h-4 w-4 text-brand-light focus:ring-brand-light border-border"
                  />
                  <label htmlFor="radio2" className="text-text">
                    Radio option 2
                  </label>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light text-text"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Links and Text */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Typography</h2>
          
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-text mb-2">Heading 1</h1>
              <h2 className="text-3xl font-semibold text-text mb-2">Heading 2</h2>
              <h3 className="text-2xl font-semibold text-text mb-2">Heading 3</h3>
              <h4 className="text-xl font-medium text-text">Heading 4</h4>
            </div>
            
            <div className="space-y-2">
              <p className="text-text">
                This is regular body text in the primary text color. It should be highly readable with good contrast.
              </p>
              <p className="text-muted">
                This is secondary text in the muted color. It's used for less important information.
              </p>
            </div>
            
            <div className="space-y-2">
              <p>
                Links: <a href="#" className="text-brand-light hover:text-brand-mid hover:underline transition-colors">Regular link</a>
              </p>
              <p>
                <a href="#" className="text-brand-light hover:text-brand-mid underline transition-colors">
                  Underlined link
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Cards and Surfaces */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Cards & Surfaces</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-brand-light bg-opacity-10 rounded-lg">
                  <User className="h-6 w-6 text-brand-light" />
                </div>
                <h3 className="font-semibold text-text">User Profile</h3>
              </div>
              <p className="text-muted mb-4">
                This is a sample card with user information and actions.
              </p>
              <button className="w-full px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors">
                View Profile
              </button>
            </div>
            
            <div className="bg-white border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="font-semibold text-text">Premium Feature</h3>
              </div>
              <p className="text-muted mb-4">
                This card shows premium features with appropriate styling.
              </p>
              <button className="w-full px-4 py-2 border border-brand-dark text-brand-dark rounded-lg hover:bg-brand-dark hover:text-white transition-colors">
                Learn More
              </button>
            </div>
            
            <div className="bg-white border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-text">Messages</h3>
              </div>
              <p className="text-muted mb-4">
                Chat and messaging features with consistent theming.
              </p>
              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 text-brand-light hover:text-brand-mid transition-colors">
                  View All
                </button>
                <button className="flex-1 px-3 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors">
                  Reply
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Alerts and Status */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Alerts & Status</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-5 w-5 text-brand-light flex-shrink-0" />
              <p className="text-brand-dark">
                This is an informational alert using brand colors.
              </p>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">
                Success! Your action was completed successfully.
              </p>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-yellow-800">
                Warning: Please review your settings before proceeding.
              </p>
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <X className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800">
                Error: Something went wrong. Please try again.
              </p>
            </div>
          </div>
        </section>

        {/* Chips and Tags */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Chips & Tags</h2>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-brand-light bg-opacity-10 text-brand-light rounded-full text-sm font-medium">
              Brand Light
            </span>
            <span className="px-3 py-1 bg-brand-dark bg-opacity-10 text-brand-dark rounded-full text-sm font-medium">
              Brand Dark
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Neutral
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Success
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
              Warning
            </span>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              Error
            </span>
          </div>
        </section>

        {/* Gradient Text */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Gradient Elements</h2>
          
          <div className="space-y-4">
            <h3 className="text-3xl font-bold gradient-text">
              Gradient Heading
            </h3>
            <p className="text-xl gradient-text-bold-ideas">
              Bold Ideas Gradient
            </p>
          </div>
        </section>

        {/* Interactive Demo */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-text">Interactive Demo</h2>
          
          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text">Notification Settings</h3>
              <button
                onClick={() => setShowAlert(!showAlert)}
                className="text-brand-light hover:text-brand-mid transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
            
            {showAlert && (
              <div className="mb-4 p-3 bg-brand-light bg-opacity-10 border border-brand-light border-opacity-30 rounded-lg">
                <p className="text-brand-dark text-sm">
                  Notifications are now enabled! You'll receive updates about new messages and events.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="h-4 w-4 text-brand-light focus:ring-brand-light border-border rounded" />
                <span className="text-text">Email notifications</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="h-4 w-4 text-brand-light focus:ring-brand-light border-border rounded" defaultChecked />
                <span className="text-text">Push notifications</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="h-4 w-4 text-brand-light focus:ring-brand-light border-border rounded" />
                <span className="text-text">SMS notifications</span>
              </label>
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors">
                Save Changes
              </button>
              <button className="px-4 py-2 text-brand-light hover:text-brand-mid transition-colors">
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="text-muted">
            Theme Preview - Alma Links Color Palette
          </p>
          <p className="text-sm text-muted mt-2">
            All components styled with the new brand colors
          </p>
        </footer>
      </div>
    </div>
  );
};

export default ThemePreview;