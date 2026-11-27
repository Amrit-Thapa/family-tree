import Link from 'next/link';
import type { Metadata } from 'next';
import { verifySession } from '@/lib/auth/session';
import TreeIllustration from '@/components/landing/TreeIllustration';

export const metadata: Metadata = {
  title: 'Family Tree — Know exactly how you’re related',
  description:
    'Build your family tree together, see everyone on one interactive map, and instantly understand how every relative is connected to you.',
};

// --- Content ---

const STEPS = [
  {
    title: 'Start your tree',
    body: 'Create a family tree in seconds and add the people you know — including grandparents and ancestors who will never have an account.',
  },
  {
    title: 'Invite family with a link',
    body: 'Share an invite over WhatsApp, text or in person. When someone joins, they land in the right spot — as a parent, child or spouse of someone already in the tree.',
  },
  {
    title: 'See how everyone connects',
    body: 'Explore one shared map of the whole family. Tap anyone to see their parents, children and spouses — plus siblings, cousins, uncles and aunts worked out for you.',
  },
];

const FEATURES = [
  {
    title: 'An interactive family map',
    body: 'Generations laid out top to bottom automatically. Pan, zoom and tap through even large families, on phone or desktop.',
    icon: GraphIcon,
  },
  {
    title: 'Relationships, worked out',
    body: 'Add parents and spouses once. Siblings, half-siblings, grandparents, uncles, aunts and first cousins are derived for you.',
    icon: SparkIcon,
  },
  {
    title: 'Built together, with roles',
    body: 'Admins, editors and viewers. Several admins can share ownership so a tree never depends on a single person.',
    icon: PeopleIcon,
  },
  {
    title: 'Private by default',
    body: 'Only members can see a tree — to everyone else it simply doesn’t exist. Deleted trees can be restored for 30 days.',
    icon: LockIcon,
  },
];

const COMING_SOON = [
  {
    title: '“How am I connected?”',
    body: 'Pick anyone and see the exact path from you to them.',
  },
  {
    title: 'Context cards',
    body: 'A quick summary before a gathering: who they are, what they do, what’s new.',
  },
  {
    title: 'Stories & photos',
    body: 'Life events, migrations and memories, preserved for the next generation.',
  },
];

// --- Page ---

/**
 * Whether the visitor has a valid session. The landing page must always
 * render, so a session lookup failure (e.g. database unavailable) is treated
 * as signed out rather than surfacing an error.
 */
async function hasActiveSession(): Promise<boolean> {
  try {
    return (await verifySession()) !== null;
  } catch {
    return false;
  }
}

/**
 * Public landing page at "/".
 *
 * Explains the product and sends visitors to Google sign-in. Signed-in users
 * see a "Go to your dashboard" call to action instead.
 */
export default async function LandingPage() {
  const isSignedIn = await hasActiveSession();

  const primaryCta = isSignedIn
    ? { href: '/dashboard', label: 'Go to your dashboard' }
    : { href: '/auth/signin', label: 'Get started with Google' };

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <LogoMark className="h-7 w-7" />
            <span>Family Tree</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-4">
            <a
              href="#how-it-works"
              className="hidden rounded-md px-2 py-1 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:inline"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden rounded-md px-2 py-1 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:inline"
            >
              Features
            </a>
            <Link
              href={isSignedIn ? '/dashboard' : '/auth/signin'}
              className="rounded-md px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {isSignedIn ? 'Dashboard' : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="overflow-hidden bg-linear-to-b from-indigo-50/70 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                For weddings, reunions and every family gathering
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Know exactly how you’re related.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
                Build your family tree together, see everyone on one map, and
                never again wonder who that person across the table is — or what
                to call them.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  {primaryCta.label}
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Free to use. Sign in with your Google account — no new password.
              </p>
            </div>

            <TreeIllustration className="mx-auto w-full max-w-lg pb-6" />
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-16 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2
                id="how-it-works-heading"
                className="text-3xl font-bold tracking-tight text-gray-900"
              >
                How it works
              </h2>
              <p className="mt-3 text-lg text-gray-600">
                Three steps from “who’s that?” to a family everyone can explore.
              </p>
            </div>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-7 text-gray-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-16 border-y border-gray-100 bg-gray-50 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2
                id="features-heading"
                className="text-3xl font-bold tracking-tight text-gray-900"
              >
                Everything your family knows, in one place
              </h2>
              <p className="mt-3 text-lg text-gray-600">
                Designed for big, busy families — and the relatives you only
                see once a year.
              </p>
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 leading-7 text-gray-600">{feature.body}</p>
                </li>
              ))}
            </ul>

            {/* Coming soon */}
            <div className="mt-16">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Coming soon
              </h3>
              <ul className="mt-4 grid gap-4 md:grid-cols-3">
                {COMING_SOON.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-5"
                  >
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-heading" className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-2xl bg-indigo-600 px-6 py-12 text-center shadow-lg sm:px-12">
              <h2
                id="cta-heading"
                className="text-3xl font-bold tracking-tight text-white"
              >
                Bring your family together before the next gathering
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-lg text-indigo-100">
                Start a tree, share one link, and let everyone fill in the
                branches they know best.
              </p>
              <Link
                href={primaryCta.href}
                className="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-base font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
              >
                {primaryCta.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-5 w-5" />
            <span>Family Tree</span>
          </div>
          <p>© {new Date().getFullYear()} Family Tree. Made for families.</p>
        </div>
      </footer>
    </div>
  );
}

// --- Icons (decorative) ---

type IconProps = { className?: string };

function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-indigo-600" />
      <path
        d="M16 9v6m0 0h-6v5m6-5h6v5"
        className="fill-none stroke-white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="8" r="2.5" className="fill-white" />
      <circle cx="10" cy="22" r="2.5" className="fill-white" />
      <circle cx="22" cy="22" r="2.5" className="fill-white" />
    </svg>
  );
}

function GraphIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="5" r="2.25" />
      <circle cx="6" cy="19" r="2.25" />
      <circle cx="18" cy="19" r="2.25" />
      <path d="M12 7.25V12m0 0H6v4.75M12 12h6v4.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.25" />
      <path d="M15.5 14.2A5 5 0 0121 19" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" strokeLinecap="round" />
    </svg>
  );
}
