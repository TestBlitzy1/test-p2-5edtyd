import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { Size, BaseComponentProps } from '../../types/common';

/**
 * Default size for input fields when not specified
 */
const DEFAULT_INPUT_SIZE = Size.MEDIUM;

/**
 * Props interface for Input component extending base component props
 */
interface InputProps extends BaseComponentProps {
  /** Input name attribute */
  name: string;
  /** Input type attribute */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  /** Input value */
  value: string;
  /** Change event handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Blur event handler */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Input size variant */
  size?: Size;
  /** Required field indicator */
  required?: boolean;
  /** Autocomplete attribute */
  autoComplete?: string;
  /** Minimum value for number inputs */
  min?: number;
  /** Maximum value for number inputs */
  max?: number;
  /** Input pattern for validation */
  pattern?: string;
  /** Accessibility label */
  'aria-label'?: string;
  /** ID of element describing the input */
  'aria-describedby'?: string;
}

/**
 * Returns Tailwind CSS classes based on input size variant
 * @param size - Size enum value
 * @returns Tailwind CSS classes string
 */
const getInputSizeClasses = (size: Size): string => {
  switch (size) {
    case Size.SMALL:
      return 'px-2 py-1 text-sm h-8';
    case Size.LARGE:
      return 'px-4 py-3 text-lg h-12';
    case Size.MEDIUM:
    default:
      return 'px-3 py-2 text-base h-10';
  }
};

/**
 * Default CSS classes for input styling
 */
const defaultClasses = 'w-full rounded-md border border-gray-300 shadow-sm ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ' +
  'disabled:bg-gray-100 disabled:cursor-not-allowed ' +
  'transition duration-150 ease-in-out';

/**
 * Input component for standardized form fields with validation and accessibility
 */
export const Input: React.FC<InputProps> = ({
  id,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled = false,
  size = DEFAULT_INPUT_SIZE,
  required = false,
  autoComplete,
  min,
  max,
  pattern,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  className,
  testId,
}) => {
  // Generate unique IDs for accessibility
  const inputId = id || `input-${name}`;
  const errorId = `${inputId}-error`;
  
  // Combine all classes including size-specific and error state
  const inputClasses = classNames(
    defaultClasses,
    getInputSizeClasses(size),
    {
      'border-red-500 focus:border-red-500 focus:ring-red-500': error,
    },
    className
  );

  return (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        pattern={pattern}
        aria-label={ariaLabel}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={classNames(
          error ? errorId : null,
          ariaDescribedBy
        )}
        data-testid={testId || `input-${name}`}
        className={inputClasses}
      />
      
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 text-sm text-red-500"
        >
          {error}
        </div>
      )}
    </div>
  );
};

Input.defaultProps = {
  type: 'text',
  disabled: false,
  size: DEFAULT_INPUT_SIZE,
  required: false,
};

export default Input;