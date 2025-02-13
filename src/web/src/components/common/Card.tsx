import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { BaseComponentProps, Size, Variant } from '../../types/common';

/**
 * Props interface for the Card component extending BaseComponentProps
 * @interface CardProps
 */
export interface CardProps extends BaseComponentProps {
  /** Card title displayed in the header */
  title?: string;
  /** Size variant controlling card dimensions */
  size?: Size;
  /** Visual style variant */
  variant?: Variant;
  /** Enable hover effects */
  hoverable?: boolean;
  /** Display loading skeleton state */
  loading?: boolean;
  /** Optional actions displayed in card header */
  headerActions?: React.ReactNode;
  /** Accessibility label for the card */
  ariaLabel?: string;
  /** Test ID for component testing */
  testId?: string;
}

/**
 * A reusable card component that provides a consistent container layout with support
 * for loading states, header actions, hover effects, and responsive sizing.
 *
 * @component
 * @example
 * ```tsx
 * <Card
 *   title="Campaign Performance"
 *   size={Size.MEDIUM}
 *   variant={Variant.PRIMARY}
 *   hoverable
 * >
 *   <p>Card content</p>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = ({
  title,
  size = Size.MEDIUM,
  variant = Variant.PRIMARY,
  hoverable = false,
  loading = false,
  headerActions,
  children,
  className,
  ariaLabel,
  testId = 'card',
}) => {
  // Base card classes
  const cardClasses = clsx(
    'card',
    // Size variants
    {
      'card--small': size === Size.SMALL,
      'card--medium': size === Size.MEDIUM,
      'card--large': size === Size.LARGE,
    },
    // Style variants
    {
      'card--primary': variant === Variant.PRIMARY,
      'card--secondary': variant === Variant.SECONDARY,
      'card--tertiary': variant === Variant.TERTIARY,
    },
    // Interactive states
    {
      'card--hoverable': hoverable,
      'card--loading': loading,
    },
    className
  );

  // Header classes
  const headerClasses = clsx('card__header', {
    'card__header--with-actions': !!headerActions,
  });

  /**
   * Renders the loading skeleton state
   */
  const renderSkeleton = () => (
    <div className="card__skeleton" role="progressbar" aria-busy="true">
      {title && <div className="card__skeleton-header" />}
      <div className="card__skeleton-content" />
    </div>
  );

  /**
   * Renders the card header if title or actions exist
   */
  const renderHeader = () => {
    if (!title && !headerActions) return null;

    return (
      <header className={headerClasses}>
        {title && (
          <h2 className="card__title" id={`${testId}-title`}>
            {title}
          </h2>
        )}
        {headerActions && (
          <div className="card__actions" aria-label="Card actions">
            {headerActions}
          </div>
        )}
      </header>
    );
  };

  return (
    <article
      className={cardClasses}
      aria-label={ariaLabel || title}
      aria-labelledby={title ? `${testId}-title` : undefined}
      data-testid={testId}
    >
      {loading ? (
        renderSkeleton()
      ) : (
        <>
          {renderHeader()}
          <div className="card__content">{children}</div>
        </>
      )}
    </article>
  );
};

export default Card;