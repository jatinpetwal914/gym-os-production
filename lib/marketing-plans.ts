export type MarketingPlanId = 'monthly' | 'quarterly' | 'half_yearly';

export interface MarketingPlan {
  id: MarketingPlanId;
  name: string;
  duration: string;
  price: number;
  currency: string;
  periodLabel: string;
  savings?: string;
  tagline: string;
  cta: string;
  recommended?: boolean;
  href: string;
  features: string[];
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: 'monthly',
    name: 'Standard Flex',
    duration: '1 Month',
    price: 1500,
    currency: '₹',
    periodLabel: '/month',
    tagline: 'Ideal for independent gyms getting started digitally.',
    cta: 'Start Monthly',
    href: '/register?plan=monthly',
    features: [
      'Full member management',
      'Member photos & QR cards',
      'QR & barcode attendance',
      'Basic revenue dashboard',
      'Digital member profiles',
      'Gym forms & public links',
      'Automated renewal reminders',
    ],
  },
  {
    id: 'quarterly',
    name: 'Growth Pro',
    duration: '3 Months',
    price: 3999,
    currency: '₹',
    periodLabel: 'for 3 months',
    savings: 'Save ₹501',
    tagline: 'The sweet spot for rapidly growing fitness hubs.',
    cta: 'Get Most Popular',
    recommended: true,
    href: '/register?plan=quarterly',
    features: [
      'Everything in Flex',
      'Advanced attendance & shifts',
      'Payment gateway & UPI tracking',
      'Trainer commission management',
      'Financial performance analytics',
      'Gym forms & submissions',
      'Automated WhatsApp/SMS alerts',
    ],
  },
  {
    id: 'half_yearly',
    name: 'Elite Power',
    duration: '6 Months',
    price: 6999,
    currency: '₹',
    periodLabel: 'for 6 months',
    savings: 'Save ₹2001',
    tagline: 'Maximum value for multi-trainer or high-volume gyms.',
    cta: 'Scale Your Gym',
    href: '/register?plan=half_yearly',
    features: [
      'Everything in Pro',
      'Multi-branch / location ready',
      'Staff role-based permissions',
      'Custom PDF financial reports',
      'Diet & workout plan builders',
      'Floor music library access',
      'Priority 24/7 dedicated support',
    ],
  },
];

export function parseMarketingPlanId(value: string | null | undefined): MarketingPlanId | null {
  if (value === 'monthly' || value === 'quarterly' || value === 'half_yearly') {
    return value;
  }
  return null;
}

export function marketingPlanLabel(id: MarketingPlanId | null): string | null {
  if (!id) return null;
  const plan = MARKETING_PLANS.find((item) => item.id === id);
  return plan ? `${plan.name} (${plan.duration}) Selected` : null;
}