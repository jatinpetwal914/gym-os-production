'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Music2,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MARKETING_PLANS, type MarketingPlanId } from '@/lib/marketing-plans';

const NAV = [
  { href: '#platform', label: 'Platform' },
  { href: '#features', label: 'Features' },
  { href: '#plans', label: 'Plans' },
  { href: '#about', label: 'About' },
];

const FEATURES = [
  { icon: Users, title: 'Member management', body: 'Profiles, photos, memberships, and status in one desk view.' },
  { icon: QrCode, title: 'QR attendance', body: 'Check members in and out with QR so the floor keeps moving.' },
  { icon: CreditCard, title: 'Payments & dues', body: 'Record collections and keep payment history in the same gym.' },
  { icon: ClipboardList, title: 'Gym forms', body: 'Build forms, share a public link, and review submissions at the desk.' },
  { icon: LayoutDashboard, title: 'Live dashboard', body: 'See who is inside, attendance, and revenue without extra tools.' },
  { icon: Dumbbell, title: 'Membership plans', body: 'Create and assign gym plans with pricing that matches your floor.' },
  { icon: ShieldCheck, title: 'Staff access', body: 'Owner, admin, manager, and staff roles stay scoped to that gym.' },
  { icon: Music2, title: 'Floor music', body: 'Play gym playlists from the desk while you run daily operations.' },
];

function formatPrice(value: number) {
  return value.toLocaleString('en-IN');
}

export function PlanLanding() {
  const router = useRouter();

  const selectPlan = (id: MarketingPlanId) => {
    router.push(`/register?plan=${id}`);
  };

  return (
    <div className="landing-os min-h-screen overflow-hidden bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#platform" className="inline-flex shrink-0 items-center gap-2.5" aria-label="Gym OS home">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#155EEF] text-white shadow-lg shadow-blue-200/70">
              <Dumbbell className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[15px] font-bold tracking-[0.15em] text-slate-900">GYM OS</span>
          </a>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-500 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-[#155EEF]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#155EEF] sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="#plans"
              className="inline-flex items-center gap-2 rounded-xl bg-[#155EEF] px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-blue-200/70 transition hover:-translate-y-0.5 hover:bg-[#124FCC] sm:px-5"
            >
              Choose a plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <nav aria-label="Mobile navigation" className="flex gap-6 overflow-x-auto border-b border-slate-100 bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8 md:hidden">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className="whitespace-nowrap transition-colors hover:text-[#155EEF]">
            {item.label}
          </a>
        ))}
      </nav>

      <section id="platform" className="relative isolate overflow-hidden border-b border-blue-100/70 bg-[#F7FAFF]">
        <div className="pointer-events-none absolute -left-48 top-24 h-[28rem] w-[28rem] rounded-full bg-blue-200/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-48 -top-56 h-[38rem] w-[38rem] rounded-full bg-sky-100/80 blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.24]"
          aria-hidden
          style={{
            backgroundImage: 'radial-gradient(#7BA6E8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(90deg, black, transparent 45%, transparent)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[0.82fr_1.18fr] lg:gap-4 lg:pb-24 lg:pt-20">
          <div className="relative z-10 order-1 max-w-xl text-center lg:text-left">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#155EEF] shadow-sm shadow-blue-100/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-100" />
              The smarter way to run your gym
            </p>
            <h1 className="text-[2.75rem] font-bold leading-[1.04] tracking-[-0.055em] text-slate-900 sm:text-6xl lg:text-[4.35rem]">
              Your gym.
              <span className="mt-1 block text-[#155EEF]">All in sync.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:mx-0">
              Spend less time on admin and more time building a stronger community. Members, check-ins, plans, and payments—together in one clear view.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <a
                href="#plans"
                className="inline-flex items-center gap-2 rounded-xl bg-[#155EEF] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-[#124FCC]"
              >
                Explore plans
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-[#155EEF]"
              >
                Staff log in
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium text-slate-400">Simple setup · Built for independent gyms · No payment at sign-up</p>
          </div>

          <div className="relative order-2 mx-auto w-full max-w-3xl lg:-mr-10 lg:max-w-none">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-300/50 via-sky-200/50 to-teal-100/50 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute left-[12%] top-[18%] h-3 w-3 rounded-full bg-[#155EEF]/70 shadow-[0_0_0_8px_rgba(21,94,239,0.08)]" aria-hidden />
            <div className="pointer-events-none absolute right-[12%] top-[12%] h-3 w-3 rotate-45 bg-white shadow-[0_2px_12px_rgba(21,94,239,0.2)]" aria-hidden />
            <Image
              src="/images/gymos-mobile-preview.png"
              alt="Gym OS mobile app previews showing the dashboard, live tracker, and class schedule"
              width={1399}
              height={768}
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="relative z-10 h-auto w-full drop-shadow-[0_24px_35px_rgba(37,74,132,0.12)]"
            />
          </div>
        </div>

        <div className="relative z-10 mx-auto -mb-8 grid max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border border-blue-100/80 bg-white/95 px-5 py-4 shadow-[0_18px_55px_rgba(37,74,132,0.10)] sm:-mb-9 sm:grid-cols-3 sm:px-7 sm:py-5">
          {[
            { icon: Users, title: 'Members', body: 'Profiles, plans & renewals' },
            { icon: QrCode, title: 'Check-ins', body: 'Fast QR attendance' },
            { icon: CreditCard, title: 'Payments', body: 'Collections & dues' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`flex items-center gap-3 py-3 sm:justify-center sm:py-1 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#155EEF]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-800">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.body}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="features" className="bg-white">
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#155EEF]">Made for the daily grind</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything your gym needs, in one place
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
              The everyday tools that keep your floor moving and your business running smoothly.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
            {FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,39,77,0.035)] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_16px_35px_rgba(37,74,132,0.09)]">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-50 text-[#155EEF] transition-colors group-hover:bg-[#155EEF] group-hover:text-white">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <p className="text-[14px] font-bold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="plans" className="scroll-mt-24 border-y border-blue-100/70 bg-[#F7FAFF]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#155EEF]">Straightforward pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Choose a plan that grows with you
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
            Pick the membership that suits your gym. You can review everything before continuing to registration.
          </p>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          {MARKETING_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan.id)}
              className={`group relative flex h-full w-full flex-col rounded-3xl border bg-white p-6 text-left shadow-[0_8px_30px_rgba(37,74,132,0.055)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(37,74,132,0.12)] sm:p-7 ${
                plan.recommended ? 'border-[#155EEF] ring-2 ring-blue-100' : 'border-slate-200'
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 right-6 inline-flex rounded-full bg-[#155EEF] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white shadow-md shadow-blue-200">
                  Most popular
                </span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">{plan.duration}</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{plan.tagline}</p>
              <p className="mt-6 text-4xl font-bold tracking-tight text-slate-900">
                {plan.currency}
                {formatPrice(plan.price)}
                <span className="ml-1 text-sm font-medium tracking-normal text-slate-400">{plan.periodLabel}</span>
              </p>
              {plan.savings && <p className="mt-2 inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{plan.savings}</p>}
              <ul className="mt-6 flex-1 space-y-3 border-t border-slate-100 pt-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-3 w-3" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <span className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                plan.recommended ? 'bg-[#155EEF] text-white group-hover:bg-[#124FCC]' : 'bg-blue-50 text-[#155EEF] group-hover:bg-blue-100'
              }`}>
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#101F3D] px-6 py-10 shadow-[0_24px_70px_rgba(16,31,61,0.18)] sm:px-10 sm:py-12 lg:px-14">
            <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-48 right-1/4 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">
                  <Building2 className="h-4 w-4" />
                  Made for your floor
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Built around the way gyms work.</h2>
                <p className="mt-4 text-sm leading-7 text-blue-100/75 sm:text-base">
                  Keep members, plans, attendance, and payments organized in one place. Each location stays separate, while a Super Admin can oversee the wider network.
                </p>
                <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-blue-100/70">
                  <ShieldCheck className="h-4 w-4 text-teal-300" />
                  Gym-specific access keeps your operations in the right hands.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <a
                  href="#plans"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-[#155EEF] transition hover:bg-blue-50"
                >
                  Compare plans
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Staff log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <a href="#platform" className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-slate-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#155EEF]">
              <Dumbbell className="h-3.5 w-3.5" />
            </span>
            GYM OS
          </a>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-400">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-[#155EEF]">
                {item.label}
              </a>
            ))}
            <Link href="/login" className="transition-colors hover:text-[#155EEF]">
              Login
            </Link>
          </div>
          <p className="text-xs text-slate-400 sm:text-right">A clearer day starts here.</p>
        </div>
      </footer>
    </div>
  );
}
