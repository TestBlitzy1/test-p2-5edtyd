import { forwardRef } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { ComponentWithChildren } from '../../lib/types';

/**
 * Interface defining the structure of select options
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Props interface for the Select component
 */
interface SelectProps extends ComponentWithChildren {
  /** Array of options to display in the select */
  options: SelectOption[];
  /** Currently selected value */
  value: string;
  /** Callback fired when selection changes */
  onChange: (value: string) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether the select is in an error state */
  error?: boolean;
  /** Optional ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * Default CSS classes for consistent styling
 */
const DEFAULT_SELECT_CLASSES = 
  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-gray-300 aria-invalid:border-red-500 aria-invalid:ring-red-500';

/**
 * A reusable form select component that provides a styled wrapper around the native select element.
 * Supports custom styling, error states, and form integration.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  className,
  'aria-label': ariaLabel,
}, ref) => {
  // Combine default and custom classes
  const selectClasses = classNames(
    DEFAULT_SELECT_CLASSES,
    {
      'border-red-500': error,
      'bg-gray-100': disabled,
    },
    className
  );

  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={selectClasses}
      aria-invalid={error}
      aria-disabled={disabled}
      aria-label={ariaLabel}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
});

// Set display name for debugging purposes
Select.displayName = 'Select';