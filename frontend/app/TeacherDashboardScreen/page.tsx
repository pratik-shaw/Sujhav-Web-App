/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken, getStoredUserData, clearSession } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherDashboardScreen.tsx (Expo). Same backend
// contracts (`GET /centers`, `GET /batches/teacher/my-batches`), same dark
// SUJHAV design language as the rest of the web dashboard: bg #0a120f,
// cards #101d17, hairline white/[0.08] borders, emerald-400 accent,
// font-serif headings, font-mono for numerals. Responsive: quick actions
// and batch cards reflow into multi-column grids on larger screens instead
// of a single mobile column.
// ---------------------------------------------------------------------------

const ALL_CENTERS_ID = '__all__';

interface Center {
  _id: string;
  centerName: string;
}

interface Batch {
  _id: string;
  batchName: string;
  classes: string[];
  category: string;
  center: { _id: string; centerName: string };
  students: Array<{ _id: string; name: string; email: string }>;
  studentAssignments: Array<{ _id: string; student: { _id: string; name: string; email: string } }>;
  teachers: Array<{ _id: string; name: string; email: string }>;
  subjects: Array<{ _id: string; name: string; teacher: { _id: string; name: string; email: string } | null }>;
  createdBy: { _id: string; name: string; email: string };
  schedule?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  color: string;
  href: string;
  icon: React.ReactNode;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'events',
    title: 'Events & calendar',
    description: 'Schedule and manage events',
    color: '#34d399',
    href: '/TeacherBatchCalendarScreen',
    icon: <path d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'attendance_reports',
    title: 'Attendance & academic reports',
    description: 'View detailed attendance reports',
    color: '#38bdf8',
    href: '/AdminAccessStudentReportsScreen',
    icon: <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'attendance',
    title: 'Mark attendance',
    description: 'Track student attendance',
    color: '#a78bfa',
    href: '/TeacherBatchAttendanceScreen',
    icon: <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M17 11l2 2 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'daily_teacher_form',
    title: 'Daily teacher report form',
    description: 'Fill your daily report form',
    color: '#fb923c',
    href: '/TeacherDailyFormScreen',
    icon: <path d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

const TeacherDashboardScreen: React.FC = () => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(ALL_CENTERS_ID);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchCenters = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/centers`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) setCenters(data.data);
    } catch (error) {
      console.error('Error fetching centers:', error);
    }
  };

  const fetchTeacherBatches = async (token: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/batches/teacher/my-batches`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success) {
        setBatches(data.data);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch batches' });
      }
    } catch (error) {
      console.error('Error fetching teacher batches:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUserData();

    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    setTeacherName(stored?.name || 'Teacher');
    fetchTeacherBatches(token);
    fetchCenters(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    const token = getToken();
    if (!token) return;
    setRefreshing(true);
    await Promise.all([fetchTeacherBatches(token), fetchCenters(token)]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    setLoggingOut(true);
    clearSession();
    router.push('/');
  };

  // unique centers present in teacher's batches
  const centersInBatches: Center[] = [];
  const seenIds = new Set<string>();
  for (const batch of batches) {
    if (batch.center?._id && !seenIds.has(batch.center._id)) {
      seenIds.add(batch.center._id);
      centersInBatches.push({ _id: batch.center._id, centerName: batch.center.centerName });
    }
  }

  const filteredBatches =
    selectedCenterId === ALL_CENTERS_ID ? batches : batches.filter((b) => b.center?._id === selectedCenterId);

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
            <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="h-[38px] w-[38px] flex-shrink-0 rounded-lg object-contain" />
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Teacher dashboard</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Welcome back, {teacherName || 'Teacher'}</h1>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign out"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10 text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-400/15"
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

      {notice && (
        <div className="relative z-[5] mx-auto max-w-[1180px] px-6 pt-4.5">
          <div
            role="alert"
            className={`relative flex flex-col gap-0.5 rounded-xl py-3.5 pl-4 pr-10 text-[13px] leading-relaxed ${
              notice.type === 'error'
                ? 'border border-red-400/35 bg-red-400/10 text-red-200'
                : notice.type === 'success'
                ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                : 'border border-white/15 bg-white/5 text-neutral-200'
            }`}
          >
            <strong className={notice.type === 'error' ? 'text-red-300' : notice.type === 'success' ? 'text-emerald-400' : ''}>
              {notice.title}
            </strong>
            <span>{notice.message}</span>
            <button className="absolute right-3 top-2.5 text-[13px] opacity-65 hover:opacity-100" onClick={() => setNotice(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* quick actions */}
        <section
          className={`mb-8 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Quick actions</h2>
            <p className="mt-1 text-[13px] text-[#8ea79c]">Manage your teaching activities</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => router.push(action.href)}
                className="group flex flex-col items-start rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-left transition-colors hover:border-white/[0.16]"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px]"
                  style={{ background: `${action.color}20` }}
                >
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
            ))}
          </div>
        </section>

        {/* batches */}
        <section
          className={`transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">My batches</h2>
              <p className="mt-1 text-[13px] text-[#8ea79c]">
                {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
                {selectedCenterId !== ALL_CENTERS_ID ? ' in this center' : ''}
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh batches"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <svg className={refreshing ? 'animate-spin' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0011.9 3.1M19 9a7 7 0 00-11.9-3.1"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          {/* center filter tabs */}
          {centersInBatches.length > 0 && (
            <div className="mb-5">
              <div className="mb-2.5 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.5" stroke="#34d399" strokeWidth="1.8" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Filter by center</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[{ _id: ALL_CENTERS_ID, centerName: 'All' }, ...centersInBatches].map((center) => {
                  const isSelected = selectedCenterId === center._id;
                  const batchCount =
                    center._id === ALL_CENTERS_ID ? batches.length : batches.filter((b) => b.center?._id === center._id).length;

                  return (
                    <button
                      key={center._id}
                      onClick={() => setSelectedCenterId(center._id)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                        isSelected
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                          : 'border-white/[0.08] text-[#8ea79c] hover:border-emerald-400/30 hover:text-[#eef4f1]'
                      }`}
                    >
                      {center._id !== ALL_CENTERS_ID && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {center.centerName}
                      <span
                        className={`rounded font-mono text-[11px] px-1.5 py-px ${isSelected ? 'bg-emerald-400/20' : 'bg-white/[0.08]'}`}
                      >
                        {batchCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && !refreshing ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
              <p className="mt-3.5 text-sm text-[#8ea79c]">Loading your batches&hellip;</p>
            </div>
          ) : filteredBatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredBatches.map((batch) => (
                <BatchCard key={batch._id} batch={batch} onOpen={() => router.push(`/TeacherBatchDetailsScreen?batchId=${batch._id}`)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No batches found</p>
              <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                {selectedCenterId === ALL_CENTERS_ID
                  ? "You haven't been assigned to any batches yet. Contact your administrator for batch assignments."
                  : 'No batches found for this center.'}
              </p>
            </div>
          )}
        </section>
      </main>

      {/* logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => !loggingOut && setShowLogoutConfirm(false)}>
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

const BatchCard: React.FC<{ batch: Batch; onOpen: () => void }> = ({ batch, onOpen }) => {
  const studentCount = batch.studentAssignments?.length ?? batch.students?.length ?? 0;

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-[#eef4f1]">{batch.batchName}</p>
          <p className="mt-0.5 text-[11.5px] font-bold uppercase tracking-wide text-emerald-400">{batch.category}</p>
        </div>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] text-[#c7d6cf]">
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Classes: {batch.classes.join(', ') || 'N/A'}
        </span>
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {studentCount} students
        </span>
        {batch.center?.centerName && (
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="9" r="2.5" stroke="#8ea79c" strokeWidth="1.6" />
            </svg>
            {batch.center.centerName}
          </span>
        )}
        {batch.schedule && (
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#8ea79c" strokeWidth="1.6" />
              <path d="M12 7v5l3 3" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {batch.schedule}
          </span>
        )}
      </div>

      {batch.description && <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-[#8ea79c]">{batch.description}</p>}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            batch.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-300'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: batch.isActive ? '#34d399' : '#f87171' }} />
          {batch.isActive ? 'Active' : 'Inactive'}
        </span>
        <span className="text-[11.5px] text-[#8ea79c]">Created {new Date(batch.createdAt).toLocaleDateString()}</span>
      </div>
    </button>
  );
};

export default TeacherDashboardScreen;