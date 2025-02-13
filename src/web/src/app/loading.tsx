import { FC, memo } from 'react'; // ^18.0.0
import Loading from '../components/common/Loading';
import { LoadingState } from '../lib/types';

/**
 * Global loading component for Next.js app router that provides visual feedback
 * during page transitions and data loading states. Implements accessibility
 * features and performance optimizations.
 * 
 * @returns {JSX.Element} Memoized loading page component
 */
const LoadingPage: FC = memo(() => {
  return (
    <div
      className="min-h-screen w-full"
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <Loading
        fullScreen
        size="lg"
        text="Loading your campaign data..."
        state={LoadingState.LOADING}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity duration-200"
      />
    </div>
  );
});

// Display name for debugging and dev tools
LoadingPage.displayName = 'LoadingPage';

export default LoadingPage;