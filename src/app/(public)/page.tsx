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

/** Accent colour sets, cycled through so each card feels a little different. */
const ACCENTS = [
  { chip: 'bg-brand-100 text-brand-700', ring: 'hover:border-brand-200' },
  { chip: 'bg-sun-100 text-amber-800', ring: 'hover:border-sun-300' },
  { chip: 'bg-leaf-100 text-leaf-700', ring: 'hover:border-leaf-300' },
  { chip: 'bg-sky-100 text-sky-700', ring: 'hover:border-sky-200' },
];

const STEPS = [
  {
    emoji: '🌱',
    title: 'Plant your tree',
    body: 'Start a family tree in seconds and add the people you know — grandparents and great-grandparents included, even if they’ll never have an account.',
  },
  {
    emoji: '💌',
    title: 'Send the family a link',
    body: 'Share an invite over WhatsApp, text or at the dinner table. When someone joins, they land in the right spot — as a parent, child or spouse of someone already there.',
  },
  {
    emoji: '🧩',
    title: 'Watch it all click',
    body: 'One shared map of the whole family. Tap anyone to see their parents, kids and partner — plus siblings, cousins, uncles and aunts worked out for you.',
  },
];

const FEATURES = [
  {
    emoji: '🗺️',
    title: 'A map you can wander',
    body: 'Generations laid out top to bottom, automatically. Pan, zoom and tap through even the biggest families, on phone or desktop.',
  },
  {
    emoji: '✨',
    title: 'Relationships, worked out',
    body: 'Add parents and partners once. Siblings, half-siblings, grandparents, aunties, uncles and first cousins appear like magic.',
  },
  {
    emoji: '🤝',
    title: 'Built together',
    body: 'Admins, editors and viewers. Share ownership with a few relatives so the tree never depends on just one person.',
  },
  {
    emoji: '🔒',
    title: 'Private by default',
    body: 'Only members can see a tree — to everyone else it simply doesn’t exist. Deleted trees can be restored for 30 days.',
  },
];

const COMING_SOON = [
  {
    emoji: '🧭',
    title: '“How am I connected?”',
    body: 'Pick anyone and see the exact path from you to them.',
  },
  {
    emoji: '🪪',
    title: 'Context cards',
    body: 'A quick catch-up before a gathering: who they are, what they do, what’s new.',
  },
  {
    emoji: '📸',
    title: 'Stories & photos',
    body: 'Life events, journeys and memories, saved for the next generation.',
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

  const focusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream';
  const primaryButton = `inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-base font-bold text-white shadow-[0_4px_0_0_var(--color-brand-700)] hover:bg-brand-600 ${focusRing}`;

  return (
    <div className="flex min-h-screen flex-col bg-cream text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className={`group flex items-center gap-2 rounded-2xl font-display text-xl font-semibold text-stone-900 ${focusRing}`}
          >
            <LogoMark className="group-hover:animate-wiggle" />
            <span>Family Tree</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
            <a
              href="#how-it-works"
              className={`hidden rounded-full px-3 py-1.5 text-sm font-bold text-stone-600 hover:bg-white hover:text-stone-900 sm:inline ${focusRing}`}
            >
              How it works
            </a>
            <a
              href="#features"
              className={`hidden rounded-full px-3 py-1.5 text-sm font-bold text-stone-600 hover:bg-white hover:text-stone-900 sm:inline ${focusRing}`}
            >
              Features
            </a>
            <Link
              href={isSignedIn ? '/dashboard' : '/auth/signin'}
              className={`rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-[0_2px_0_0_rgb(231_229_228)] hover:bg-brand-50 ${focusRing}`}
            >
              {isSignedIn ? 'Dashboard' : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Soft decorative blobs */}
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sun-100 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-brand-100 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pb-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand-700 shadow-[0_2px_0_0_rgb(231_229_228)]">
                <span aria-hidden="true">🎉</span>
                For weddings, reunions and every family get-together
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.05] text-stone-900 sm:text-6xl">
                Know exactly how you’re related.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                Build your family tree together, see everyone on one cosy map,
                and never again wonder who that smiling person across the table
                is — or what you’re supposed to call them. <span aria-hidden="true">😅</span>
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={primaryCta.href} className={primaryButton}>
                  <span aria-hidden="true">🌳</span>
                  {primaryCta.label}
                </Link>
                <a
                  href="#how-it-works"
                  className={`inline-flex items-center justify-center rounded-full border-2 border-stone-200 bg-white px-6 py-3 text-base font-bold text-stone-700 shadow-[0_4px_0_0_rgb(231_229_228)] hover:bg-stone-50 ${focusRing}`}
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm font-semibold text-stone-500">
                Free to use · Sign in with Google · No new password to forget
              </p>
            </div>

            <TreeIllustration className="mx-auto w-full max-w-lg pb-10" />
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
                className="text-4xl font-semibold text-stone-900"
              >
                How it works
              </h2>
              <p className="mt-3 text-lg text-stone-600">
                Three easy steps from “wait, who’s that?” to a family everyone can explore.
              </p>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const accent = ACCENTS[index % ACCENTS.length];
                return (
                  <li
                    key={step.title}
                    className={`group relative rounded-[2rem] border-2 border-transparent bg-white p-6 shadow-[0_4px_0_0_rgb(231_229_228)] transition-all duration-200 hover:-translate-y-1 ${accent.ring}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl group-hover:animate-wiggle ${accent.chip}`}
                      >
                        {step.emoji}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${accent.chip}`}>
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-stone-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 leading-7 text-stone-600">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-16 bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2
                id="features-heading"
                className="text-4xl font-semibold text-stone-900"
              >
                Everything your family knows, in one place
              </h2>
              <p className="mt-3 text-lg text-stone-600">
                Made for big, busy, loud families — and the relatives you only
                see once a year. <span aria-hidden="true">🥳</span>
              </p>
            </div>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((feature, index) => {
                const accent = ACCENTS[index % ACCENTS.length];
                return (
                  <li
                    key={feature.title}
                    className={`group flex gap-4 rounded-[2rem] border-2 border-stone-100 bg-cream p-6 transition-all duration-200 hover:-translate-y-1 ${accent.ring}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl group-hover:animate-wiggle ${accent.chip}`}
                    >
                      {feature.emoji}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold text-stone-900">
                        {feature.title}
                      </h3>
                      <p className="mt-2 leading-7 text-stone-600">{feature.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Coming soon */}
            <div className="mt-16">
              <h3 className="inline-flex items-center gap-2 rounded-full bg-sun-100 px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide text-amber-800">
                <span aria-hidden="true">🚧</span>
                Coming soon
              </h3>
              <ul className="mt-5 grid gap-4 md:grid-cols-3">
                {COMING_SOON.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-3xl border-2 border-dashed border-stone-200 bg-white p-5"
                  >
                    <p className="font-display text-lg font-semibold text-stone-900">
                      <span aria-hidden="true" className="mr-2">{item.emoji}</span>
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
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
            <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-500 px-6 py-14 text-center shadow-[0_8px_0_0_var(--color-brand-700)] sm:px-12">
              <span aria-hidden="true" className="absolute left-6 top-6 text-4xl animate-float">🌿</span>
              <span aria-hidden="true" className="absolute bottom-6 right-8 text-4xl animate-float [animation-delay:1.5s]">🍃</span>
              <h2
                id="cta-heading"
                className="text-4xl font-semibold text-white"
              >
                Get the whole family together before the next gathering
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-lg text-brand-50">
                Plant a tree, share one link, and let everyone fill in the
                branches they know best.
              </p>
              <Link
                href={primaryCta.href}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-brand-700 shadow-[0_4px_0_0_var(--color-brand-700)] hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-500"
              >
                <span aria-hidden="true">🌳</span>
                {primaryCta.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm font-semibold text-stone-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-display text-base text-stone-700">
            <LogoMark small />
            <span>Family Tree</span>
          </div>
          <p>© {new Date().getFullYear()} Family Tree. Made with <span aria-label="love">❤️</span> for families.</p>
        </div>
      </footer>
    </div>
  );
}

// --- Decorative ---

function LogoMark({ className = '', small = false }: { className?: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-2xl bg-leaf-100 ${
        small ? 'h-7 w-7 text-base' : 'h-9 w-9 text-lg'
      } ${className}`}
    >
      🌳
    </span>
  );
}
