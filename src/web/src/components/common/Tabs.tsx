import React, { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { ComponentWithChildren } from '../../lib/types';

// Tab item interface defining the structure of individual tabs
export interface TabItem {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// Props interface for the Tabs component
interface TabsProps extends ComponentWithChildren {
  items: TabItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  animated?: boolean;
}

// Default styling classes for consistent tab appearance
const DEFAULT_TAB_CLASSES = 'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
const ACTIVE_TAB_CLASSES = 'bg-primary-100 text-primary-700 shadow-sm';
const INACTIVE_TAB_CLASSES = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
const DISABLED_TAB_CLASSES = 'opacity-50 cursor-not-allowed';
const RESPONSIVE_TAB_CLASSES = 'md:px-6 md:py-3 lg:px-8 lg:text-base';
const ANIMATION_CLASSES = 'transition-all duration-300 ease-in-out';

/**
 * Generates responsive Tailwind CSS classes for tab items
 */
const getTabClasses = (isActive: boolean, className?: string, isDisabled?: boolean): string => {
  return clsx(
    DEFAULT_TAB_CLASSES,
    RESPONSIVE_TAB_CLASSES,
    isActive ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES,
    isDisabled && DISABLED_TAB_CLASSES,
    className
  );
};

/**
 * Tabs component for navigation and content organization
 * Supports responsive design, keyboard navigation, and accessibility features
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  activeIndex,
  onChange,
  children,
  className,
  orientation = 'horizontal',
  animated = true
}) => {
  const [focusIndex, setFocusIndex] = useState(activeIndex);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const isHorizontal = orientation === 'horizontal';
    const key = event.key;
    let newIndex = focusIndex;

    switch (key) {
      case isHorizontal ? 'ArrowRight' : 'ArrowDown':
        newIndex = (focusIndex + 1) % items.length;
        break;
      case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
        newIndex = (focusIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setFocusIndex(newIndex);
    tabRefs.current[newIndex]?.focus();
  }, [focusIndex, items.length, orientation]);

  // Handle tab click events
  const handleTabClick = useCallback((index: number, isDisabled?: boolean) => {
    if (isDisabled) return;
    onChange(index);
    setFocusIndex(index);
  }, [onChange]);

  // Render tab list with proper ARIA attributes
  const renderTabs = useCallback(() => {
    return items.map((item, index) => (
      <button
        key={`tab-${index}`}
        ref={el => tabRefs.current[index] = el}
        role="tab"
        aria-selected={activeIndex === index}
        aria-disabled={item.disabled}
        aria-controls={`tabpanel-${index}`}
        id={`tab-${index}`}
        tabIndex={focusIndex === index ? 0 : -1}
        className={getTabClasses(activeIndex === index, className, item.disabled)}
        onClick={() => handleTabClick(index, item.disabled)}
      >
        {item.icon && (
          <span className="mr-2 inline-flex items-center">{item.icon}</span>
        )}
        {item.label}
      </button>
    ));
  }, [items, activeIndex, focusIndex, className, handleTabClick]);

  return (
    <div className={clsx('w-full', className)}>
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-orientation={orientation}
        className={clsx(
          'flex gap-2 border-b border-gray-200',
          orientation === 'vertical' ? 'flex-col' : 'flex-row',
          animated && ANIMATION_CLASSES
        )}
        onKeyDown={handleKeyDown}
      >
        {renderTabs()}
      </div>

      {/* Tab panels */}
      <div className={clsx('mt-4', animated && ANIMATION_CLASSES)}>
        {React.Children.map(children, (child, index) => (
          <div
            role="tabpanel"
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            hidden={activeIndex !== index}
            tabIndex={0}
            className={clsx(
              'focus:outline-none',
              animated && 'transition-opacity duration-200',
              activeIndex === index ? 'opacity-100' : 'opacity-0'
            )}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;