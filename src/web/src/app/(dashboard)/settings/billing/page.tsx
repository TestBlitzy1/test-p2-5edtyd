'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { useSubscription, useQuery } from '@tanstack/react-query';
import Card from '../../../../components/common/Card';
import Button from '../../../../components/common/Button';
import { Size, Variant } from '../../../../types/common';
import { UserRole } from '../../../../types/auth';

// Initialize Stripe with public key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY as string);

// Subscription plan types
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  billingPeriod: 'monthly' | 'annual';
}

// Payment method interface
interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

// Billing history interface
interface BillingHistoryItem {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

/**
 * Billing settings page component for managing subscription and payment information
 */
const BillingPage: React.FC = () => {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch current subscription data
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await fetch('/api/billing/subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      return response.json();
    },
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const response = await fetch('/api/billing/payment-methods');
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      return response.json();
    },
  });

  // Fetch billing history
  const { data: billingHistory } = useQuery({
    queryKey: ['billingHistory'],
    queryFn: async () => {
      const response = await fetch('/api/billing/history');
      if (!response.ok) throw new Error('Failed to fetch billing history');
      return response.json();
    },
  });

  /**
   * Handles secure plan upgrade process
   */
  const handleUpgradePlan = async (planId: string) => {
    try {
      setIsUpdating(true);
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize');

      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const { sessionId } = await response.json();
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) throw error;
    } catch (error) {
      console.error('Plan upgrade error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Handles adding new payment method
   */
  const handleAddPaymentMethod = async () => {
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize');

      const response = await fetch('/api/billing/setup-intent');
      const { clientSecret } = await response.json();

      const { error } = await stripe.confirmCardSetup(clientSecret);
      if (error) throw error;
    } catch (error) {
      console.error('Add payment method error:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Current Plan Section */}
      <Card
        title="Current Plan"
        variant={Variant.PRIMARY}
        className="bg-white shadow-sm"
      >
        <div className="p-6">
          {isLoadingSubscription ? (
            <div className="animate-pulse h-20" />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">{subscription?.plan.name}</h3>
                  <p className="text-gray-500">
                    {subscription?.plan.price} {subscription?.plan.currency} / {subscription?.plan.billingPeriod}
                  </p>
                </div>
                <Button
                  variant={Variant.SECONDARY}
                  size={Size.MEDIUM}
                  onClick={() => handleUpgradePlan('premium')}
                  isLoading={isUpdating}
                  disabled={subscription?.plan.name === 'Premium'}
                >
                  Upgrade Plan
                </Button>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Features</h4>
                <ul className="space-y-2">
                  {subscription?.plan.features.map((feature: string) => (
                    <li key={feature} className="flex items-center text-gray-600">
                      <CheckIcon className="w-5 h-5 mr-2 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Methods Section */}
      <Card
        title="Payment Methods"
        variant={Variant.PRIMARY}
        className="bg-white shadow-sm"
      >
        <div className="p-6">
          <div className="space-y-4">
            {paymentMethods?.map((method: PaymentMethod) => (
              <div
                key={method.id}
                className="flex justify-between items-center p-4 border rounded-lg"
              >
                <div className="flex items-center">
                  <CreditCardIcon className="w-6 h-6 mr-3 text-gray-400" />
                  <div>
                    <p className="font-medium">
                      {method.brand} •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                </div>
                {method.isDefault && (
                  <span className="text-sm text-green-600 font-medium">
                    Default
                  </span>
                )}
              </div>
            ))}
            <Button
              variant={Variant.SECONDARY}
              size={Size.MEDIUM}
              onClick={handleAddPaymentMethod}
            >
              Add Payment Method
            </Button>
          </div>
        </div>
      </Card>

      {/* Billing History Section */}
      <Card
        title="Billing History"
        variant={Variant.PRIMARY}
        className="bg-white shadow-sm"
      >
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {billingHistory?.map((item: BillingHistoryItem) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.amount} {item.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Icon components
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path d="M3 10h18M7 15h.01M11 15h.01M3 6h18v12H3V6z" />
  </svg>
);

export default BillingPage;