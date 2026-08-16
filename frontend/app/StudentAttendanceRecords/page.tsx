/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react/no-unescaped-entities */
// StudentAttendanceRecordsScreen.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken, getStoredUserData, clearSession } from '../lib/auth';

// ---------------------------------------------------------------------------
// Same design tokens as UserReportsScreen — ink-green surfaces, emerald
// accent, amber for "needs attention", red for danger. Tailwind utilities
// throughout, arbitrary hex values to keep the exact palette without any
// tailwind.config changes.
// ---------------------------------------------------------------------------

interface UserData {
  id: string;
  email: string;
  name: string;
  token: string;
  role?: string;
}

interface BatchAssignment {
  batchId: string;
  batchName: string;
  category: string;
  assignedSubjects: Array<{
    subjectName: string;
    teacherId: string;
    teacherName: string;
  }>;
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'no_class';
  markedAt: string;
}

interface SubjectAttendanceStats {
  subjectName: string;
  batchId: string;
  batchName: string;
  teacherName: string;
  statistics: {
    present: number;
    absent: number;
    noClass: number;
    totalClasses: number;
    attendancePercentage: number;
  };
  recentAttendance: AttendanceRecord[];
}

interface AttendanceData {
  batches: BatchAssignment[];
  subjectAttendance: SubjectAttendanceStats[];
  overallStats: {
    totalClassesAcrossSubjects: number;
    totalPresentAcrossSubjects: number;
    overallAttendancePercentage: number;
    totalSubjects: number;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'present':
      return '#34d399';
    case 'absent':
      return '#f2685a';
    case 'no_class':
      return '#8ea79c';
    default:
      return '#8ea79c';
  }
};

const getPercentageColor = (percentage: number) => {
  if (percentage >= 75) return '#34d399';
  if (percentage >= 60) return '#f0b429';
  return '#f2685a';
};

const StudentAttendanceRecordsScreen: React.FC = () => {
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const checkAuthStatus = (): UserData | null => {
    const token = getToken();
    const stored = getStoredUserData();

    if (token && stored?.id && stored?.name) {
      const userDataObj: UserData = {
        id: stored.id,
        name: stored.name,
        email: stored.email || '',
        token,
      };
      setUserData(userDataObj);
      setIsLoggedIn(true);
      return userDataObj;
    }

    setIsLoggedIn(false);
    setUserData(null);
    return null;
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const currentUserData = checkAuthStatus();
      if (!currentUserData) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/students/attendance-records`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${currentUserData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          setAttendanceData(data.data);
        } else {
          console.error('Failed to fetch attendance data:', data.message);
        }
      } else if (response.status === 404) {
        setAttendanceData({
          batches: [],
          subjectAttendance: [],
          overallStats: {
            totalClassesAcrossSubjects: 0,
            totalPresentAcrossSubjects: 0,
            overallAttendancePercentage: 0,
            totalSubjects: 0,
          },
        });
      } else if (response.status === 401) {
        clearSession();
        setIsLoggedIn(false);
        setUserData(null);
      } else {
        console.error('Failed to fetch attendance data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendanceData();
    setRefreshing(false);
  };

  const toggleCardExpansion = (subjectKey: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  };

  const hasData = !!attendanceData && attendanceData.subjectAttendance.length > 0;

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-16 font-sans">
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="#eef4f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex flex-col leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">SUJHAV</span>
              <h1 className="mt-0.5 font-serif text-xl font-semibold text-[#eef4f1]">Attendance records</h1>
            </div>
          </div>
          {isLoggedIn && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
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
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading attendance records&hellip;</p>
          </div>
        ) : isLoggedIn === false ? (
          <HeroPanel mounted={mounted}>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[#eef4f1]">Sign in required</h2>
            <p className="mb-2 text-[15px] leading-relaxed text-[#eef4f1]">Sign in to view your attendance records.</p>
            <p className="mb-7 text-[13.5px] leading-relaxed text-[#8ea79c]">Track your presence across every subject you're enrolled in.</p>
            <div className="flex w-full flex-col gap-3">
              <button
                className="w-full rounded-[10px] bg-emerald-400 px-8 py-3.5 text-[15px] font-bold text-[#06140f] transition-all hover:brightness-110"
                onClick={() => router.push('/SignInScreen')}
              >
                Sign in
              </button>
            </div>
          </HeroPanel>
        ) : hasData ? (
          <div className="pt-1">
            <OverallStatsStrip statistics={attendanceData!.overallStats} mounted={mounted} />

            <section
              className={`transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
            >
              <h2 className="mb-3.5 font-serif text-lg font-semibold text-[#eef4f1]">Subject-wise attendance</h2>

              <div className="flex flex-col gap-3">
                {attendanceData!.subjectAttendance.map((item) => {
                  const subjectKey = `${item.batchId}_${item.subjectName}`;
                  return (
                    <SubjectRow
                      key={subjectKey}
                      item={item}
                      expanded={expandedCards.has(subjectKey)}
                      onToggle={() => toggleCardExpansion(subjectKey)}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17]">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="#8ea79c" strokeWidth="1.6" />
                <path d="M3 9h18M8 3v4M16 3v4" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M9 14l2 2 4-4" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-bold text-[#eef4f1]">No attendance records</p>
            <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
              You are not currently assigned to any batch, or no attendance has been marked yet.
            </p>
            <button
              className="mt-6 flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-[#06140f] transition-all hover:brightness-110"
              onClick={onRefresh}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0011.9 3.1M19 9a7 7 0 00-11.9-3.1"
                  stroke="#06140f"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Refresh
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const HeroPanel: React.FC<{ mounted: boolean; children: React.ReactNode }> = ({ mounted, children }) => (
  <div
    className={`mx-auto my-16 flex max-w-[460px] flex-col items-center rounded-[18px] border border-white/[0.08] bg-[#101d17] px-9 py-12 text-center transition-all duration-500 ${
      mounted ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
    }`}
  >
    {children}
  </div>
);

const OverallStatsStrip: React.FC<{ statistics: AttendanceData['overallStats']; mounted: boolean }> = ({ statistics, mounted }) => {
  const pct = statistics.overallAttendancePercentage || 0;
  const items = [
    { value: String(statistics.totalSubjects), label: 'Subjects' },
    { value: String(statistics.totalClassesAcrossSubjects), label: 'Total classes' },
    { value: String(statistics.totalPresentAcrossSubjects), label: 'Present' },
    { value: `${pct.toFixed(1)}%`, label: 'Attendance', color: getPercentageColor(pct) },
  ];

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-x-0 gap-y-4 overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#101d17] px-5.5 py-4.5 transition-all duration-500 sm:flex-nowrap ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <div className="flex min-w-[42%] flex-1 flex-col items-start sm:min-w-[140px]">
            <span className="font-mono text-2xl font-semibold leading-tight" style={{ color: item.color || '#eef4f1' }}>
              {item.value}
            </span>
            <span className="mt-0.5 text-[12.5px] text-[#8ea79c]">{item.label}</span>
          </div>
          {i < items.length - 1 && <div className="mx-4.5 hidden self-stretch border-l border-white/[0.08] sm:block" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const SubjectRow: React.FC<{
  item: SubjectAttendanceStats;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  const pctColor = getPercentageColor(item.statistics.attendancePercentage);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17]">
      <button className="flex w-full items-center gap-4 px-4.5 py-4 text-left" onClick={onToggle} aria-expanded={expanded}>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[#eef4f1]">{item.subjectName}</p>
          <p className="mt-0.5 text-[12.5px] text-[#8ea79c]">{item.batchName}</p>
          <p className="text-[12.5px] text-[#8ea79c]">Teacher: {item.teacherName}</p>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          <span className="font-mono text-lg font-semibold" style={{ color: pctColor }}>
            {item.statistics.attendancePercentage.toFixed(1)}%
          </span>
          <span className="text-xs text-[#8ea79c]">
            {item.statistics.present}/{item.statistics.totalClasses}
          </span>
        </div>

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.08] px-4.5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            <StatDetail label="Present" value={item.statistics.present} color="#34d399" icon="check" />
            <StatDetail label="Absent" value={item.statistics.absent} color="#f2685a" icon="cross" />
            <StatDetail label="No class" value={item.statistics.noClass} color="#8ea79c" icon="dash" />
            <StatDetail label="Total" value={item.statistics.totalClasses} color="#34d399" icon="book" />
          </div>

          {item.recentAttendance.length > 0 && (
            <div>
              <p className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-[#8ea79c]">Recent attendance</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {item.recentAttendance.slice(0, 10).map((record, idx) => (
                  <div key={idx} className="flex flex-shrink-0 flex-col items-center gap-1.5">
                    <span className="text-[11px] text-[#8ea79c]">
                      {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-[#06140f]"
                      style={{ background: getStatusColor(record.status) }}
                    >
                      {record.status === 'present' ? 'P' : record.status === 'absent' ? 'A' : 'NC'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatDetail: React.FC<{ label: string; value: number; color: string; icon: 'check' | 'cross' | 'dash' | 'book' }> = ({
  label,
  value,
  color,
  icon,
}) => (
  <div className="flex items-center gap-2">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: color }}>
      {icon === 'check' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {icon === 'cross' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {icon === 'dash' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'book' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 014 18.5V5.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    <span className="text-[13px] text-[#eef4f1]">
      {label}: <span className="font-mono font-semibold">{value}</span>
    </span>
  </div>
);

export default StudentAttendanceRecordsScreen;