import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { Size, Variant, BaseComponentProps } from '../../types/common';

/**
 * Props interface for the Button component
 * @extends BaseComponentProps
 */
interface ButtonProps extends BaseComponentProps {
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Button size variant */
  size?: Size;
  /** Button style variant */
  variant?: Variant;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * Generates responsive Tailwind CSS classes for button styling
 * @param props - Button component props
 * @returns Combined CSS classes string
 */
const getButtonClasses = (props: ButtonProps): string => {
  const {
    size = Size.MEDIUM,
    variant = Variant.PRIMARY,
    disabled,
    isLoading,
    className
  } = props;

  // Base button classes
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'rounded-md',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2'
  ];

  // Size-specific classes
  const sizeClasses = {
    [Size.SMALL]: 'px-3 py-1.5 text-sm',
    [Size.MEDIUM]: 'px-4 py-2 text-base',
    [Size.LARGE]: 'px-6 py-3 text-lg'
  };

  // Variant-specific classes
  const variantClasses = {
    [Variant.PRIMARY]: [
      'bg-blue-600',
      'text-white',
      'hover:bg-blue-700',
      'focus:ring-blue-500',
      'active:bg-blue-800'
    ],
    [Variant.SECONDARY]: [
      'bg-gray-100',
      'text-gray-700',
      'hover:bg-gray-200',
      'focus:ring-gray-500',
      'active:bg-gray-300',
      'border',
      'border-gray-300'
    ],
    [Variant.TERTIARY]: [
      'bg-transparent',
      'text-blue-600',
      'hover:bg-blue-50',
      'focus:ring-blue-500',
      'active:bg-blue-100'
    ]
  };

  // State-specific classes
  const stateClasses = [
    disabled && 'opacity-50 cursor-not-allowed',
    isLoading && 'cursor-wait opacity-75'
  ];

  // Responsive classes
  const responsiveClasses = [
    'w-full sm:w-auto', // Full width on mobile, auto on larger screens
    'text-center'
  ];

  return clsx(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    stateClasses,
    responsiveClasses,
    className
  );
};

/**
 * Button component for consistent, accessible button styling across the application
 * @param props - Button component props
 * @returns React component
 */
export const Button: React.FC<ButtonProps> = ({
  type = 'button',
  size = Size.MEDIUM,
  variant = Variant.PRIMARY,
  disabled = false,
  isLoading = false,
  onClick,
  className,
  children,
  ariaLabel
}) => {
  /**
   * Handles button click events with loading and disabled state checks
   * @param event - Mouse event object
   */
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (disabled || isLoading || !onClick) {
      return;
    }

    try {
      await onClick(event);
    } catch (error) {
      console.error('Button click handler error:', error);
    }
  };

  return (
    <button
      type={type}
      className={getButtonClasses({
        size,
        variant,
        disabled,
        isLoading,
        className
      })}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {/* Loading spinner */}
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {/* Button content */}
      <span className={clsx(isLoading && 'opacity-75')}>{children}</span>
    </button>
  );
};

export default Button;