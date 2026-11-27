'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '@/components/layout/SidebarNav';

/**
 * Phone-sized replacement for the sidebar: logo on the left, nav icons and
 * the user's avatar on the right. Hidden from the md breakpoint up.
 */
export default function MobileTopBar({
  user,
}: {
  user: { displayName: string; photoURL?: string };
}) {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200/70 bg-white px-4 md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-leaf-100">
          🌳
        </span>
        Family Tree
      </Link>
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-500 hover:bg-cream'
              }`}
            >
              {item.icon}
            </Link>
          );
        })}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="ml-1 h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-sun-100 text-sm font-bold text-amber-800"
          >
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </nav>
    </header>
  );
}
