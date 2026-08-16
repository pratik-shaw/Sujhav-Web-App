/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherBatchCalendarScreen.tsx (Expo). Same
// backend contract (`GET /batches/teacher/my-batches`), same dark SUJHAV
// design language, same center-filter-tabs pattern as TeacherDashboardScreen.
// This screen is a batch picker: selecting a batch routes to
// TeacherHandleCalendarEventsScreen to manage that batch's events.
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
  teachers: Array<{ _id: string; name: string; email: string }>;
  createdBy: { _id: string; name: string; email: string };
  schedule?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const TeacherBatchCalendarScreen: React.FC = () => {
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
    } catch (error) {
      console.error('Error fetching teacher batches:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherBatches();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeacherBatches();
    setRefreshing(false);
  };

  const handleBatchPress = (batch: Batch) => {
    router.push(`/TeacherHandleCalendarEventsScreen?batchId=${batch._id}&batchName=${encodeURIComponent(batch.batchName)}`);
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
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-emerald-400 transition-colors hover:border-emerald-400/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 leading-tight">
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">SUJHAV</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Calendar management</h1>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh batches"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-emerald-400 transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <svg className={isLoading || refreshing ? 'animate-spin' : ''} width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0011.9 3.1M19 9a7 7 0 00-11.9-3.1"
                stroke="currentColor"
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
        <div className={`mb-6 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Select batch</h2>
          <p className="mt-1 text-[13px] text-[#8ea79c]">
            Choose a batch to manage its calendar events &middot; {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
            {selectedCenterId !== ALL_CENTERS_ID ? ' in this center' : ' available'}
          </p>
        </div>

        {/* center filter tabs */}
        {centersInBatches.length > 0 && (
          <div className={`mb-6 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <div className="mb-2.5 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.5" stroke="#34d399" strokeWidth="1.8" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Filter by center</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-6">
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

        <div className={`transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {isLoading && !refreshing ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
              <p className="mt-3.5 text-sm text-[#8ea79c]">Loading your batches&hellip;</p>
            </div>
          ) : filteredBatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredBatches.map((batch) => (
                <BatchCard key={batch._id} batch={batch} onOpen={() => handleBatchPress(batch)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <path d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z M9 14l6-6" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No batches available</p>
              <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                {selectedCenterId === ALL_CENTERS_ID
                  ? "You haven't been assigned to any batches yet. Contact your administrator for batch assignments."
                  : 'No batches found for this center.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const BatchCard: React.FC<{ batch: Batch; onOpen: () => void }> = ({ batch, onOpen }) => (
  <button
    onClick={onOpen}
    className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
  >
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="#34d399" strokeWidth="1.8" />
          <path d="M4 9h16M8 3v3M16 3v3" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
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
        {batch.students.length} students
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
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="#34d399" strokeWidth="1.6" />
          <path d="M4 9h16M8 3v3M16 3v3M9 14l2 2 4-4" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Manage calendar events
      </span>
      <span className="text-[11.5px] font-semibold" style={{ color: batch.isActive ? '#34d399' : '#f87171' }}>
        {batch.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
  </button>
);

export default TeacherBatchCalendarScreen;