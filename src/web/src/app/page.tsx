'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoginForm } from '../components/auth/LoginForm';
import { Size, Variant } from '../types/common';
import { useAuth } from '../hooks/useAuth';

/**
 * Generates metadata for the landing page with SEO optimization
 */
export const generateMetadata = () => {
  return {
    title: 'AI-Powered Campaign Creation | Sales Intelligence Platform',
    description: 'Revolutionize your digital advertising with AI-powered campaign creation. Save 80% setup time and improve ROI by 40% across LinkedIn and Google Ads.',
    openGraph: {
      title: 'AI-Powered Campaign Creation Platform',
      description: 'Transform your digital advertising with AI automation',
      images: ['/images/platform-preview.jpg'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI-Powered Campaign Creation',
      description: 'Automate and optimize your ad campaigns',
      images: ['/images/platform-preview.jpg'],
    },
  };
};

/**
 * Landing page component showcasing the platform's key features and benefits
 */
const LandingPage = () => {
  const { user, loading } = useAuth();

  // Platform statistics
  const platformStats = [
    { label: 'Setup Time Reduction', value: '80%' },
    { label: 'Performance Increase', value: '40%' },
    { label: 'ROI Improvement', value: '30%' },
    { label: 'Active Users', value: '10,000+' },
  ];

  // Key features
  const features = [
    {
      title: 'AI Campaign Generation',
      description: 'Create optimized campaign structures in minutes with AI-powered automation',
      icon: '/icons/ai-generation.svg',
    },
    {
      title: 'Multi-Platform Support',
      description: 'Seamlessly manage campaigns across LinkedIn Ads and Google Ads',
      icon: '/icons/multi-platform.svg',
    },
    {
      title: 'Smart Optimization',
      description: 'Real-time performance tracking and AI-driven optimization suggestions',
      icon: '/icons/optimization.svg',
    },
    {
      title: 'Advanced Analytics',
      description: 'Comprehensive performance metrics and actionable insights',
      icon: '/icons/analytics.svg',
    },
  ];

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Transform Your Ad Campaigns with AI
              </h1>
              <p className="text-xl md:text-2xl text-blue-100">
                Create high-performing campaigns in minutes, not hours. Powered by advanced AI for optimal results.
              </p>
              {!user && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant={Variant.SECONDARY}
                    size={Size.LARGE}
                    className="whitespace-nowrap"
                    ariaLabel="Get started with the platform"
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant={Variant.PRIMARY}
                    size={Size.LARGE}
                    className="whitespace-nowrap"
                    ariaLabel="Schedule a demo"
                  >
                    Schedule Demo
                  </Button>
                </div>
              )}
            </div>
            <div className="relative h-[400px] hidden md:block">
              <Image
                src="/images/platform-dashboard.png"
                alt="Platform Dashboard Preview"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {platformStats.map((stat, index) => (
              <Card
                key={index}
                variant={Variant.SECONDARY}
                className="text-center p-6"
                hoverable
              >
                <div className="text-3xl md:text-4xl font-bold text-blue-600">
                  {stat.value}
                </div>
                <div className="text-gray-600 mt-2">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Powerful Features for Modern Advertisers
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                variant={Variant.PRIMARY}
                className="p-6"
                hoverable
              >
                <div className="h-12 w-12 mb-4">
                  <Image
                    src={feature.icon}
                    alt={feature.title}
                    width={48}
                    height={48}
                  />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Integration Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Seamless Platform Integration</h2>
          <div className="flex justify-center items-center gap-12">
            <Image
              src="/images/linkedin-ads-logo.svg"
              alt="LinkedIn Ads"
              width={200}
              height={60}
              className="grayscale hover:grayscale-0 transition-all"
            />
            <Image
              src="/images/google-ads-logo.svg"
              alt="Google Ads"
              width={200}
              height={60}
              className="grayscale hover:grayscale-0 transition-all"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Ad Campaigns?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of marketers already using our platform
          </p>
          {!user && (
            <div className="max-w-md mx-auto">
              <LoginForm defaultRedirectPath="/dashboard" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default LandingPage;