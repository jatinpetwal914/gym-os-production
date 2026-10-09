'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { RegistrationForm } from '@/components/marketing/registration-form';
import { parseMarketingPlanId } from '@/lib/marketing-plans';

function RegisterExperience() {
  const searchParams = useSearchParams();
  const planId = parseMarketingPlanId(searchParams.get('plan'));

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4F7FA] pb-32 text-slate-800 lg:pb-0">
      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-24 sm:px-8">
        <Link
          href="/#plans"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-[#2064B6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2064B6]">Gym OS</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">Register your gym</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
          Submit a registration request. Your Gym OS account will be created after your registration is reviewed.
          Login credentials will be sent later — do not create a password now.
        </p>
        <div className="mt-8 rounded-3xl border border-[#DAE1E7] bg-white p-6 shadow-[0_16px_40px_rgba(32,100,182,0.08)] sm:p-8">
          <RegistrationForm initialPlanId={planId} />
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-slate-400">Loading…</div>
      }
    >
      <RegisterExperience />
    </Suspense>
  );
}
