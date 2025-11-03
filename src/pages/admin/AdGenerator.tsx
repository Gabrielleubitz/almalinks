import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  Wand2, 
  Image as ImageIcon, 
  Download, 
  Copy, 
  RefreshCw,
  Plus,
  Facebook,
  Search,
  Globe,
  Zap,
  Lightbulb,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import OpenAIService from '../../services/openaiService';

// Types
interface BusinessInfo {
  businessName: string;
  productService: string;
  targetCustomer: string;
  industry: string;
  brandTone: string;
  websiteUrl?: string;
}

interface AdCreativeData {
  id: string;
  headline: string;
  body: string;
  platform: 'facebook' | 'google';
  imageUrl?: string;
  imagePrompt?: string;
  imageType?: 'generated';
  createdAt: string;
}

const AdGenerator: React.FC = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [ads, setAds] = useState<AdCreativeData[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    businessName: 'Alma Links',
    productService: 'Networking events for entrepreneurs',
    targetCustomer: 'Entrepreneurs and business professionals',
    industry: 'Events & Networking',
    brandTone: 'Professional yet approachable'
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<string | null>(null);

  // Show loading while checking admin status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const generateAdCopy = async (platform: 'facebook' | 'google') => {
    const newAd: AdCreativeData = {
      id: `${platform}-${Date.now()}`,
      headline: `Join Alma Links - ${platform === 'facebook' ? 'Network & Grow' : 'Professional Networking Events'}`,
      body: platform === 'facebook' 
        ? `Connect with like-minded entrepreneurs over fine wine and meaningful conversations. Build lasting business relationships in an elegant setting. 🍷✨`
        : `Exclusive networking events for entrepreneurs. Join Alma Links for meaningful business connections in a sophisticated atmosphere.`,
      platform,
      createdAt: new Date().toISOString()
    };
    
    setAds(prev => [...prev, newAd]);
  };

  const updateAd = (id: string, updates: Partial<AdCreativeData>) => {
    setAds(prev => prev.map(ad => ad.id === id ? { ...ad, ...updates } : ad));
  };

  const deleteAd = (id: string) => {
    setAds(prev => prev.filter(ad => ad.id !== id));
  };

  const generateImage = async (adId: string, prompt: string) => {
    if (!prompt.trim()) {
      alert('Please enter an image prompt');
      return;
    }

    // Check if OpenAI API key is configured
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      alert('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
      return;
    }

    setIsGeneratingImage(adId);
    
    try {
      console.log('🎨 Generating image with DALL-E 3...');
      
      const imageUrl = await OpenAIService.generateImage({
        prompt,
        size: '1024x1024',
        quality: 'hd', // Use HD quality for best results
        style: 'vivid' // Vivid style for eye-catching ads
      });
      
      updateAd(adId, {
        imageUrl,
        imagePrompt: prompt,
        imageType: 'generated'
      });
      
      alert('🎉 High-quality image generated successfully with DALL-E 3!');
    } catch (error: any) {
      console.error('❌ Error generating image:', error);
      alert(`Failed to generate image: ${error.message}`);
    } finally {
      setIsGeneratingImage(null);
    }
  };

  const copyAdText = (ad: AdCreativeData) => {
    const text = `${ad.headline}\n\n${ad.body}`;
    navigator.clipboard.writeText(text);
    alert('Ad copy copied to clipboard!');
  };

  const downloadImage = (ad: AdCreativeData) => {
    if (ad.imageUrl) {
      const link = document.createElement('a');
      link.href = ad.imageUrl;
      link.download = `${ad.platform}-ad-${ad.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert('Image download started!');
    }
  };

  const exportAds = () => {
    const exportData = ads.map(ad => ({
      platform: ad.platform,
      headline: ad.headline,
      body: ad.body,
      imageUrl: ad.imageUrl,
      createdAt: ad.createdAt
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alma-links-ads-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Ads exported successfully!');
  };

  const facebookAds = ads.filter(ad => ad.platform === 'facebook');
  const googleAds = ads.filter(ad => ad.platform === 'google');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Ad Generator" 
        subtitle="Create AI-powered video and image ads for Alma Links events"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Ad Generator</h1>
            <p className="text-gray-600">
              Create professional ads with AI-generated copy and images
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportAds}
              disabled={ads.length === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Ads
            </button>
          </div>
        </div>

        {/* Business Info Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={businessInfo.businessName}
                onChange={(e) => setBusinessInfo(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={businessInfo.industry}
                onChange={(e) => setBusinessInfo(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Customer</label>
              <input
                type="text"
                value={businessInfo.targetCustomer}
                onChange={(e) => setBusinessInfo(prev => ({ ...prev, targetCustomer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Tone</label>
              <select
                value={businessInfo.brandTone}
                onChange={(e) => setBusinessInfo(prev => ({ ...prev, brandTone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Professional yet approachable">Professional yet approachable</option>
                <option value="Casual and friendly">Casual and friendly</option>
                <option value="Luxury and exclusive">Luxury and exclusive</option>
                <option value="Energetic and dynamic">Energetic and dynamic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Facebook Ads Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Facebook className="w-6 h-6 text-brand-light" />
              <h2 className="text-xl font-semibold text-gray-900">Facebook Ads</h2>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-800 text-xs rounded-full">
                {facebookAds.length} ads
              </span>
            </div>
            <button
              onClick={() => generateAdCopy('facebook')}
              className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Facebook Ad
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {facebookAds.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                businessInfo={businessInfo}
                onUpdate={updateAd}
                onDelete={deleteAd}
                onGenerateImage={generateImage}
                onCopy={copyAdText}
                onDownload={downloadImage}
                isGeneratingImage={isGeneratingImage === ad.id}
                editingAd={editingAd}
                setEditingAd={setEditingAd}
              />
            ))}
          </div>

          {facebookAds.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 text-center">
              <Facebook className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Facebook Ads Yet</h3>
              <p className="text-gray-600 mb-4">Create your first Facebook ad to get started</p>
              <button
                onClick={() => generateAdCopy('facebook')}
                className="inline-flex items-center px-6 py-3 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Facebook Ad
              </button>
            </div>
          )}
        </div>

        {/* Google Ads Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Search className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">Google Ads</h2>
              <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {googleAds.length} ads
              </span>
            </div>
            <button
              onClick={() => generateAdCopy('google')}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Google Ad
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {googleAds.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                businessInfo={businessInfo}
                onUpdate={updateAd}
                onDelete={deleteAd}
                onGenerateImage={generateImage}
                onCopy={copyAdText}
                onDownload={downloadImage}
                isGeneratingImage={isGeneratingImage === ad.id}
                editingAd={editingAd}
                setEditingAd={setEditingAd}
              />
            ))}
          </div>

          {googleAds.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Google Ads Yet</h3>
              <p className="text-gray-600 mb-4">Create your first Google ad to get started</p>
              <button
                onClick={() => generateAdCopy('google')}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Google Ad
              </button>
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Ad Creative Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Facebook Ads Best Practices:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Keep headlines under 40 characters</li>
                <li>• Use engaging visuals that stop the scroll</li>
                <li>• Include a clear call-to-action</li>
                <li>• Test multiple variations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Google Ads Best Practices:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Include target keywords in headlines</li>
                <li>• Keep descriptions under 90 characters</li>
                <li>• Highlight unique selling propositions</li>
                <li>• Use ad extensions when possible</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Ad Card Component
interface AdCardProps {
  ad: AdCreativeData;
  businessInfo: BusinessInfo;
  onUpdate: (id: string, updates: Partial<AdCreativeData>) => void;
  onDelete: (id: string) => void;
  onGenerateImage: (adId: string, prompt: string) => void;
  onCopy: (ad: AdCreativeData) => void;
  onDownload: (ad: AdCreativeData) => void;
  isGeneratingImage: boolean;
  editingAd: string | null;
  setEditingAd: (id: string | null) => void;
}

const AdCard: React.FC<AdCardProps> = ({
  ad,
  businessInfo,
  onUpdate,
  onDelete,
  onGenerateImage,
  onCopy,
  onDownload,
  isGeneratingImage,
  editingAd,
  setEditingAd
}) => {
  // Generate smart prompt based on business info and ad content
  const generateSmartPrompt = () => {
    return OpenAIService.generateContextualImagePrompt(businessInfo, {
      headline: ad.headline,
      body: ad.body,
      platform: ad.platform
    });
  };

  const [editData, setEditData] = useState({
    headline: ad.headline,
    body: ad.body,
    imagePrompt: ad.imagePrompt || generateSmartPrompt()
  });

  const isEditing = editingAd === ad.id;

  const handleSave = () => {
    onUpdate(ad.id, editData);
    setEditingAd(null);
  };

  const handleCancel = () => {
    setEditData({
      headline: ad.headline,
      body: ad.body,
      imagePrompt: ad.imagePrompt || generateSmartPrompt()
    });
    setEditingAd(null);
  };

  const regenerateSmartPrompt = () => {
    const newPrompt = OpenAIService.generateContextualImagePrompt(businessInfo, {
      headline: editData.headline,
      body: editData.body,
      platform: ad.platform
    });
    setEditData(prev => ({ ...prev, imagePrompt: newPrompt }));
  };

  const generateBasicPrompt = () => {
    const basicPrompt = OpenAIService.generateBasicImagePrompt(businessInfo, ad.platform);
    setEditData(prev => ({ ...prev, imagePrompt: basicPrompt }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            ad.platform === 'facebook' 
              ? 'bg-blue-50 text-blue-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {ad.platform === 'facebook' ? 'Facebook' : 'Google'}
          </span>
          {ad.imageUrl && (
            <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium flex items-center">
              <ImageIcon className="w-3 h-3 mr-1" />
              With Image
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setEditingAd(isEditing ? null : ad.id)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCopy(ad)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(ad.id)}
            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
              <input
                type="text"
                value={editData.headline}
                onChange={(e) => setEditData(prev => ({ ...prev, headline: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter compelling headline"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body Text</label>
              <textarea
                value={editData.body}
                onChange={(e) => setEditData(prev => ({ ...prev, body: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter engaging ad copy"
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Image Prompt</label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={generateBasicPrompt}
                    className="text-xs text-brand-dark hover:text-purple-700 flex items-center"
                  >
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Basic
                  </button>
                  <button
                    type="button"
                    onClick={regenerateSmartPrompt}
                    className="text-xs text-brand-dark hover:text-purple-700 flex items-center"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Smart
                  </button>
                </div>
              </div>
              <textarea
                value={editData.imagePrompt}
                onChange={(e) => setEditData(prev => ({ ...prev, imagePrompt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Describe the image you want to generate..."
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Use "Smart" to generate a prompt based on your business info and ad content, or "Basic" for a simple prompt.
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => onGenerateImage(ad.id, editData.imagePrompt)}
                disabled={isGeneratingImage}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                {isGeneratingImage ? 'Generating...' : 'Generate Image'}
              </button>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ad Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-white p-4">
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{ad.headline}</h3>
                <p className="text-gray-700 text-sm">{ad.body}</p>
              </div>
              
              {ad.imageUrl ? (
                <div className="relative">
                  <img
                    src={ad.imageUrl}
                    alt="Generated ad image"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => onDownload(ad)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-200 border-dashed p-6 text-center bg-gray-50">
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-2">No Image Generated</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Generate an AI image for your {ad.platform} ad
                  </p>
                  <button
                    onClick={() => setEditingAd(ad.id)}
                    className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Image
                  </button>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{new Date(ad.createdAt).toLocaleDateString()}</span>
              </div>
              {ad.imageType && (
                <div className="flex justify-between">
                  <span>Image:</span>
                  <span className="capitalize">{ad.imageType}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdGenerator;