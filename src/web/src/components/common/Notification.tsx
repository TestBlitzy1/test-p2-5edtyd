import React, { useEffect, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { AnimatePresence, motion } from 'framer-motion'; // ^10.0.0
import { BaseComponentProps } from '../../types/common';
import { UI_CONSTANTS } from '../../lib/constants';

/**
 * Enum defining available notification types with corresponding visual styles
 */
export enum NotificationType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

/**
 * Props interface for the Notification component
 */
export interface NotificationProps extends BaseComponentProps {
  /** Type of notification determining visual style and icon */
  type: NotificationType;
  /** Main notification message content */
  message: string;
  /** Optional notification title for additional context */
  title?: string;
  /** Auto-dismiss duration in milliseconds, undefined for persistent notification */
  duration?: number;
  /** Callback function triggered when notification is dismissed */
  onClose?: () => void;
}

/**
 * Returns appropriate Tailwind CSS classes based on notification type
 * @param type - The notification type
 * @returns Tailwind CSS classes for notification styling
 */
const getNotificationStyles = (type: NotificationType): string => {
  const baseClasses = 'rounded-lg p-4 shadow-lg border flex items-start gap-3';
  
  const typeStyles = {
    [NotificationType.SUCCESS]: 'bg-green-50 border-green-200 text-green-800',
    [NotificationType.ERROR]: 'bg-red-50 border-red-200 text-red-800',
    [NotificationType.WARNING]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    [NotificationType.INFO]: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return classNames(baseClasses, typeStyles[type]);
};

/**
 * Returns the appropriate icon based on notification type
 * @param type - The notification type
 * @returns SVG icon element
 */
const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  const iconClasses = classNames('w-5 h-5 flex-shrink-0', {
    'text-green-500': type === NotificationType.SUCCESS,
    'text-red-500': type === NotificationType.ERROR,
    'text-yellow-500': type === NotificationType.WARNING,
    'text-blue-500': type === NotificationType.INFO
  });

  const icons = {
    [NotificationType.SUCCESS]: (
      <svg className={iconClasses} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    [NotificationType.ERROR]: (
      <svg className={iconClasses} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    [NotificationType.WARNING]: (
      <svg className={iconClasses} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    [NotificationType.INFO]: (
      <svg className={iconClasses} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    )
  };

  return icons[type];
};

/**
 * A reusable notification component for displaying alerts, messages, and feedback
 * Supports different types, auto-dismiss, and animations
 */
export const Notification: React.FC<NotificationProps> = React.memo(({
  type,
  message,
  title,
  duration,
  onClose,
  className,
  children
}) => {
  // Handle auto-dismiss
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  // Handle keyboard dismiss
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: UI_CONSTANTS.ANIMATION_DURATION.FAST / 1000 }}
        className={classNames(
          'fixed top-4 right-4 z-50 max-w-md w-full',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className={getNotificationStyles(type)}>
          <NotificationIcon type={type} />
          
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="text-sm font-medium mb-1">
                {title}
              </h4>
            )}
            <p className="text-sm">
              {message}
            </p>
            {children}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded"
              aria-label="Close notification"
            >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

Notification.displayName = 'Notification';