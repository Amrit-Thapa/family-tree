'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Account',
    href: '/account',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

interface SidebarNavProps {
  user: {
    displayName: string;
    email: string;
    photoURL?: string;
  };
}

export default function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col md:flex border-r border-stone-200/70 bg-white">
      {/* App branding */}
      <div className="flex h-16 items-center px-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 font-display text-xl font-semibold text-stone-900"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-leaf-100 text-lg group-hover:animate-wiggle"
          >
            🌳
          </span>
          Family Tree
        </Link>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Sidebar navigation">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-stone-600 hover:bg-cream hover:text-stone-900'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile section */}
      <div className="m-3 rounded-2xl bg-cream p-3">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={`${user.displayName}'s profile photo`}
              className="h-8 w-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sun-100 text-sm font-bold text-amber-800"
              aria-hidden="true"
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-stone-900">
              {user.displayName}
            </p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
