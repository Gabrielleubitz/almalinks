import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, User, Briefcase, MapPin, Shield } from 'lucide-react';
import { UserProfileForm, ProfileVisibility } from '../../types/user';
import { validateField, ValidationError, formatFieldName } from '../../utils/validation';
import { getVisibilityDescription } from '../../utils/privacy';
import ProfileBasicsStep from './steps/ProfileBasicsStep';
import AboutYouStep from './steps/AboutYouStep';
import ContactLocationStep from './steps/ContactLocationStep';
import PrivacyStep from './steps/PrivacyStep';
import SignupProgress from './SignupProgress';

export interface SignupWizardProps {
  initialData?: Partial<UserProfileForm>;
  onComplete: (data: UserProfileForm) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const STEPS = [
  {
    id: 'basics',
    title: 'Profile Basics',
    description: 'Tell us who you are',
    icon: User,
    fields: ['firstName', 'lastName', 'email', 'displayName']
  },
  {
    id: 'about',
    title: 'About You',
    description: 'Share your professional background',
    icon: Briefcase,
    fields: ['title', 'company', 'bioTitle', 'bio', 'skills']
  },
  {
    id: 'contact',
    title: 'Contact & Location',
    description: 'How can people reach you?',
    icon: MapPin,
    fields: ['phone', 'linkedin', 'website', 'twitter', 'city', 'country', 'timezone', 'showPhone']
  },
  {
    id: 'privacy',
    title: 'Privacy Settings',
    description: 'Control who can see your profile',
    icon: Shield,
    fields: ['profileVisibility']
  }
];

const SignupWizard: React.FC<SignupWizardProps> = ({
  initialData = {},
  onComplete,
  onCancel,
  isLoading = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<UserProfileForm>({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    title: '',
    company: '',
    bioTitle: '',
    bio: '',
    skills: [],
    phone: '',
    linkedin: '',
    website: '',
    twitter: '',
    city: '',
    country: '',
    timezone: '',
    showPhone: false,
    profileVisibility: 'event_only',
    ...initialData
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Load saved progress from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('alma-signup-progress');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to load saved signup progress:', error);
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem('alma-signup-progress', JSON.stringify(formData));
  }, [formData]);

  // Clear saved progress when wizard completes
  const clearSavedProgress = () => {
    localStorage.removeItem('alma-signup-progress');
  };

  // Update form data
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Mark field as touched
    setTouchedFields(prev => new Set([...prev, field]));
    
    // Validate field
    const fieldErrors = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: fieldErrors.length > 0 ? fieldErrors[0].message : ''
    }));
  };

  // Validate current step
  const validateCurrentStep = (): boolean => {
    const stepFields = STEPS[currentStep].fields;
    const stepErrors: Record<string, string> = {};
    let isValid = true;

    stepFields.forEach(field => {
      const fieldErrors = validateField(field, formData[field as keyof UserProfileForm]);
      if (fieldErrors.length > 0) {
        stepErrors[field] = fieldErrors[0].message;
        isValid = false;
      }
    });

    setErrors(prev => ({ ...prev, ...stepErrors }));
    return isValid;
  };

  // Go to next step
  const nextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        // Final step - complete signup
        clearSavedProgress();
        onComplete(formData);
      }
    }
  };

  // Go to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Jump to specific step
  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  // Check if step is accessible (all previous steps are valid)
  const isStepAccessible = (stepIndex: number): boolean => {
    if (stepIndex <= currentStep) return true;
    
    // Check if all previous steps are valid
    for (let i = 0; i < stepIndex; i++) {
      const stepFields = STEPS[i].fields;
      const hasErrors = stepFields.some(field => {
        const fieldErrors = validateField(field, formData[field as keyof UserProfileForm]);
        return fieldErrors.length > 0;
      });
      if (hasErrors) return false;
    }
    
    return true;
  };

  // Get step completion status
  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <ProfileBasicsStep
            formData={formData}
            errors={errors}
            touchedFields={touchedFields}
            onUpdate={updateFormData}
          />
        );
      case 1:
        return (
          <AboutYouStep
            formData={formData}
            errors={errors}
            touchedFields={touchedFields}
            onUpdate={updateFormData}
          />
        );
      case 2:
        return (
          <ContactLocationStep
            formData={formData}
            errors={errors}
            touchedFields={touchedFields}
            onUpdate={updateFormData}
          />
        );
      case 3:
        return (
          <PrivacyStep
            formData={formData}
            errors={errors}
            touchedFields={touchedFields}
            onUpdate={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Indicator */}
        <SignupProgress
          steps={STEPS}
          currentStep={currentStep}
          getStepStatus={getStepStatus}
          isStepAccessible={isStepAccessible}
          onStepClick={goToStep}
        />

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mt-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-2xl">
                <currentStepData.icon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{currentStepData.title}</h1>
                <p className="text-blue-100 mt-1">{currentStepData.description}</p>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="p-8">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-8 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={isLoading}
                  className="inline-flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back</span>
                </button>
              )}

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Step {currentStep + 1} of {STEPS.length}
              </div>

              <button
                type="button"
                onClick={nextStep}
                disabled={isLoading}
                className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-xl hover:shadow-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
                    </span>
                    {currentStep === STEPS.length - 1 ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <ArrowRight className="h-5 w-5" />
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6">
          <p className="text-gray-600 text-sm">
            Your progress is automatically saved. You can return to complete this later.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupWizard;