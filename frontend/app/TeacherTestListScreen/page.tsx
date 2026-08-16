/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherTestListScreen.tsx (Expo). Same backend
// contracts (`GET /tests/batch/:batchId/subject/:subjectName`,
// `GET /tests/teacher/my-tests`), same dark SUJHAV design language as the
// rest of the web dashboard: bg #0a120f, cards #101d17, hairline
// white/[0.08] borders, emerald-400 accent, font-serif headings, font-mono
// for numerals. Expects `?batchId=...&subjectName=...` (subjectName
// optional) query params. Responsive: single column on mobile, multi-column
// card grid on tablet/desktop.
// ---------------------------------------------------------------------------

interface Test {
  _id: string;
  testTitle: string;
  fullMarks: number;
  instructions: string;
  dueDate: string | null;
  isActive: boolean;
  className: string;
  subjectName: string;
  batch: { _id: string; batchName: string; category: string };
  assignedStudents: Array<{
    student: { _id: string; name: string; email: string };
    marksScored: number | null;
    submittedAt: string | null;
    evaluatedAt: string | null;
  }>;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  hasQuestionPdf?: boolean;
  hasAnswerPdf?: boolean;
}

interface TestListResponse {
  success: boolean;
  data: Test[];
  message: string;
  count: number;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

function getTestStats(test: Test) {
  const totalStudents = test.assignedStudents.length;
  const submittedStudents = test.assignedStudents.filter((s) => s.submittedAt);
  const submittedCount = submittedStudents.length;
  const evaluatedCount = submittedStudents.filter((s) => s.evaluatedAt).length;
  const pendingCount = Math.max(0, submittedCount - evaluatedCount);

  return { totalStudents, submittedCount, evaluatedCount, pendingCount };
}

const TeacherTestListScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') || '';
  const subjectNameParam = searchParams.get('subjectName') || '';

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [batchName, setBatchName] = useState('');
  const [currentSubject, setCurrentSubject] = useState(subjectNameParam);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!batchId) return;
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, subjectNameParam]);

  const fetchTests = async () => {
    setIsLoading(true);
    const token = getToken();

    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      router.push('/SignInScreen');
      setIsLoading(false);
      return;
    }

    try {
      const hasSubject = subjectNameParam && subjectNameParam !== 'undefined';
      const url = hasSubject
        ? `${API_BASE}/tests/batch/${batchId}/subject/${encodeURIComponent(subjectNameParam)}`
        : `${API_BASE}/tests/teacher/my-tests`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.indexOf('application/json') !== -1) {
        const data: TestListResponse = await response.json();

        if (data.success) {
          let filteredTests = data.data;
          if (!hasSubject && batchId) {
            filteredTests = data.data.filter((test) => test.batch._id === batchId);
          }

          setTests(filteredTests);
          if (filteredTests.length > 0) {
            setBatchName(filteredTests[0].batch.batchName);
            if (!currentSubject && hasSubject) {
              setCurrentSubject(filteredTests[0].subjectName);
            }
          }
        } else {
          setNotice({ type: 'error', title: 'Couldn\u2019t load tests', message: data.message || 'Failed to fetch tests' });
        }
      } else {
        const errorText = await response.text();
        console.error('Error fetching tests: Server returned non-JSON response', errorText);
        setNotice({ type: 'error', title: 'Unexpected error', message: 'Please try again later.' });
      }
    } catch (err) {
      console.error('Error fetching tests:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTests();
    setRefreshing(false);
  };

  const handleTestPress = (test: Test) => {
    router.push(`/TeacherHandleScoresScreen?testId=${test._id}&testTitle=${encodeURIComponent(test.testTitle)}&fullMarks=${test.fullMarks}`);
  };

  const handleCreateTest = () => {
    router.push(`/TeacherHandleTestScreen?batchId=${batchId}`);
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
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-4">
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
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Test scores</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
              {batchName || 'Batch'}
              {currentSubject && currentSubject !== 'undefined' ? ` \u2022 ${currentSubject}` : ''}
            </h1>
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button
              onClick={handleCreateTest}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#04140d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Create test</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh tests"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading tests&hellip;</p>
          </div>
        ) : tests.length === 0 ? (
          <div
            className={`flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center transition-all duration-500 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                stroke="#8ea79c"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">No tests found</p>
            <p className="mt-2 max-w-[380px] text-[13.5px] leading-relaxed text-[#8ea79c]">
              {currentSubject && currentSubject !== 'undefined'
                ? `No tests have been created for ${currentSubject} in this batch yet.`
                : 'No tests have been created for this batch yet.'}
            </p>
            <button
              onClick={handleCreateTest}
              className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#04140d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Create test
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-5 transition-all duration-500 md:grid-cols-2 xl:grid-cols-3 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            {tests.map((test) => (
              <TestCard key={test._id} test={test} onOpen={() => handleTestPress(test)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const TestCard: React.FC<{ test: Test; onOpen: () => void }> = ({ test, onOpen }) => {
  const stats = getTestStats(test);
  const isOverdue = test.dueDate ? new Date(test.dueDate) < new Date() : false;
  const hasEvaluatedStudents = test.assignedStudents.some((s) => s.evaluatedAt || s.marksScored !== null);
  const showOverdueAlert = isOverdue && !hasEvaluatedStudents;
  const showDueDate = Boolean(test.dueDate);

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="line-clamp-2 flex-1 text-[16px] font-bold text-[#eef4f1]">{test.testTitle}</p>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-1 flex-shrink-0">
          <path d="M9 18l6-6-6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge>{test.fullMarks} marks</Badge>
        <Badge>Class: {test.className}</Badge>
        <Badge>{test.subjectName}</Badge>
        <Badge color={test.isActive ? '#34d399' : '#f87171'}>{test.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>

      {showDueDate && (
        <div className="mb-3 flex items-start gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="9" stroke={showOverdueAlert ? '#f87171' : '#8ea79c'} strokeWidth="1.6" />
            <path d="M12 7v5l3 3" stroke={showOverdueAlert ? '#f87171' : '#8ea79c'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={`text-[12px] leading-snug ${showOverdueAlert ? 'text-red-400' : 'text-[#8ea79c]'}`}>
            Due: {new Date(test.dueDate as string).toLocaleDateString()} at {new Date(test.dueDate as string).toLocaleTimeString()}
            {showOverdueAlert ? ' (Overdue)' : ''}
          </p>
        </div>
      )}

      {(test.hasQuestionPdf || test.hasAnswerPdf) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {test.hasQuestionPdf && (
            <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] text-[#8ea79c]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                  stroke="#34d399"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Question PDF
            </span>
          )}
          {test.hasAnswerPdf && (
            <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] text-[#8ea79c]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                  stroke="#fb923c"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Answer PDF
            </span>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-4 gap-2 rounded-xl bg-black/25 py-3">
        <StatCell value={stats.totalStudents} label="Total" color="#eef4f1" />
        <StatCell value={stats.submittedCount} label="Submitted" color="#fbbf24" />
        <StatCell value={stats.evaluatedCount} label="Evaluated" color="#34d399" />
        <StatCell value={stats.pendingCount} label="Pending" color="#f87171" />
      </div>

      {stats.pendingCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border-l-2 border-amber-400 bg-amber-400/10 p-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
            <path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01"
              stroke="#fbbf24"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-[11.5px] font-semibold leading-snug text-amber-300">
            {stats.pendingCount} submission{stats.pendingCount > 1 ? 's' : ''} pending evaluation
          </p>
        </div>
      )}
    </button>
  );
};

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <span
    className="rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] font-semibold"
    style={{ color: color || '#8ea79c' }}
  >
    {children}
  </span>
);

const StatCell: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <div className="text-center">
    <p className="font-mono text-[16px] font-bold" style={{ color }}>
      {value}
    </p>
    <p className="mt-0.5 text-[10.5px] text-[#8ea79c]">{label}</p>
  </div>
);

export default TeacherTestListScreen;