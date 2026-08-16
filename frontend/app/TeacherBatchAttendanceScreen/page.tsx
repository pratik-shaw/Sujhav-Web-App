/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherBatchAttendanceScreen.tsx (Expo). Same
// backend contract (GET /batches/teacher/my-batches), same dark SUJHAV
// design language as the rest of the web dashboard: bg #0a120f, cards
// #101d17, hairline white/[0.08] borders, emerald-400 accent, font-serif
// headings, font-mono for numerals. This screen is a batch picker — tapping
// a batch card takes the teacher to TeacherHandleBatchAttendanceScreen to
// actually mark attendance, carrying batchId/batchName/subjects via query.
// ---------------------------------------------------------------------------

const ALL_CENTERS_ID = '__all__';

interface Center {
  _id: string;
  centerName: string;
}

interface Subject {
  name: string;
  teacher: string;
  _id?: string;
}

interface Batch {
  _id: string;
  batchName: string;
  classes: string[];
  category: string;
  subjects: Subject[];
  center: { _id: string; centerName: string };
  students: Array<{ _id: string; name: string; email: string }>;
  teachers: Array<{ _id: string; name: string; email: string }>;
  createdBy: { _id: string; name: string; email: string };
  schedule?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const TeacherBatchAttendanceScreen: React.FC = () => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(ALL_CENTERS_ID);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchTeacherBatches = async () => {
    try {
      setIsLoading(true);
      const token = getToken();

      if (!token) {
        setNotice({ type: 'error', title: 'Error', message: 'No authentication token found' });
        return;
      }

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
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    fetchTeacherBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeacherBatches();
    setRefreshing(false);
  };

  const handleBatchPress = (batch: Batch) => {
    const params = new URLSearchParams({
      batchId: batch._id,
      batchName: batch.batchName,
      subjects: JSON.stringify(batch.subjects || []),
    });
    router.push(`/TeacherHandleBatchAttendanceScreen?${params.toString()}`);
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
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Attendance management</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
                {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
                {selectedCenterId !== ALL_CENTERS_ID ? ' in this center' : ' available'}
              </h1>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing || isLoading}
            aria-label="Refresh batches"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <svg className={refreshing ? 'animate-spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0011.9 3.1M19 9a7 7 0 00-11.9-3.1"
                stroke="#34d399"
                strokeWidth="2"
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
        <section className={`mb-6 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Select batch</h2>
          <p className="mt-1 text-[13px] text-[#8ea79c]">Choose a batch to mark student attendance</p>
        </section>

        {/* center filter tabs */}
        {centersInBatches.length > 0 && (
          <div className="mb-6">
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
                    <span className={`rounded font-mono text-[11px] px-1.5 py-px ${isSelected ? 'bg-emerald-400/20' : 'bg-white/[0.08]'}`}>
                      {batchCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <section className={`transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {isLoading && !refreshing ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
              <p className="mt-3.5 text-sm text-[#8ea79c]">Loading your batches&hellip;</p>
            </div>
          ) : filteredBatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredBatches.map((batch) => (
                <AttendanceBatchCard key={batch._id} batch={batch} onOpen={() => handleBatchPress(batch)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                  stroke="#8ea79c"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No batches available</p>
              <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                {selectedCenterId === ALL_CENTERS_ID
                  ? "You haven't been assigned to any batches yet. Contact your administrator for batch assignments."
                  : 'No batches found for this center.'}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const AttendanceBatchCard: React.FC<{ batch: Batch; onOpen: () => void }> = ({ batch, onOpen }) => {
  const visibleSubjects = batch.subjects.slice(0, 3);
  const extraSubjectCount = batch.subjects.length - visibleSubjects.length;

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75"
              stroke="#34d399"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z M6 12v5c3 3 9 3 12 0v-5" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Classes: {batch.classes.join(', ') || 'N/A'}
        </span>
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {batch.students.length} students &middot; {batch.subjects.length} subjects
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

      {batch.subjects.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {visibleSubjects.map((subject, index) => (
            <span
              key={subject._id || index}
              className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] font-semibold text-emerald-400"
            >
              {subject.name}
            </span>
          ))}
          {extraSubjectCount > 0 && (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-[#8ea79c]">+{extraSubjectCount} more</span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tap to mark attendance
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            batch.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-300'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: batch.isActive ? '#34d399' : '#f87171' }} />
          {batch.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </button>
  );
};

export default TeacherBatchAttendanceScreen;