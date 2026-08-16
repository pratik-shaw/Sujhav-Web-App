/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getStoredUserData } from '../lib/auth';
import BottomNavigation from '../components/BottomNavigation';
import SignupLoginBanner from '../components/SignupLoginBanner';
import SubjectWiseTestActiveTab from '../components/SubjectWiseTestActiveTab';
import MonthlyReportSubjectWiseActiveTab from '../components/MonthlyReportSubjectWiseActiveTab';
import PerformanceActiveTab from '../components/PerformanceActiveTab';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of StudentPersonalReportScreen.tsx (Expo). Same
// design language as the rest of the SUJHAV web dashboard: bg #0a120f,
// cards #101d17, hairline white/[0.08] borders, emerald-400 accent,
// font-serif headings. The three tabs (Subject / Monthly / Performance)
// are rendered as a segmented control instead of a native sliding
// indicator, and each tab is its own responsive component below.
// ---------------------------------------------------------------------------

export interface UserData {
  id: string;
  name: string;
  token: string;
}

type TabType = 'subject' | 'monthly' | 'performance';

const TABS: Array<{ key: TabType; label: string; icon: React.ReactNode }> = [
  {
    key: 'subject',
    label: 'Subject',
    icon: (
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    key: 'monthly',
    label: 'Monthly',
    icon: <path d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    key: 'performance',
    label: 'Performance',
    icon: <path d="M3 3v18h18 M7 15l4-5 3 3 5-7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

const StudentPersonalReportScreen: React.FC = () => {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('subject');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUserData();

    if (token && stored?.id && stored?.name) {
      setUserData({ id: stored.id, name: stored.name, token });
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
      setUserData(null);
      setShowBanner(true);
    }
  }, []);

  const renderTabContent = () => {
    if (!userData) return null;

    switch (activeTab) {
      case 'subject':
        return <SubjectWiseTestActiveTab userData={userData} />;
      case 'monthly':
        return <MonthlyReportSubjectWiseActiveTab userData={userData} />;
      case 'performance':
        return <PerformanceActiveTab userData={userData} />;
      default:
        return null;
    }
  };

  if (isLoggedIn === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a120f]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading reports&hellip;</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      {/* ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 h-[420px] w-[420px] rounded-full bg-emerald-400 opacity-5 blur-md" />
        <div className="absolute -left-36 bottom-16 h-[300px] w-[300px] rounded-full bg-emerald-400 opacity-[0.035] blur-md" />
      </div>

      {/* top nav */}
      <header
        className={`sticky top-0 z-10 border-b border-white/[0.08] bg-[#0a120f]/85 backdrop-blur-md transition-all duration-500 ${
          mounted ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">SUJHAV</span>
            <h1 className="mt-0.5 font-serif text-xl font-semibold text-[#eef4f1]">Personal Reports</h1>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {isLoggedIn === false ? (
          <UnauthenticatedContent router={router} mounted={mounted} />
        ) : (
          <div className="pt-1">
            {/* segmented tab control */}
            <div
              role="tablist"
              aria-label="Report views"
              className={`mb-6 flex flex-wrap gap-2 transition-all duration-500 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                    activeTab === tab.key
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                      : 'border-white/[0.08] text-[#8ea79c] hover:border-emerald-400/30 hover:text-[#eef4f1]'
                  }`}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {tab.icon}
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              className={`transition-all duration-500 delay-75 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              {renderTabContent()}
            </div>
          </div>
        )}
      </main>

      {showBanner && isLoggedIn === false && <SignupLoginBanner visible={showBanner} onClose={() => setShowBanner(false)} />}

      <BottomNavigation activeTab="reports" />
    </div>
  );
};

const UnauthenticatedContent: React.FC<{ router: ReturnType<typeof useRouter>; mounted: boolean }> = ({ router, mounted }) => (
  <div
    className={`mx-auto my-16 flex max-w-[460px] flex-col items-center rounded-[18px] border border-white/[0.08] bg-[#101d17] px-9 py-12 text-center transition-all duration-500 ${
      mounted ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
    }`}
  >
    <div className="mb-5.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="#34d399" strokeWidth="1.8" />
        <path d="M8 11V7a4 4 0 018 0v4" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
    <h2 className="mb-3 font-serif text-2xl font-semibold text-[#eef4f1]">Authentication required</h2>
    <p className="mb-2 text-[15px] leading-relaxed text-[#eef4f1]">Sign in to view your personal reports.</p>
    <p className="mb-7 text-[13.5px] leading-relaxed text-[#8ea79c]">Track your subject-wise, monthly, and overall performance.</p>

    <div className="flex w-full flex-col gap-3">
      <button
        className="w-full rounded-[10px] bg-emerald-400 px-8 py-3.5 text-[15px] font-bold text-[#06140f] transition-all hover:brightness-110"
        onClick={() => router.push('/SignInScreen')}
      >
        Sign in
      </button>
      <button
        className="w-full rounded-[10px] border border-emerald-400/30 px-8 py-3 text-[14.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/10"
        onClick={() => router.push('/SignUpScreen')}
      >
        Create account
      </button>
    </div>
  </div>
);

export default StudentPersonalReportScreen;