import { FC } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { LoadingState } from '../../lib/types';

// Define spinner size mapping for consistent sizing
const SPINNER_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12'
} as const;

// Default size if none specified
const DEFAULT_SIZE = 'md';

interface LoadingProps {
  /** Controls the size of the spinner (sm | md | lg) */
  size?: keyof typeof SPINNER_SIZES;
  /** Additional CSS classes to apply */
  className?: string;
  /** Whether to display as a full-screen overlay */
  fullScreen?: boolean;
  /** Optional loading message to display */
  text?: string;
  /** Loading state from global state management */
  state?: LoadingState;
}

/**
 * A reusable loading spinner component with customizable size and appearance.
 * Provides visual feedback during asynchronous operations with accessibility support.
 * 
 * @example
 * <Loading size="md" text="Creating campaign..." />
 */
const Loading: FC<LoadingProps> = ({
  size = DEFAULT_SIZE,
  className,
  fullScreen = false,
  text,
  state = LoadingState.LOADING
}) => {
  // Only render if in loading state
  if (state !== LoadingState.LOADING) {
    return null;
  }

  // Combine default styles with custom classes
  const containerClasses = classNames(
    'flex flex-col items-center justify-center',
    {
      'fixed inset-0 bg-gray-900/50 z-50': fullScreen,
      'p-4': !fullScreen
    },
    className
  );

  // Get spinner size class
  const spinnerSizeClass = SPINNER_SIZES[size];

  return (
    <div 
      className={containerClasses}
      role="status"
      aria-live="polite"
      data-testid="loading-spinner"
    >
      {/* Optimized SVG spinner with CSS animation */}
      <div className={classNames(
        spinnerSizeClass,
        'animate-spin rounded-full border-4',
        'border-primary-200 border-t-primary-600',
        'motion-reduce:animate-[spin_1.5s_linear_infinite]'
      )}>
        <span className="sr-only">Loading</span>
      </div>

      {/* Optional loading text */}
      {text && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {text}
        </p>
      )}
    </div>
  );
};

export default Loading;