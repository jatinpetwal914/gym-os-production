'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StaffAuthPanel } from '@/components/auth/staff-auth-panel';
import { parseMarketingPlanId } from '@/lib/marketing-plans';

function LoginExperience() {
  const searchParams = useSearchParams();
  const planId = parseMarketingPlanId(searchParams.get('plan'));

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4F7FA] pb-32 text-slate-800 lg:pb-0">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-white lg:block">
          <div className="landing-blob landing-blob-blue absolute left-10 top-16 h-16 w-16" aria-hidden />
          <div className="landing-blob landing-blob-teal absolute right-12 top-10 h-32 w-40 rounded-[2.5rem]" aria-hidden />
          <div className="relative z-10 flex h-full flex-col justify-between p-12">
            <div className="mx-auto w-full max-w-md pt-8">
              <img
                src="/images/landing-hero.png?v=3"
                alt="Gym operations overview"
                width={720}
                height={720}
                className="h-auto w-full"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2064B6]">Gym OS</p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold tracking-tight text-slate-800">Welcome to Gym OS.</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-500">
                Your gym. Your members. Your operations. One powerful platform.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col justify-start px-5 py-10 pt-16 sm:px-10 lg:justify-center lg:pt-24">
          <div className="relative mx-auto w-full max-w-md">
            <Link
              href="/#plans"
              className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-[#2064B6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to plans
            </Link>
            <div className="mb-8 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2064B6]">Gym OS</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome to Gym OS.</h1>
            </div>
            <StaffAuthPanel planId={planId} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-slate-400">Loading…</div>
      }
    >
      <LoginExperience />
    </Suspense>
  );
}
