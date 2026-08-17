/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getStoredUserData, clearSession } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminDashboardScreen.tsx (Expo). Same SUJHAV
// web design language as TeacherDashboardScreen: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 accent, font-serif headings,
// font-mono for numerals. Grids reflow for tablet/desktop instead of the
// fixed mobile columns/rows used in the app version.
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  title: string;
  description: string;
  color: string;
  href: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'notes',
    title: 'Notes',
    description: 'Upload and organize class notes',
    color: '#FBBF24',
    href: '/AdminNotesScreen',
    icon: (
      <path
        d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z M14 3v5h5 M9 12h6M9 16h6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'paid_materials',
    title: 'Materials',
    description: 'Manage paid study material library',
    color: '#FB7185',
    href: '/AdminPaidMaterialsScreen',
    icon: (
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z M9 7h7M9 11h7"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'free_dpp',
    title: 'DPPs',
    description: 'Publish daily practice problem sets',
    color: '#38BDF8',
    href: '/AdminDPPScreen',
    icon: (
      <path
        d="M9 11l2 2 4-4 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const TEST_ACTIONS: QuickAction[] = [
  {
    id: 'paid_test_series',
    title: 'Chapter wise JEE/NEET tests',
    description: 'Build and edit chapter-level tests',
    color: '#FB923C',
    href: '/AdminComptestChapwiseScreen',
    icon: (
      <path
        d="M9 9h.01M9 12h.01M9 15h.01M13 9h4M13 12h4M13 15h4 M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'free_test_series',
    title: 'JEE/NEET full length mock tests',
    description: 'Manage full-length mock exams',
    color: '#A3E635',
    href: '/AdminComptestScreen',
    icon: (
      <path
        d="M9 12l2 2 4-4 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const BATCH_ACTIONS: QuickAction[] = [
  {
    id: 'create_manage_batches',
    title: 'Create & manage batches',
    description: 'Set up offline batches and rosters',
    color: '#C084FC',
    href: '/AdminCreateBatchesScreen',
    icon: (
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
//   {
//     id: 'add_students_teacher',
//     title: 'Add students under teacher',
//     description: 'Assign students to a teacher',
//     color: '#FB923C',
//     href: '/AdminAddStudentsToTeacherScreen',
//     icon: (
//       <path
//         d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M20 8v6M23 11h-6"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     ),
//   },
  {
    id: 'manage_access_reports',
    title: 'Attendance & academic reports',
    description: 'Review attendance and academics',
    color: '#94A3B8',
    href: '/AdminAccessStudentReportsScreen',
    icon: (
      <path
        d="M18 20V10M12 20V4M6 20v-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const AdminDashboardScreen: React.FC = () => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [adminName, setAdminName] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUserData();

    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    setAdminName(stored?.name || 'Administrator');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    setLoggingOut(true);
    clearSession();
    router.push('/');
  };

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
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/logo-sujhav.png"
              alt="SUJHAV logo"
              className="h-[38px] w-[38px] flex-shrink-0 rounded-lg object-contain"
            />
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">
                Admin dashboard
              </span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
                Welcome back, {adminName || 'Administrator'}
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={isLoading}
            aria-label="Sign out"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10 text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-400/15 disabled:opacity-55"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* quick actions */}
        <section
          className={`mb-9 transition-all duration-500 delay-75 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Quick actions</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Content you manage most often</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <ActionButton key={action.id} action={action} onClick={() => router.push(action.href)} />
            ))}
          </div>
        </section>

        {/* test series */}
        <section
          className={`mb-9 transition-all duration-500 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Test series</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Manage JEE / NEET test content</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEST_ACTIONS.map((action) => (
              <ActionButton key={action.id} action={action} onClick={() => router.push(action.href)} />
            ))}
          </div>
        </section>

        {/* offline batch management */}
        <section
          className={`mb-9 transition-all duration-500 delay-150 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Offline batch management</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Batches, rosters and attendance</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BATCH_ACTIONS.map((action) => (
              <ActionButton key={action.id} action={action} onClick={() => router.push(action.href)} />
            ))}
          </div>
        </section>

        {/* merchandise */}
        {/* <section
          className={`mb-9 transition-all duration-500 delay-200 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Merchandise</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Items available for sale</p>
          </div>

          <button
            onClick={() => router.push('/AdminMerchandiseScreen')}
            className="group flex w-full items-center gap-4 rounded-2xl border border-pink-400/[0.18] bg-[#101d17] p-5 text-left transition-colors hover:border-pink-400/35"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-pink-400/15">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 2l1.5 4M18 2l-1.5 4M3.5 8h17l-1.2 11a2 2 0 01-2 1.8H6.7a2 2 0 01-2-1.8L3.5 8z M8 11a4 4 0 008 0"
                  stroke="#F472B6"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#eef4f1]">Add merchandise</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#8ea79c]">
                Manage and add merchandise items for sale
              </p>
            </div>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-pink-400/15 transition-transform group-hover:translate-x-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </section> */}

        {/* course management */}
        <section
          className={`mb-9 transition-all duration-500 delay-300 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Course management</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Create and manage courses for your students</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <button
              onClick={() => router.push('/AdminAddPaidCourseScreen')}
              className="group relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6 text-left transition-colors hover:border-emerald-400/50"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 10L12 5 2 10l10 5 10-5z M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"
                    stroke="#34d399"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[16px] font-bold text-[#eef4f1]">Add paid course</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8ea79c]">
                Create premium courses with paid access
              </p>
              <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 transition-transform group-hover:translate-x-0.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <button
              onClick={() => router.push('/AdminAddUnpaidCourseScreen')}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-left transition-colors hover:border-white/[0.16]"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/15">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                    stroke="#A3E635"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[16px] font-bold text-[#eef4f1]">Add free course</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8ea79c]">
                Create free courses accessible to all
              </p>
              <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-full bg-lime-400/15 transition-transform group-hover:translate-x-0.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="#A3E635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </section>

        {/* development note */}
        <div
          className={`mb-6 flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3.5 transition-all duration-500 delay-700 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="9" stroke="#34d399" strokeWidth="1.7" />
            <path d="M12 8h.01M11 11h1v5h1" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[13px] leading-relaxed text-[#8ea79c]">
            More features will be added as development progresses.
          </p>
        </div>
      </main>

      {/* logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => !loggingOut && setShowLogoutConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="#f87171"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Sign out</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">Are you sure you want to sign out?</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton: React.FC<{ action: QuickAction; onClick: () => void }> = ({ action, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-start rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-left transition-colors hover:border-white/[0.16]"
  >
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: `${action.color}20` }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={action.color}>
        {action.icon}
      </svg>
    </div>
    <p className="text-[15px] font-bold leading-snug text-[#eef4f1]">{action.title}</p>
    <p className="mt-1.5 text-[13px] leading-relaxed text-[#8ea79c]">{action.description}</p>
    <span
      className="mt-4 flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
      style={{ background: `${action.color}18` }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M13 6l6 6-6 6" stroke={action.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  </button>
);

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex flex-col items-center gap-1.5 px-5 py-6 text-center">
    <span className="font-mono text-[26px] font-bold text-emerald-400">{value}</span>
    <span className="text-[12.5px] text-[#8ea79c]">{label}</span>
  </div>
);

export default AdminDashboardScreen;