'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const ACCENT = '#34d399';
const MUTED = '#8ea79c';

export type BottomNavTab = 'home' | 'reports' | 'profile';

interface BottomNavigationProps {
  activeTab: BottomNavTab;
}

// Note: routes below are placeholders (Home / Reports / Profile) matching the
// tabs referenced by the Expo BottomNavigation. Update the `path` values once
// those screens are ported so the links point at the real pages.
const TABS: { id: BottomNavTab; label: string; path: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 11l9-7 9 7" stroke={active ? ACCENT : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" stroke={active ? ACCENT : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/UserReportsScreen',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={active ? ACCENT : MUTED} strokeWidth="2" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke={active ? ACCENT : MUTED} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    path: '/ProfileScreen',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={active ? ACCENT : MUTED} strokeWidth="2" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke={active ? ACCENT : MUTED} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
  const router = useRouter();

  return (
    // Hidden from md breakpoint up — the site has a proper top nav on desktop,
    // this bar is a mobile-only affordance (thumb-reachable navigation).
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[640px] items-center justify-around border-t border-white/[0.08] bg-[#101d17] px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 md:hidden"
      style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className={`flex flex-col items-center gap-1 rounded-[10px] px-3.5 py-1.5 transition-colors ${
              active ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.04]'
            }`}
            onClick={() => router.push(tab.path)}
          >
            {tab.icon(active)}
            <span className={`text-[11px] font-medium ${active ? 'font-bold text-emerald-400' : 'text-[#8ea79c]'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavigation;