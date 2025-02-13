import React, { useEffect, useCallback } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import FocusTrap from 'focus-trap-react'; // ^10.0.0
import { Size, BaseComponentProps } from '../../types/common';
import { Button } from './Button';
import { UI_CONSTANTS } from '../../lib/constants';

/**
 * Props interface for the Modal component
 * @extends BaseComponentProps
 */
interface ModalProps extends BaseComponentProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Handler for modal close events */
  onClose: () => void;
  /** Modal size variant */
  size?: Size;
  /** Modal title for accessibility */
  title?: string;
}

/**
 * Generates responsive Tailwind CSS classes for modal based on size
 * @param size - Modal size variant
 * @param className - Additional custom classes
 * @returns Combined CSS classes string
 */
const getModalClasses = ({ size = Size.MEDIUM, className = '' }): string => {
  const baseClasses = [
    'fixed',
    'inset-0',
    'z-50',
    'overflow-y-auto',
    'p-4',
    'sm:p-6',
    'md:p-8'
  ];

  const modalClasses = [
    'relative',
    'bg-white',
    'rounded-lg',
    'shadow-xl',
    'mx-auto',
    'max-h-[90vh]',
    'overflow-y-auto',
    'transform',
    'transition-all',
    'duration-300',
    'ease-out'
  ];

  // Size-specific width classes
  const sizeClasses = {
    [Size.SMALL]: 'max-w-sm',
    [Size.MEDIUM]: 'max-w-lg',
    [Size.LARGE]: 'max-w-2xl'
  };

  // Animation classes
  const animationClasses = [
    'animate-in',
    'fade-in',
    'zoom-in-95',
    'duration-300'
  ];

  return clsx(
    baseClasses,
    modalClasses,
    sizeClasses[size],
    animationClasses,
    className
  );
};

/**
 * Modal component providing an accessible overlay dialog interface
 * @param props - Modal component props
 * @returns React component
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = Size.MEDIUM,
  title,
  children,
  className
}) => {
  /**
   * Handles escape key press for modal dismissal
   */
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      onClose();
    }
  }, [isOpen, onClose]);

  /**
   * Handles clicks on modal overlay for dismissal
   */
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Add/remove event listeners for keyboard navigation
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscapeKey]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />

      {/* Modal Content */}
      <FocusTrap>
        <div
          className={getModalClasses({ size, className })}
          style={{
            transitionDuration: `${UI_CONSTANTS.ANIMATION_DURATION.MEDIUM}ms`
          }}
        >
          {/* Header */}
          {title && (
            <div className="px-6 py-4 border-b border-gray-200">
              <h2
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">{children}</div>

          {/* Close button */}
          <button
            type="button"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </FocusTrap>
    </div>
  );
};

export default Modal;