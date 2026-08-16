/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherHandleReportsScreen.tsx (Expo). Same
// backend contracts (`GET /tests/teacher/batch/:batchId/subject/:subjectName`,
// `PUT /tests/teacher/:testId/marks`), same dark SUJHAV design language as
// the rest of the web dashboard: bg #0a120f, cards #101d17, hairline
// white/[0.08] borders, emerald-400 accent, font-serif headings, font-mono
// for numerals. Expects `?batchId=...&subjectName=...` query params.
// Native Alert.prompt from the app is replaced with an in-design "edit
// marks" modal. Fully responsive: single column on mobile, multi-column
// grids on tablet/desktop.
// ---------------------------------------------------------------------------

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface StudentAssignment {
  _id?: string;
  student: Student;
  marksScored: number | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface Test {
  _id: string;
  testTitle: string;
  fullMarks: number;
  assignedStudents: StudentAssignment[];
  createdAt: string;
  dueDate: string | null;
  instructions: string;
  isActive: boolean;
  className: string;
  subjectName: string;
  batch: { _id: string; batchName: string; category: string };
  createdBy: { _id: string; name: string; email: string };
  hasQuestionPdf?: boolean;
  hasAnswerPdf?: boolean;
}

interface StudentReport {
  studentId: string;
  studentName: string;
  studentEmail: string;
  tests: Array<{
    testId: string;
    testTitle: string;
    fullMarks: number;
    marksScored: number | null;
    percentage: number | null;
    submittedAt: string | null;
    evaluatedAt: string | null;
    createdAt: string;
  }>;
  totalTests: number;
  evaluatedTests: number;
  averagePercentage: number;
  totalMarksScored: number;
  totalFullMarks: number;
}

interface BatchAnalytics {
  totalTests: number;
  totalStudents: number;
  overallAveragePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalSubmissions: number;
  pendingEvaluations: number;
}

type Tab = 'analytics' | 'students' | 'tests';
type SortBy = 'name' | 'percentage' | 'tests';
type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const EMPTY_ANALYTICS: BatchAnalytics = {
  totalTests: 0,
  totalStudents: 0,
  overallAveragePercentage: 0,
  highestScore: 0,
  lowestScore: 0,
  totalSubmissions: 0,
  pendingEvaluations: 0,
};

function getPerformanceColor(pct: number) {
  if (pct >= 80) return '#34d399';
  if (pct >= 60) return '#fbbf24';
  return '#f87171';
}

function getPerformanceLabel(pct: number) {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  return 'Needs improvement';
}

const TeacherHandleReportsScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') || '';
  const subjectName = searchParams.get('subjectName') || '';

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [batchAnalytics, setBatchAnalytics] = useState<BatchAnalytics>(EMPTY_ANALYTICS);
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [selectedStudent, setSelectedStudent] = useState<StudentReport | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [notice, setNotice] = useState<Notice>(null);

  const [editTarget, setEditTarget] = useState<{ testId: string; testTitle: string; fullMarks: number; current: number | null } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingMarks, setSavingMarks] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!batchId || !subjectName) return;
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, subjectName]);

  const processStudentReports = (testsData: Test[]) => {
    const map = new Map<string, StudentReport>();

    testsData.forEach((test) => {
      if (!test.assignedStudents || !Array.isArray(test.assignedStudents)) return;

      test.assignedStudents.forEach((assignment) => {
        if (!assignment.student?._id) return;
        const studentId = assignment.student._id;

        if (!map.has(studentId)) {
          map.set(studentId, {
            studentId,
            studentName: assignment.student.name || 'Unknown student',
            studentEmail: assignment.student.email || '',
            tests: [],
            totalTests: 0,
            evaluatedTests: 0,
            averagePercentage: 0,
            totalMarksScored: 0,
            totalFullMarks: 0,
          });
        }

        const report = map.get(studentId)!;
        const percentage =
          assignment.marksScored !== null && assignment.marksScored !== undefined
            ? (assignment.marksScored / test.fullMarks) * 100
            : null;

        report.tests.push({
          testId: test._id,
          testTitle: test.testTitle,
          fullMarks: test.fullMarks,
          marksScored: assignment.marksScored,
          percentage,
          submittedAt: assignment.submittedAt,
          evaluatedAt: assignment.evaluatedAt,
          createdAt: test.createdAt,
        });

        report.totalTests += 1;
        report.totalFullMarks += test.fullMarks;

        if (assignment.marksScored !== null && assignment.marksScored !== undefined) {
          report.evaluatedTests += 1;
          report.totalMarksScored += assignment.marksScored;
        }
      });
    });

    const reports = Array.from(map.values()).map((r) => ({
      ...r,
      averagePercentage: r.totalFullMarks > 0 ? (r.totalMarksScored / r.totalFullMarks) * 100 : 0,
    }));

    setStudentReports(reports);
  };

  const calculateBatchAnalytics = (testsData: Test[]) => {
    if (!testsData.length) {
      setBatchAnalytics(EMPTY_ANALYTICS);
      return;
    }

    let totalSubmissions = 0;
    let pendingEvaluations = 0;
    const allPercentages: number[] = [];
    const uniqueStudents = new Set<string>();

    testsData.forEach((test) => {
      if (!test.assignedStudents) return;
      test.assignedStudents.forEach((assignment) => {
        if (!assignment.student?._id) return;
        uniqueStudents.add(assignment.student._id);
        if (assignment.submittedAt) totalSubmissions += 1;
        if (assignment.submittedAt && !assignment.evaluatedAt) pendingEvaluations += 1;
        if (assignment.marksScored !== null && assignment.marksScored !== undefined) {
          allPercentages.push((assignment.marksScored / test.fullMarks) * 100);
        }
      });
    });

    setBatchAnalytics({
      totalTests: testsData.length,
      totalStudents: uniqueStudents.size,
      overallAveragePercentage: allPercentages.length ? allPercentages.reduce((s, p) => s + p, 0) / allPercentages.length : 0,
      highestScore: allPercentages.length ? Math.max(...allPercentages) : 0,
      lowestScore: allPercentages.length ? Math.min(...allPercentages) : 0,
      totalSubmissions,
      pendingEvaluations,
    });
  };

  const fetchBatchTests = async () => {
    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      router.push('/SignInScreen');
      return;
    }

    try {
      const endpoint = `${API_BASE}/tests/teacher/batch/${batchId}/subject/${encodeURIComponent(subjectName)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const testsData: Test[] = data.data || [];
        setTests(testsData);
        processStudentReports(testsData);
        calculateBatchAnalytics(testsData);
      } else {
        setNotice({ type: 'error', title: 'Couldn\u2019t load reports', message: data.message || `HTTP ${response.status}: Failed to fetch batch tests` });
      }
    } catch (err) {
      console.error('Error fetching batch tests:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Please check your connection and try again.' });
    }
  };

  const loadReportData = async () => {
    setIsLoading(true);
    await fetchBatchTests();
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const filteredStudents = useMemo(() => {
    let filtered = studentReports;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.studentName.toLowerCase().includes(q) || s.studentEmail.toLowerCase().includes(q));
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.studentName.localeCompare(b.studentName);
        case 'percentage':
          return b.averagePercentage - a.averagePercentage;
        case 'tests':
          return b.evaluatedTests - a.evaluatedTests;
        default:
          return 0;
      }
    });
  }, [studentReports, searchQuery, sortBy]);

  const openStudent = (student: StudentReport) => {
    setSelectedStudent(student);
    setShowStudentModal(true);
  };

  const openEditMarks = (testId: string, testTitle: string, fullMarks: number, current: number | null) => {
    setEditTarget({ testId, testTitle, fullMarks, current });
    setEditValue(current !== null ? String(current) : '');
  };

  const submitEditMarks = async () => {
    if (!editTarget || !selectedStudent) return;

    const marks = parseFloat(editValue);
    if (Number.isNaN(marks) || marks < 0 || marks > editTarget.fullMarks) {
      setNotice({ type: 'error', title: 'Invalid marks', message: `Marks must be between 0 and ${editTarget.fullMarks}.` });
      return;
    }

    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      return;
    }

    setSavingMarks(true);
    try {
      const response = await fetch(`${API_BASE}/tests/teacher/${editTarget.testId}/marks`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.studentId, marksScored: marks }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setNotice({ type: 'success', title: 'Marks updated', message: `${selectedStudent.studentName}\u2019s marks were saved.` });
        setEditTarget(null);
        await loadReportData();
      } else {
        setNotice({ type: 'error', title: 'Update failed', message: data.message || `HTTP ${response.status}: Failed to update marks` });
      }
    } catch (err) {
      console.error('Error updating marks:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Marks were not saved. Please try again.' });
    } finally {
      setSavingMarks(false);
    }
  };

  // keep the open student modal in sync with freshly-fetched data
  useEffect(() => {
    if (!selectedStudent) return;
    const updated = studentReports.find((s) => s.studentId === selectedStudent.studentId);
    if (updated) setSelectedStudent(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentReports]);

  const goToScores = (test: { _id: string; testTitle: string; fullMarks: number }) => {
    router.push(`/TeacherHandleScoresScreen?testId=${test._id}&testTitle=${encodeURIComponent(test.testTitle)}&fullMarks=${test.fullMarks}`);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    },
    {
      id: 'students',
      label: 'Students',
      icon: (
        <path
          d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
    {
      id: 'tests',
      label: 'Tests',
      icon: (
        <path
          d="M9 12h6M9 16h6M9 8h1 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
  ];

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
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Batch reports</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">{subjectName || 'Subject'}</h1>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh reports"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
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
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* tabs */}
        <div className="mx-auto max-w-[1180px] px-6 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                    isActive ? 'bg-emerald-400 text-[#04140d]' : 'bg-[#101d17] text-[#8ea79c] hover:text-[#eef4f1]'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#04140d' : '#8ea79c'}>
                    {tab.icon}
                  </svg>
                  {tab.label}
                </button>
              );
            })}
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
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading reports&hellip;</p>
          </div>
        ) : (
          <>
            {activeTab === 'analytics' && (
              <AnalyticsTab analytics={batchAnalytics} tests={tests} mounted={mounted} onOpenTest={goToScores} />
            )}
            {activeTab === 'students' && (
              <StudentsTab
                students={filteredStudents}
                total={studentReports.length}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onOpenStudent={openStudent}
                mounted={mounted}
              />
            )}
            {activeTab === 'tests' && <TestsTab tests={tests} onOpenTest={goToScores} mounted={mounted} />}
          </>
        )}
      </main>

      {/* student detail modal */}
      {showStudentModal && selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-6"
          onClick={() => setShowStudentModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-white/[0.08] bg-[#0a120f] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4.5">
              <div className="min-w-0">
                <p className="truncate font-serif text-lg font-semibold text-[#eef4f1]">{selectedStudent.studentName}</p>
                <p className="truncate text-[12.5px] text-[#8ea79c]">{selectedStudent.studentEmail}</p>
              </div>
              <button
                onClick={() => setShowStudentModal(false)}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-6 grid grid-cols-3 gap-3">
                <DetailStat label="Tests" value={String(selectedStudent.totalTests)} />
                <DetailStat label="Evaluated" value={String(selectedStudent.evaluatedTests)} />
                <DetailStat
                  label="Average"
                  value={`${selectedStudent.averagePercentage.toFixed(1)}%`}
                  color={getPerformanceColor(selectedStudent.averagePercentage)}
                />
              </div>

              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-emerald-400">Test history</p>
              <div className="flex flex-col gap-3">
                {selectedStudent.tests.map((test) => (
                  <button
                    key={test.testId}
                    onClick={() => openEditMarks(test.testId, test.testTitle, test.fullMarks, test.marksScored)}
                    className="rounded-xl border border-emerald-400/[0.12] bg-[#101d17] p-4 text-left transition-colors hover:border-emerald-400/30"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-bold text-[#eef4f1]">{test.testTitle}</p>
                      <p className="flex-shrink-0 text-[11.5px] text-[#8ea79c]">{new Date(test.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-semibold text-[#eef4f1]">
                        {test.marksScored !== null ? `${test.marksScored}/${test.fullMarks}` : 'Not evaluated'}
                      </p>
                      {test.percentage !== null && (
                        <p className="font-mono text-[14px] font-bold" style={{ color: getPerformanceColor(test.percentage) }}>
                          {test.percentage.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-[11.5px] italic text-[#8ea79c]">Tap to edit marks</p>
                  </button>
                ))}

                {selectedStudent.tests.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-[#8ea79c]">No tests assigned yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* edit marks modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
          onClick={() => !savingMarks && setEditTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 shadow-2xl"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Update marks</p>
            <h3 className="mt-1 font-serif text-lg font-semibold text-[#eef4f1]">{selectedStudent?.studentName}</h3>
            <p className="mt-1 text-[13px] text-[#8ea79c]">
              {editTarget.testTitle} &middot; Max marks {editTarget.fullMarks}
            </p>

            <input
              type="number"
              min={0}
              max={editTarget.fullMarks}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              placeholder={`0 \u2013 ${editTarget.fullMarks}`}
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[15px] font-semibold text-[#eef4f1] outline-none transition-colors focus:border-emerald-400/40"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditTarget(null)}
                disabled={savingMarks}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={submitEditMarks}
                disabled={savingMarks}
                className="flex-1 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {savingMarks ? 'Saving\u2026' : 'Save marks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatBox: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-center">
    <p className="font-mono text-[26px] font-bold text-emerald-400">{value}</p>
    <p className="mt-1 text-[12.5px] text-[#8ea79c]">{label}</p>
  </div>
);

const DetailStat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="rounded-xl border border-white/[0.08] bg-[#101d17] p-4 text-center">
    <p className="font-mono text-[19px] font-bold" style={{ color: color || '#34d399' }}>
      {value}
    </p>
    <p className="mt-1 text-[11.5px] text-[#8ea79c]">{label}</p>
  </div>
);

const AnalyticsTab: React.FC<{
  analytics: BatchAnalytics;
  tests: Test[];
  mounted: boolean;
  onOpenTest: (t: { _id: string; testTitle: string; fullMarks: number }) => void;
}> = ({ analytics, tests, mounted, onOpenTest }) => (
  <div className={`flex flex-col gap-8 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
    <section>
      <h2 className="mb-4 font-serif text-lg font-semibold text-[#eef4f1]">Overall statistics</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox label="Tests" value={analytics.totalTests} />
        <StatBox label="Students" value={analytics.totalStudents} />
        <StatBox label="Submissions" value={analytics.totalSubmissions} />
        <StatBox label="Pending" value={analytics.pendingEvaluations} />
      </div>
    </section>

    <section>
      <h2 className="mb-4 font-serif text-lg font-semibold text-[#eef4f1]">Performance overview</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-center">
          <p className="text-[12px] text-[#8ea79c]">Average</p>
          <p className="mt-2 font-mono text-[24px] font-bold" style={{ color: getPerformanceColor(analytics.overallAveragePercentage) }}>
            {analytics.overallAveragePercentage.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-center">
          <p className="text-[12px] text-[#8ea79c]">Highest</p>
          <p className="mt-2 font-mono text-[24px] font-bold text-emerald-400">{analytics.highestScore.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-center">
          <p className="text-[12px] text-[#8ea79c]">Lowest</p>
          <p className="mt-2 font-mono text-[24px] font-bold text-red-400">{analytics.lowestScore.toFixed(1)}%</p>
        </div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Recent tests</h2>
        <p className="text-[12.5px] text-[#8ea79c]">Latest 3</p>
      </div>

      {tests.length === 0 ? (
        <EmptyState title="No tests yet" message="Tests you create for this subject will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tests.slice(0, 3).map((test) => (
            <button
              key={test._id}
              onClick={() => onOpenTest(test)}
              className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-[15px] font-bold text-[#eef4f1]">{test.testTitle}</p>
                <span className="flex-shrink-0 text-[11.5px] text-[#8ea79c]">{new Date(test.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.08] pt-3 text-[12px] font-semibold text-emerald-400">
                <span>{test.assignedStudents.length} assigned</span>
                <span>{test.assignedStudents.filter((s) => s.submittedAt).length} submitted</span>
                <span>{test.assignedStudents.filter((s) => s.evaluatedAt).length} evaluated</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  </div>
);

const StudentsTab: React.FC<{
  students: StudentReport[];
  total: number;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  onOpenStudent: (s: StudentReport) => void;
  mounted: boolean;
}> = ({ students, total, searchQuery, setSearchQuery, sortBy, setSortBy, onOpenStudent, mounted }) => (
  <div className={`transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 sm:max-w-xs">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" stroke="#8ea79c" strokeWidth="1.8" />
          <path d="M21 21l-4.35-4.35" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search students..."
          className="w-full rounded-xl border border-white/[0.08] bg-[#101d17] py-2.5 pl-10 pr-3 text-[13.5px] text-[#eef4f1] outline-none transition-colors placeholder:text-[#5f766c] focus:border-emerald-400/30"
        />
      </div>

      <div className="flex flex-shrink-0 gap-2">
        {(['name', 'percentage', 'tests'] as SortBy[]).map((sort) => (
          <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              sortBy === sort ? 'bg-emerald-400 text-[#04140d]' : 'bg-[#101d17] text-[#8ea79c] hover:text-[#eef4f1]'
            }`}
          >
            {sort === 'percentage' ? 'Score' : sort.charAt(0).toUpperCase() + sort.slice(1)}
          </button>
        ))}
      </div>
    </div>

    <p className="mb-4 text-[12.5px] text-[#8ea79c]">
      {students.length} of {total} student{total !== 1 ? 's' : ''}
    </p>

    {students.length === 0 ? (
      <EmptyState title="No students found" message="Try a different search, or check back once students are assigned." />
    ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {students.map((student) => (
          <button
            key={student.studentId}
            onClick={() => onOpenStudent(student)}
            className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#eef4f1]">{student.studentName}</p>
                <p className="truncate text-[12.5px] text-[#8ea79c]">{student.studentEmail}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-mono text-[19px] font-bold" style={{ color: getPerformanceColor(student.averagePercentage) }}>
                  {student.averagePercentage.toFixed(1)}%
                </p>
                <p className="text-[11px] font-semibold" style={{ color: getPerformanceColor(student.averagePercentage) }}>
                  {getPerformanceLabel(student.averagePercentage)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5 text-center">
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">{student.totalTests}</p>
                <p className="text-[11px] text-[#8ea79c]">Tests</p>
              </div>
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">{student.evaluatedTests}</p>
                <p className="text-[11px] text-[#8ea79c]">Evaluated</p>
              </div>
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">{student.totalMarksScored}</p>
                <p className="text-[11px] text-[#8ea79c]">Score</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const TestsTab: React.FC<{
  tests: Test[];
  onOpenTest: (t: { _id: string; testTitle: string; fullMarks: number }) => void;
  mounted: boolean;
}> = ({ tests, onOpenTest, mounted }) => (
  <div className={`transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
    {tests.length === 0 ? (
      <EmptyState title="No tests yet" message="Tests you create for this subject will show up here." />
    ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((test) => (
          <button
            key={test._id}
            onClick={() => onOpenTest(test)}
            className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-[15px] font-bold text-[#eef4f1]">{test.testTitle}</p>
              <span className="flex-shrink-0 text-[11.5px] text-[#8ea79c]">{new Date(test.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5 text-center">
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">{test.fullMarks}</p>
                <p className="text-[11px] text-[#8ea79c]">Marks</p>
              </div>
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">{test.assignedStudents.length}</p>
                <p className="text-[11px] text-[#8ea79c]">Assigned</p>
              </div>
              <div>
                <p className="font-mono text-[15px] font-bold text-emerald-400">
                  {test.assignedStudents.filter((s) => s.evaluatedAt).length}
                </p>
                <p className="text-[11px] text-[#8ea79c]">Evaluated</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        stroke="#8ea79c"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <p className="mt-3.5 text-base font-bold text-[#eef4f1]">{title}</p>
    <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">{message}</p>
  </div>
);

export default TeacherHandleReportsScreen;