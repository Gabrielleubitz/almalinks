'use client';

import { useState, FormEvent } from 'react';
import type { HubSpotContact } from '@/types/hubspot';

interface HubSpotFormProps {
  /**
   * Unique identifier for this form instance
   */
  formId?: string;
  
  /**
   * Fields to include in the form
   */
  fields?: Array<'email' | 'firstname' | 'lastname' | 'phone' | 'company' | 'website' | 'jobtitle'>;
  
  /**
   * Callback when form submission succeeds
   */
  onSubmitSuccess?: (data: HubSpotContact) => void;
  
  /**
   * Callback when form submission fails
   */
  onSubmitError?: (error: string) => void;
  
  /**
   * Custom submit button text
   */
  submitText?: string;
  
  /**
   * Show loading state during submission
   */
  showLoading?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * HubSpot Form Component
 * 
 * A reusable form component that submits contact data to HubSpot
 * via the server-side API route.
 * 
 * Example:
 * ```tsx
 * <HubSpotForm
 *   formId="contact-form"
 *   fields={['email', 'firstname', 'lastname', 'company']}
 *   onSubmitSuccess={(data) => console.log('Success:', data)}
 * />
 * ```
 */
export default function HubSpotForm({
  formId = 'hubspot-form',
  fields = ['email', 'firstname', 'lastname'],
  onSubmitSuccess,
  onSubmitError,
  submitText = 'Submit',
  showLoading = true,
  className = '',
}: HubSpotFormProps) {
  const [formData, setFormData] = useState<Partial<HubSpotContact>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/hubspot/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage = result.error || result.errors?.[0]?.message || 'Failed to submit form';
        setError(errorMessage);
        onSubmitError?.(errorMessage);
        return;
      }

      setSuccess(true);
      setFormData({}); // Reset form
      onSubmitSuccess?.(result.data?.properties || formData as HubSpotContact);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onSubmitError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    email: 'Email',
    firstname: 'First Name',
    lastname: 'Last Name',
    phone: 'Phone',
    company: 'Company',
    website: 'Website',
    jobtitle: 'Job Title',
  };

  const fieldTypes: Record<string, string> = {
    email: 'email',
    phone: 'tel',
    website: 'url',
  };

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={className}
      noValidate
    >
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field}>
            <label
              htmlFor={`${formId}-${field}`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {fieldLabels[field] || field}
              {field === 'email' && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={`${formId}-${field}`}
              type={fieldTypes[field] || 'text'}
              value={formData[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              required={field === 'email'}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        ))}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">Thank you! Your information has been submitted successfully.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {showLoading && isSubmitting ? 'Submitting...' : submitText}
        </button>
      </div>
    </form>
  );
}

