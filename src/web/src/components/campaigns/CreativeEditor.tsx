import React, { useState, useEffect, useMemo, useCallback } from 'react'; // ^18.0.0
import { Input } from '../common/Input';
import { IAd, PlatformType } from '../../types/campaign';

/**
 * Platform-specific creative constraints
 */
const PLATFORM_CONSTRAINTS = {
  [PlatformType.LINKEDIN]: {
    headline: { maxLength: 200, minLength: 2 },
    description: { maxLength: 600, minLength: 10 },
    imageFormats: ['jpg', 'jpeg', 'png'],
    maxImageSize: 5242880, // 5MB
    imageAspectRatio: '1.91:1',
  },
  [PlatformType.GOOGLE]: {
    headline: { maxLength: 90, minLength: 2 },
    description: { maxLength: 180, minLength: 10 },
    imageFormats: ['jpg', 'jpeg', 'png', 'gif'],
    maxImageSize: 4194304, // 4MB
    imageAspectRatio: '1.91:1',
  },
};

/**
 * Props interface for CreativeEditor component
 */
interface CreativeEditorProps {
  creative: IAd;
  platform: PlatformType;
  onChange: (creative: IAd) => void;
  onValidationError: (errors: string[]) => void;
  onAiSuggestion?: (suggestion: string) => void;
  className?: string;
  testId?: string;
}

/**
 * Validates image file against platform-specific requirements
 */
export const handleImageUpload = async (
  file: File,
  platform: PlatformType
): Promise<string> => {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  
  // Validate file type
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension || !constraints.imageFormats.includes(fileExtension)) {
    throw new Error(`Invalid file format. Supported formats: ${constraints.imageFormats.join(', ')}`);
  }

  // Validate file size
  if (file.size > constraints.maxImageSize) {
    throw new Error(`File size exceeds ${constraints.maxImageSize / 1024 / 1024}MB limit`);
  }

  // Create image object for dimension validation
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const aspectRatio = img.width / img.height;
      const [targetWidth, targetHeight] = constraints.imageAspectRatio.split(':').map(Number);
      const targetAspectRatio = targetWidth / targetHeight;

      if (Math.abs(aspectRatio - targetAspectRatio) > 0.01) {
        reject(new Error(`Image must have ${constraints.imageAspectRatio} aspect ratio`));
      } else {
        resolve(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
};

/**
 * Validates creative content against platform requirements
 */
export const validateCreative = (
  creative: IAd,
  platform: PlatformType
): { isValid: boolean; errors: string[] } => {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  const errors: string[] = [];

  // Validate headline
  if (creative.headline.length < constraints.headline.minLength) {
    errors.push(`Headline must be at least ${constraints.headline.minLength} characters`);
  }
  if (creative.headline.length > constraints.headline.maxLength) {
    errors.push(`Headline must be no more than ${constraints.headline.maxLength} characters`);
  }

  // Validate description
  if (creative.description.length < constraints.description.minLength) {
    errors.push(`Description must be at least ${constraints.description.minLength} characters`);
  }
  if (creative.description.length > constraints.description.maxLength) {
    errors.push(`Description must be no more than ${constraints.description.maxLength} characters`);
  }

  // Validate URLs
  try {
    new URL(creative.destinationUrl);
  } catch {
    errors.push('Invalid destination URL');
  }

  if (!creative.imageUrl) {
    errors.push('Image is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * CreativeEditor component for managing ad creatives with AI-powered optimization
 */
export const CreativeEditor: React.FC<CreativeEditorProps> = ({
  creative,
  platform,
  onChange,
  onValidationError,
  onAiSuggestion,
  className,
  testId,
}) => {
  const [currentCreative, setCurrentCreative] = useState<IAd>(creative);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Memoize platform constraints
  const constraints = useMemo(() => PLATFORM_CONSTRAINTS[platform], [platform]);

  // Debounced validation handler
  const debouncedValidate = useCallback(
    (() => {
      let timeout: NodeJS.Timeout;
      return (creative: IAd) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const { isValid, errors } = validateCreative(creative, platform);
          setValidationErrors(errors);
          onValidationError(errors);
          setIsValidating(false);
        }, 500);
      };
    })(),
    [platform, onValidationError]
  );

  // Handle creative field changes
  const handleChange = useCallback(
    (field: keyof IAd, value: string) => {
      const updatedCreative = { ...currentCreative, [field]: value };
      setCurrentCreative(updatedCreative);
      setIsValidating(true);
      onChange(updatedCreative);
      debouncedValidate(updatedCreative);
    },
    [currentCreative, onChange, debouncedValidate]
  );

  // Handle image upload
  const handleImageChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const imageUrl = await handleImageUpload(file, platform);
        handleChange('imageUrl', imageUrl);
      } catch (error) {
        setValidationErrors([error instanceof Error ? error.message : 'Image upload failed']);
      }
    },
    [platform, handleChange]
  );

  // Validate on mount and platform change
  useEffect(() => {
    debouncedValidate(currentCreative);
  }, [currentCreative, platform, debouncedValidate]);

  return (
    <div className={`space-y-4 ${className}`} data-testid={testId}>
      <Input
        name="headline"
        value={currentCreative.headline}
        onChange={(e) => handleChange('headline', e.target.value)}
        placeholder="Enter headline"
        error={validationErrors.find((error) => error.includes('Headline'))}
        maxLength={constraints.headline.maxLength}
        required
        aria-label="Ad headline"
      />

      <Input
        name="description"
        value={currentCreative.description}
        onChange={(e) => handleChange('description', e.target.value)}
        placeholder="Enter description"
        error={validationErrors.find((error) => error.includes('Description'))}
        maxLength={constraints.description.maxLength}
        required
        aria-label="Ad description"
      />

      <Input
        name="destinationUrl"
        value={currentCreative.destinationUrl}
        onChange={(e) => handleChange('destinationUrl', e.target.value)}
        placeholder="Enter destination URL"
        error={validationErrors.find((error) => error.includes('URL'))}
        required
        aria-label="Destination URL"
      />

      <div className="relative">
        <input
          type="file"
          accept={constraints.imageFormats.map((format) => `.${format}`).join(',')}
          onChange={handleImageChange}
          className="hidden"
          id="image-upload"
          aria-label="Upload image"
        />
        <label
          htmlFor="image-upload"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition-colors"
        >
          Upload Image
        </label>
        {currentCreative.imageUrl && (
          <img
            src={currentCreative.imageUrl}
            alt="Ad preview"
            className="mt-2 max-w-full h-auto rounded"
          />
        )}
      </div>

      {isValidating && (
        <div className="text-gray-500">Validating...</div>
      )}

      {validationErrors.length > 0 && (
        <div className="text-red-500" role="alert">
          <ul className="list-disc pl-5">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreativeEditor;