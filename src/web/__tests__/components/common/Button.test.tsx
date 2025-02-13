import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';

import Button from '../../../src/components/common/Button';
import { Size, Variant } from '../../../src/types/common';

expect.extend(toHaveNoViolations);

// Helper function to render Button with common test utilities
const renderButton = (props = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(<Button {...props} />),
  };
};

describe('Button Component', () => {
  describe('Rendering and Styling', () => {
    it('renders with default props', () => {
      const { getByRole } = renderButton({ children: 'Click me' });
      const button = getByRole('button');
      
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('bg-blue-600'); // Primary variant
      expect(button).toHaveClass('px-4 py-2'); // Medium size
      expect(button).toHaveTextContent('Click me');
    });

    it('applies correct size classes', () => {
      const sizes = {
        [Size.SMALL]: 'px-3 py-1.5 text-sm',
        [Size.MEDIUM]: 'px-4 py-2 text-base',
        [Size.LARGE]: 'px-6 py-3 text-lg',
      };

      Object.entries(sizes).forEach(([size, expectedClasses]) => {
        const { getByRole } = renderButton({ size: size as Size });
        const button = getByRole('button');
        expectedClasses.split(' ').forEach(className => {
          expect(button).toHaveClass(className);
        });
      });
    });

    it('applies correct variant classes', () => {
      const variants = {
        [Variant.PRIMARY]: 'bg-blue-600 text-white',
        [Variant.SECONDARY]: 'bg-gray-100 text-gray-700',
        [Variant.TERTIARY]: 'bg-transparent text-blue-600',
      };

      Object.entries(variants).forEach(([variant, expectedClasses]) => {
        const { getByRole } = renderButton({ variant: variant as Variant });
        const button = getByRole('button');
        expectedClasses.split(' ').forEach(className => {
          expect(button).toHaveClass(className);
        });
      });
    });

    it('applies custom className', () => {
      const { getByRole } = renderButton({ className: 'custom-class' });
      expect(getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('Interaction Handling', () => {
    it('calls onClick handler when clicked', async () => {
      const onClick = jest.fn();
      const { getByRole, user } = renderButton({ onClick });
      
      await user.click(getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', async () => {
      const onClick = jest.fn();
      const { getByRole, user } = renderButton({ onClick, disabled: true });
      
      await user.click(getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('prevents click when loading', async () => {
      const onClick = jest.fn();
      const { getByRole, user } = renderButton({ onClick, isLoading: true });
      
      await user.click(getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('handles async onClick correctly', async () => {
      const asyncOnClick = jest.fn().mockImplementation(() => Promise.resolve());
      const { getByRole, user } = renderButton({ onClick: asyncOnClick });
      
      await user.click(getByRole('button'));
      expect(asyncOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Management', () => {
    it('renders loading state correctly', () => {
      const { getByRole } = renderButton({ isLoading: true, children: 'Submit' });
      const button = getByRole('button');
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toContainElement(screen.getByRole('img', { hidden: true }));
      expect(button).toHaveClass('cursor-wait');
    });

    it('renders disabled state correctly', () => {
      const { getByRole } = renderButton({ disabled: true });
      const button = getByRole('button');
      
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('maintains content visibility during loading', () => {
      const { getByText } = renderButton({ isLoading: true, children: 'Submit' });
      const content = getByText('Submit');
      
      expect(content).toHaveClass('opacity-75');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderButton({ children: 'Accessible Button' });
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('supports custom aria-label', () => {
      const { getByRole } = renderButton({ ariaLabel: 'Custom Label' });
      expect(getByRole('button')).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('handles keyboard navigation', async () => {
      const onClick = jest.fn();
      const { getByRole, user } = renderButton({ onClick });
      const button = getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      
      await user.keyboard('{enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Responsive Behavior', () => {
    it('applies responsive width classes', () => {
      const { getByRole } = renderButton();
      const button = getByRole('button');
      
      expect(button).toHaveClass('w-full', 'sm:w-auto');
    });

    it('maintains touch target size on mobile', () => {
      const { getByRole } = renderButton({ size: Size.SMALL });
      const button = getByRole('button');
      
      const styles = window.getComputedStyle(button);
      const height = parseFloat(styles.height);
      
      // Ensure minimum touch target size of 44px (iOS) or 48px (Material Design)
      expect(height).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Error Handling', () => {
    it('handles onClick errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorOnClick = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const { getByRole, user } = renderButton({ onClick: errorOnClick });
      await user.click(getByRole('button'));
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
      
      consoleSpy.mockRestore();
    });
  });
});