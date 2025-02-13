import React from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { UI_CONSTANTS } from '../../lib/constants';
import { Button } from '../common/Button';
import { Size, Variant } from '../../types/common';
import {
  GlobeAltIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  HeartIcon,
} from '@heroicons/react/24/outline'; // ^2.0.0

interface FooterProps {
  className?: string;
}

/**
 * Generates responsive Tailwind CSS classes for footer styling
 * @param className - Additional CSS classes to apply
 * @returns Combined CSS classes for footer styling
 */
const getFooterClasses = (className?: string): string => {
  return clsx(
    // Base classes
    'w-full',
    'bg-gray-50',
    'border-t',
    'border-gray-200',
    
    // Spacing and layout
    'py-8',
    'px-4',
    'sm:px-6',
    'lg:px-8',
    
    // Grid layout for responsive design
    'grid',
    'grid-cols-1',
    'gap-8',
    'md:grid-cols-2',
    'lg:grid-cols-4',
    
    // Custom classes
    className
  );
};

/**
 * Footer component providing consistent layout and styling across the application
 * Implements responsive design and accessibility features
 */
export const Footer: React.FC<FooterProps> = ({ className }) => {
  /**
   * Renders the footer navigation links section
   */
  const renderNavigationLinks = (): JSX.Element => {
    const links = [
      { label: 'About Us', href: '/about', icon: GlobeAltIcon },
      { label: 'Contact', href: '/contact', icon: ChatBubbleLeftIcon },
      { label: 'Documentation', href: '/docs', icon: DocumentTextIcon },
      { label: 'Support', href: '/support', icon: HeartIcon },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Navigation
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {links.map(({ label, href, icon: Icon }) => (
            <Button
              key={label}
              variant={Variant.TERTIARY}
              size={Size.SMALL}
              onClick={() => window.location.href = href}
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
              ariaLabel={`Navigate to ${label}`}
            >
              <Icon className="h-5 w-5 mr-2" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Renders the social media links section
   */
  const renderSocialLinks = (): JSX.Element => {
    const socialLinks = [
      { platform: 'LinkedIn', href: 'https://linkedin.com', ariaLabel: 'Visit our LinkedIn page' },
      { platform: 'Twitter', href: 'https://twitter.com', ariaLabel: 'Follow us on Twitter' },
      { platform: 'Facebook', href: 'https://facebook.com', ariaLabel: 'Connect on Facebook' },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Connect With Us
        </h3>
        <div className="flex space-x-4">
          {socialLinks.map(({ platform, href, ariaLabel }) => (
            <Button
              key={platform}
              variant={Variant.SECONDARY}
              size={Size.SMALL}
              onClick={() => window.open(href, '_blank')}
              className="inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100"
              ariaLabel={ariaLabel}
            >
              <span className="sr-only">{platform}</span>
              <img
                src={`/icons/${platform.toLowerCase()}.svg`}
                alt={`${platform} icon`}
                className="h-5 w-5"
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Renders the copyright information section
   */
  const renderCopyright = (): JSX.Element => {
    const currentYear = new Date().getFullYear();
    
    return (
      <div className="text-sm text-gray-500">
        <p className="mb-2">
          © {currentYear} {UI_CONSTANTS.COMPANY_NAME}. All rights reserved.
        </p>
        <div className="flex space-x-4">
          <a
            href="/privacy"
            className="hover:text-gray-900 transition-colors duration-200"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            className="hover:text-gray-900 transition-colors duration-200"
          >
            Terms of Service
          </a>
        </div>
      </div>
    );
  };

  return (
    <footer className={getFooterClasses(className)} role="contentinfo">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Navigation Links */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            {renderNavigationLinks()}
          </div>

          {/* Social Links */}
          <div className="col-span-1">
            {renderSocialLinks()}
          </div>

          {/* Contact Information */}
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Contact Us
            </h3>
            <address className="text-sm text-gray-500 not-italic">
              <p>Email: support@example.com</p>
              <p>Phone: +1 (555) 123-4567</p>
            </address>
          </div>

          {/* Copyright */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            {renderCopyright()}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;