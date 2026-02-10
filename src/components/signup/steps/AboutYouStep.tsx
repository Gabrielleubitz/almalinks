import React, { useState } from 'react';
import { Briefcase, Building2, Lightbulb, FileText, Plus, X } from 'lucide-react';
import { UserProfileForm } from '../../../types/user';
import FormField from '../FormField';

interface AboutYouStepProps {
  formData: UserProfileForm;
  errors: Record<string, string>;
  touchedFields: Set<string>;
  onUpdate: (field: string, value: any) => void;
}

const AboutYouStep: React.FC<AboutYouStepProps> = ({
  formData,
  errors,
  touchedFields,
  onUpdate
}) => {
  const [newSkill, setNewSkill] = useState('');

  const addSkill = () => {
    if (newSkill.trim() && formData.skills.length < 12) {
      const trimmedSkill = newSkill.trim();
      if (!formData.skills.includes(trimmedSkill)) {
        onUpdate('skills', [...formData.skills, trimmedSkill]);
      }
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    const updatedSkills = formData.skills.filter((_, i) => i !== index);
    onUpdate('skills', updatedSkills);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your work</h2>
        <p className="text-gray-600">
          Help others understand your professional background and expertise
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Title */}
        <FormField
          label="Job Title"
          error={touchedFields.has('title') ? errors.title : undefined}
          helpText="Your current role or position"
        >
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                ${errors.title && touchedFields.has('title')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
              placeholder="e.g., Software Engineer, Product Manager"
              autoComplete="organization-title"
            />
          </div>
        </FormField>

        {/* Company */}
        <FormField
          label="Company"
          error={touchedFields.has('company') ? errors.company : undefined}
          helpText="Where do you currently work?"
        >
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.company}
              onChange={(e) => onUpdate('company', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                ${errors.company && touchedFields.has('company')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
              placeholder="e.g., Acme Corp, Freelance"
              autoComplete="organization"
            />
          </div>
        </FormField>

        {/* Chapter */}
        <FormField
          label="Chapter"
          error={touchedFields.has('chapter') ? errors.chapter : undefined}
          helpText="Your Alma Links chapter (e.g. region or cohort)"
        >
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.chapter}
              onChange={(e) => onUpdate('chapter', e.target.value)}
              className={`
                block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
                ${errors.chapter && touchedFields.has('chapter')
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }
                focus:ring-2 focus:ring-opacity-20
              `}
              placeholder="e.g., North America, Europe"
              autoComplete="off"
            />
          </div>
        </FormField>
      </div>

      {/* Bio Title */}
      <FormField
        label="Bio Title"
        error={touchedFields.has('bioTitle') ? errors.bioTitle : undefined}
        helpText="A short, catchy description of who you are (max 60 characters)"
      >
        <div className="relative">
          <Lightbulb className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={formData.bioTitle}
            onChange={(e) => onUpdate('bioTitle', e.target.value)}
            maxLength={60}
            className={`
              block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200
              ${errors.bioTitle && touchedFields.has('bioTitle')
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }
              focus:ring-2 focus:ring-opacity-20
            `}
            placeholder="e.g., Passionate developer building the future"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
            {formData.bioTitle.length}/60
          </div>
        </div>
      </FormField>

      {/* Bio */}
      <FormField
        label="About You"
        error={touchedFields.has('bio') ? errors.bio : undefined}
        helpText="Tell others about your background, interests, and what you're passionate about (max 400 characters)"
      >
        <div className="relative">
          <FileText className="absolute left-3 top-4 h-5 w-5 text-gray-400" />
          <textarea
            value={formData.bio}
            onChange={(e) => onUpdate('bio', e.target.value)}
            maxLength={400}
            rows={4}
            className={`
              block w-full pl-11 pr-4 py-3 border rounded-xl transition-colors duration-200 resize-none
              ${errors.bio && touchedFields.has('bio')
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }
              focus:ring-2 focus:ring-opacity-20
            `}
            placeholder="Share your story, what drives you, and what you're looking to achieve..."
          />
          <div className="absolute right-3 bottom-3 text-xs text-gray-400">
            {formData.bio.length}/400
          </div>
        </div>
      </FormField>

      {/* Skills */}
      <FormField
        label="Skills & Expertise"
        error={touchedFields.has('skills') ? errors.skills : undefined}
        helpText="Add up to 12 skills that represent your expertise"
      >
        {/* Skills Input */}
        <div className="flex space-x-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyPress={handleKeyPress}
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 focus:ring-2 focus:ring-opacity-20"
              placeholder="Type a skill and press Enter"
              maxLength={20}
              disabled={formData.skills.length >= 12}
            />
          </div>
          <button
            type="button"
            onClick={addSkill}
            disabled={!newSkill.trim() || formData.skills.length >= 12}
            className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Skills Display */}
        {formData.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(index)}
                  className="text-brand-light hover:text-brand-mid transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {formData.skills.length === 0 && (
          <div className="text-gray-500 text-sm italic py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
            Add some skills to help others find you
          </div>
        )}

        <div className="text-xs text-gray-500 mt-2">
          {formData.skills.length}/12 skills added
        </div>
      </FormField>

      {/* Preview Card */}
      <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
        <h3 className="font-semibold text-gray-900 mb-3">Preview</h3>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-gray-900">
              {formData.displayName || 'Your Name'}
            </h4>
            <p className="text-gray-600">
              {formData.title && formData.company 
                ? `${formData.title} @ ${formData.company}`
                : formData.title || formData.company || 'Your Title @ Company'
              }
            </p>
          </div>
          
          {formData.bioTitle && (
            <p className="text-brand-light font-medium">{formData.bioTitle}</p>
          )}
          
          {formData.bio && (
            <p className="text-gray-700 text-sm">{formData.bio}</p>
          )}
          
          {formData.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {formData.skills.slice(0, 5).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                >
                  {skill}
                </span>
              ))}
              {formData.skills.length > 5 && (
                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                  +{formData.skills.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AboutYouStep;