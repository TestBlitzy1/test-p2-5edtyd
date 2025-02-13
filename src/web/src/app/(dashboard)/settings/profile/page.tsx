'use client';

import React, { useState, useEffect } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import Input from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { validateLoginCredentials } from '@/lib/validation';
import { UserRole } from '@/types/auth';

// Form field validation messages
const VALIDATION_MESSAGES = {
  name: 'Name must be at least 2 characters long',
  email: 'Please enter a valid email address',
  company: 'Company name is required',
  role: 'Please select a valid role',
  phone: 'Please enter a valid phone number',
  preferences: 'Invalid preferences format'
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  timeWindow: 300000 // 5 minutes
};

// Initial form state
interface ProfileFormState {
  name: string;
  email: string;
  company: string;
  role: string;
  phone?: string;
  preferences: {
    notifications: boolean;
    twoFactorAuth: boolean;
    marketingEmails: boolean;
  };
}

const ProfilePage: React.FC = () => {
  const { user, loading, updateProfile } = useAuth();
  const { showBoundary } = useErrorBoundary();
  
  // Form state management
  const [formState, setFormState] = useState<ProfileFormState>({
    name: '',
    email: '',
    company: '',
    role: '',
    phone: '',
    preferences: {
      notifications: true,
      twoFactorAuth: false,
      marketingEmails: true
    }
  });

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateAttempts, setUpdateAttempts] = useState(0);
  const [lastUpdateAttempt, setLastUpdateAttempt] = useState(0);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormState({
        name: user.name || '',
        email: user.email || '',
        company: user.company || '',
        role: user.role || '',
        phone: user.phone || '',
        preferences: user.preferences || {
          notifications: true,
          twoFactorAuth: false,
          marketingEmails: true
        }
      });
    }
  }, [user]);

  // Handle input changes with validation
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox preferences
    if (type === 'checkbox' && name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1];
      setFormState(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefKey]: checked
        }
      }));
      return;
    }

    // Handle regular inputs
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear previous error
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));

    // Validate email field in real-time
    if (name === 'email') {
      const { errors: validationErrors } = await validateLoginCredentials({
        email: value,
        password: '' // Not needed for email validation
      });
      
      if (validationErrors.length > 0) {
        setErrors(prev => ({
          ...prev,
          email: validationErrors[0].message
        }));
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limiting
    const now = Date.now();
    if (
      updateAttempts >= RATE_LIMIT_CONFIG.maxAttempts &&
      now - lastUpdateAttempt < RATE_LIMIT_CONFIG.timeWindow
    ) {
      setErrors(prev => ({
        ...prev,
        form: 'Too many update attempts. Please try again later.'
      }));
      return;
    }

    // Validate all fields
    const newErrors: Record<string, string> = {};
    if (formState.name.length < 2) newErrors.name = VALIDATION_MESSAGES.name;
    if (!formState.email) newErrors.email = VALIDATION_MESSAGES.email;
    if (!formState.company) newErrors.company = VALIDATION_MESSAGES.company;
    if (!formState.role) newErrors.role = VALIDATION_MESSAGES.role;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await updateProfile(formState);
      
      // Update rate limiting state
      setUpdateAttempts(prev => prev + 1);
      setLastUpdateAttempt(now);

    } catch (error) {
      showBoundary(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen" role="status">
        <span className="sr-only">Loading...</span>
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Input
          id="name"
          name="name"
          type="text"
          value={formState.name}
          onChange={handleInputChange}
          error={errors.name}
          placeholder="Full Name"
          aria-label="Full Name"
          required
        />

        <Input
          id="email"
          name="email"
          type="email"
          value={formState.email}
          onChange={handleInputChange}
          error={errors.email}
          placeholder="Email Address"
          aria-label="Email Address"
          required
        />

        <Input
          id="company"
          name="company"
          type="text"
          value={formState.company}
          onChange={handleInputChange}
          error={errors.company}
          placeholder="Company Name"
          aria-label="Company Name"
          required
        />

        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formState.phone || ''}
          onChange={handleInputChange}
          error={errors.phone}
          placeholder="Phone Number (Optional)"
          aria-label="Phone Number"
        />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Preferences</h2>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="preferences.notifications"
              checked={formState.preferences.notifications}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span>Receive notifications</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="preferences.twoFactorAuth"
              checked={formState.preferences.twoFactorAuth}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span>Enable two-factor authentication</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="preferences.marketingEmails"
              checked={formState.preferences.marketingEmails}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span>Receive marketing emails</span>
          </label>
        </div>

        {errors.form && (
          <div role="alert" className="text-red-500 text-sm">
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || Object.keys(errors).length > 0}
          className={`w-full py-2 px-4 rounded-md text-white font-medium
            ${isSubmitting || Object.keys(errors).length > 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;