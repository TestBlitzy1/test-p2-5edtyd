'use client';

import React from 'react';
import { Inter } from '@next/font/google';
import { Providers } from 'next-auth/providers';
import { ErrorBoundary } from 'react-error-boundary';
import Header from '../components/layout/Header';
import '../styles/globals.css';

// Configure Inter font with optimized loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: true,
  variable: '--font-inter'
});

// Metadata configuration for SEO and security
export const metadata = {
  title: 'Sales Intelligence Platform',
  description: 'AI-powered digital advertising campaign creation and management platform',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  charset: 'utf-8',
  themeColor: '#ffffff',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  robots: 'index, follow',
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  cacheControl: 'public, max-age=3600, must-revalidate'
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
    <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
      <h2 className="mb-4 text-2xl font-bold text-red-600">Something went wrong</h2>
      <p className="mb-4 text-gray-600">
        {error.message || 'An unexpected error occurred. Please try again later.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Reload Page
      </button>
    </div>
  </div>
);

// Root layout component
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Providers>
            {/* Main layout structure */}
            <div className="flex min-h-screen flex-col">
              {/* Header with responsive navigation */}
              <Header />

              {/* Main content area with responsive padding */}
              <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                  {/* Content wrapper with animation */}
                  <div className="animate-fade-in-up">
                    {children}
                  </div>
                </div>
              </main>

              {/* Skip to main content link for accessibility */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-blue-600"
              >
                Skip to main content
              </a>
            </div>
          </Providers>
        </ErrorBoundary>

        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                if (window.performance && window.performance.timing) {
                  setTimeout(function() {
                    const timing = window.performance.timing;
                    const loadTime = timing.loadEventEnd - timing.navigationStart;
                    console.log('Page load time:', loadTime);
                  }, 0);
                }
              });
            `
          }}
        />
      </body>
    </html>
  );
}