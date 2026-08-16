/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherBatchDetailsScreen.tsx (Expo). Same backend
// contract (`GET /batches/teacher/batch/:batchId`), same dark SUJHAV design
// language as TeacherDashboardScreen.tsx: bg #0a120f, cards #101d17, hairline
// white/[0.08] borders, emerald-400 accent, font-serif headings, font-mono
// for numerals. The mobile app's bottom-tab layout is rebuilt here as a
// proper desktop-first page: a summary header with stat tiles, a pill tab
// bar, and content that reflows into multi-column grids above mobile widths.
// ---------------------------------------------------------------------------

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface StudentAssignment {
  student: Student;
  assignedClasses: string[];
  assignedSubjects: { subjectName: string; teacher?: string }[];
  enrolledAt: string;
  _id: string;
}

interface Subject {
  _id: string;
  name: string;
  teacher?: { _id: string; name: string; email: string };
}

interface Center {
  _id: string;
  centerName: string;
}

interface Batch {
  _id: string;
  batchName: string;
  center: Center;
  classes: string[];
  category: string;
  studentAssignments: StudentAssignment[];
  subjects: Subject[];
  createdBy: { _id: string; name: string; email: string };
  schedule?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BatchResponse {
  success: boolean;
  data: Batch;
  message: string;
}

type Tab = 'students' | 'details' | 'reports';
type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const REPORT_ACTIONS = (batchId: string) => [
  {
    id: 'manage_tests',
    title: 'Create & manage tests',
    description: 'Create new tests, edit existing ones, and manage test schedules',
    color: '#34d399',
    href: `/TeacherHandleTestScreen?batchId=${batchId}`,
    icon: (
      <path
        d="M9 12h6M9 16h6M9 8h1M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: 'view_reports',
    title: 'View test reports',
    description: 'Analyze student performance and generate detailed reports',
    color: '#38bdf8',
    href: `/TeacherHandleReportsScreen?batchId=${batchId}`,
    icon: <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'score_tests',
    title: 'Score students’ tests',
    description: 'Grade students for the tests you have created and assigned',
    color: '#a78bfa',
    href: `/TeacherTestListScreen?batchId=${batchId}`,
    icon: (
      <path
        d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const TABS: { id: Tab; label: string }[] = [
  { id: 'students', label: 'Students' },
  { id: 'details', label: 'Details' },
  { id: 'reports', label: 'Tests & reports' },
];

const TeacherBatchDetailsScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('students');
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchBatchDetails = async (silent = false) => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    if (!batchId) {
      setNotice({ type: 'error', title: 'Missing batch', message: 'No batch was specified.' });
      setIsLoading(false);
      return;
    }

    try {
      if (!silent) setIsLoading(true);
      const response = await fetch(`${API_BASE}/batches/teacher/batch/${batchId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data: BatchResponse = await response.json();

      if (data.success) {
        setBatch(data.data);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch batch details' });
      }
    } catch (error) {
      console.error('Error fetching batch details:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBatchDetails(true);
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a120f]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading batch details&hellip;</p>
      </div>
    );
  }

  const studentCount = batch?.studentAssignments.length ?? 0;
  const subjectCount = batch?.subjects.length ?? 0;
  const classCount = batch?.classes.length ?? 0;

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
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Batch</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
              {batch?.batchName || 'Batch details'}
            </h1>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh batch"
            className="ml-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <svg className={refreshing ? 'animate-spin' : ''} width="17" height="17" viewBox="0 0 24 24" fill="none">
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
        {/* summary header */}
        <section
          className={`mb-7 rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-6 transition-all duration-500 delay-75 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                  {batch?.category}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    batch?.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-300'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: batch?.isActive ? '#34d399' : '#f87171' }} />
                  {batch?.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {batch?.center?.centerName && (
                <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-[#8ea79c]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="9" r="2.5" stroke="#8ea79c" strokeWidth="1.6" />
                  </svg>
                  {batch.center.centerName}
                  {batch?.schedule && <span className="text-[#4c6459]">&middot; {batch.schedule}</span>}
                </p>
              )}
              {batch?.description && <p className="mt-3 max-w-[520px] text-[13.5px] leading-relaxed text-[#c7d6cf]">{batch.description}</p>}
            </div>

            <div className="grid flex-shrink-0 grid-cols-3 gap-3">
              <StatTile label="Students" value={studentCount} />
              <StatTile label="Subjects" value={subjectCount} />
              <StatTile label="Classes" value={classCount} />
            </div>
          </div>
        </section>

        {/* tab bar */}
        <div
          className={`mb-6 inline-flex rounded-xl border border-white/[0.08] bg-[#101d17] p-1 transition-all duration-500 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-emerald-400 text-[#0a120f]' : 'text-[#8ea79c] hover:text-[#eef4f1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* content */}
        <section className={`transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {activeTab === 'students' && <StudentsTab batch={batch} />}
          {activeTab === 'details' && <DetailsTab batch={batch} />}
          {activeTab === 'reports' && batchId && <ReportsTab batchId={batchId} router={router} />}
        </section>
      </main>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex min-w-[84px] flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
    <span className="font-mono text-xl font-bold text-emerald-400">{value}</span>
    <span className="mt-0.5 text-[11px] text-[#8ea79c]">{label}</span>
  </div>
);

const StudentsTab: React.FC<{ batch: Batch | null }> = ({ batch }) => {
  const assignments = batch?.studentAssignments ?? [];

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            stroke="#8ea79c"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No students yet</p>
        <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
          This batch doesn&rsquo;t have any students enrolled yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {assignments.map((item) => (
        <div
          key={item._id}
          className="flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-[#101d17] p-4.5 transition-colors hover:border-emerald-400/30"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
                stroke="#34d399"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#eef4f1]">{item.student.name}</p>
            <p className="truncate text-[13px] text-[#8ea79c]">{item.student.email}</p>
            <p className="mt-1.5 text-[11.5px] text-[#4c6459]">Joined {new Date(item.enrolledAt).toLocaleDateString()}</p>
            {item.assignedClasses.length > 0 && (
              <p className="mt-2 truncate text-[12px] text-[#8ea79c]">
                <span className="text-[#4c6459]">Classes:</span> {item.assignedClasses.join(', ')}
              </p>
            )}
            {item.assignedSubjects.length > 0 && (
              <p className="mt-1 truncate text-[12px] text-[#8ea79c]">
                <span className="text-[#4c6459]">Subjects:</span> {item.assignedSubjects.map((s) => s.subjectName).join(', ')}
              </p>
            )}
          </div>
          <button
            aria-label={`Message ${item.student.name}`}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 transition-colors hover:bg-emerald-400/20"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

const DetailsTab: React.FC<{ batch: Batch | null }> = ({ batch }) => (
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
      <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Batch information</h2>
      <dl className="mt-4 flex flex-col gap-3">
        <DetailRow label="Batch name" value={batch?.batchName} />
        <DetailRow label="Center" value={batch?.center?.centerName || 'N/A'} />
        <DetailRow label="Category" value={batch?.category} />
        <DetailRow label="Classes" value={batch?.classes.join(', ') || 'N/A'} />
        <DetailRow
          label="Status"
          value={batch?.isActive ? 'Active' : 'Inactive'}
          valueClassName={batch?.isActive ? 'text-emerald-400' : 'text-red-300'}
        />
        {batch?.schedule && <DetailRow label="Schedule" value={batch.schedule} />}
      </dl>
    </div>

    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
      <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Your subjects</h2>
      {batch?.subjects && batch.subjects.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-white/[0.06]">
          {batch.subjects.map((subject, index) => (
            <li key={subject._id || index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                    stroke="#34d399"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-[#eef4f1]">{subject.name}</p>
                {subject.teacher && <p className="truncate text-[12.5px] text-[#8ea79c]">Teacher: {subject.teacher.name}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 py-6 text-center text-[13.5px] italic text-[#8ea79c]">No subjects assigned</p>
      )}
    </div>

    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
      <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Created by</h2>
      <div className="mt-4 flex items-center gap-3.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
              stroke="#34d399"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[#eef4f1]">{batch?.createdBy.name}</p>
          <p className="truncate text-[13px] text-[#8ea79c]">{batch?.createdBy.email}</p>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
      <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Timeline</h2>
      <dl className="mt-4 flex flex-col gap-3">
        <DetailRow label="Created" value={batch ? new Date(batch.createdAt).toLocaleDateString() : ''} />
        <DetailRow label="Last updated" value={batch ? new Date(batch.updatedAt).toLocaleDateString() : ''} />
      </dl>
    </div>
  </div>
);

const DetailRow: React.FC<{ label: string; value?: string; valueClassName?: string }> = ({ label, value, valueClassName }) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
    <dt className="text-[13px] font-medium text-[#8ea79c]">{label}</dt>
    <dd className={`text-right text-[13.5px] font-semibold text-[#eef4f1] ${valueClassName || ''}`}>{value}</dd>
  </div>
);

const ReportsTab: React.FC<{ batchId: string; router: ReturnType<typeof useRouter> }> = ({ batchId, router }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
    {REPORT_ACTIONS(batchId).map((action) => (
      <button
        key={action.id}
        onClick={() => router.push(action.href)}
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
    ))}
  </div>
);

export default TeacherBatchDetailsScreen;