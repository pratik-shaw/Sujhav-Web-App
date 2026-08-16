/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherHandleScoresScreen.tsx (Expo). Same
// backend contracts (`GET /tests/teacher/my-tests`, filtered client-side by
// testId, `PUT /tests/teacher/:testId/marks`), same dark SUJHAV design
// language as the rest of the web dashboard: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 accent, font-serif headings,
// font-mono for numerals. Expects `?testId=...&testTitle=...&fullMarks=...`
// query params. Responsive: single column on mobile, multi-column card grid
// on tablet/desktop; bulk-update is a full modal with an inline-editable
// table on desktop and stacked rows on mobile.
// ---------------------------------------------------------------------------

interface StudentAssignment {
  _id: string;
  student: { _id: string; name: string; email: string };
  marksScored: number | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface Test {
  _id: string;
  testTitle: string;
  fullMarks: number;
  batch: { _id: string; batchName: string; category: string };
  className: string;
  subjectName: string;
  assignedStudents: StudentAssignment[];
  createdBy: { _id: string; name: string; email: string };
  instructions: string;
  dueDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MarksUpdate {
  studentId: string;
  marksScored: number;
}

type FilterStatus = 'all' | 'submitted' | 'evaluated' | 'pending';
type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

function getStatusColor(assignment: StudentAssignment) {
  if (assignment.evaluatedAt) return '#34d399';
  if (assignment.submittedAt) return '#fbbf24';
  return '#6b7d75';
}

function getStatusText(assignment: StudentAssignment) {
  if (assignment.evaluatedAt) return 'Evaluated';
  if (assignment.submittedAt) return 'Submitted';
  return 'Not submitted';
}

const TeacherHandleScoresScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const testId = searchParams.get('testId') || '';
  const testTitleParam = searchParams.get('testTitle') || '';
  const fullMarks = Number(searchParams.get('fullMarks') || 0);

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const [studentsAssignments, setStudentsAssignments] = useState<StudentAssignment[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [notice, setNotice] = useState<Notice>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentAssignment | null>(null);
  const [marksInput, setMarksInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMarksUpdates, setBulkMarksUpdates] = useState<{ [key: string]: string }>({});
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!testId) return;
    loadTestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const fetchTestDetails = async () => {
    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      router.push('/SignInScreen');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tests/teacher/my-tests`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success) {
        const specificTest = (data.data as Test[]).find((t) => t._id === testId);
        if (!specificTest) {
          setNotice({ type: 'error', title: 'Test not found', message: 'This test could not be located.' });
          return;
        }

        setTest(specificTest);
        setStudentsAssignments(specificTest.assignedStudents);

        const bulkUpdates: { [key: string]: string } = {};
        specificTest.assignedStudents.forEach((assignment) => {
          bulkUpdates[assignment.student._id] = assignment.marksScored?.toString() || '';
        });
        setBulkMarksUpdates(bulkUpdates);
      } else {
        setNotice({ type: 'error', title: 'Couldn\u2019t load scores', message: data.message || 'Failed to fetch test details' });
      }
    } catch (err) {
      console.error('Error fetching test details:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Please check your connection.' });
    }
  };

  const loadTestData = async () => {
    setIsLoading(true);
    await fetchTestDetails();
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTestData();
    setRefreshing(false);
  };

  const effectiveFullMarks = test?.fullMarks || fullMarks;

  const filteredStudents = useMemo(() => {
    switch (filterStatus) {
      case 'submitted':
        return studentsAssignments.filter((s) => s.submittedAt);
      case 'evaluated':
        return studentsAssignments.filter((s) => s.evaluatedAt);
      case 'pending':
        return studentsAssignments.filter((s) => s.submittedAt && !s.evaluatedAt);
      default:
        return studentsAssignments;
    }
  }, [studentsAssignments, filterStatus]);

  const stats = useMemo(() => {
    const totalStudents = studentsAssignments.length;
    const submittedCount = studentsAssignments.filter((s) => s.submittedAt).length;
    const evaluatedCount = studentsAssignments.filter((s) => s.evaluatedAt).length;
    const averageMarks =
      evaluatedCount > 0
        ? studentsAssignments.filter((s) => s.marksScored !== null).reduce((sum, s) => sum + (s.marksScored || 0), 0) / evaluatedCount
        : 0;
    return { totalStudents, submittedCount, evaluatedCount, averageMarks };
  }, [studentsAssignments]);

  const openUpdateMarks = (student: StudentAssignment) => {
    setSelectedStudent(student);
    setMarksInput(student.marksScored?.toString() || '');
  };

  const closeUpdateMarks = () => {
    setSelectedStudent(null);
    setMarksInput('');
  };

  const validateMarks = (marks: string): boolean => {
    if (!marks || marks.trim() === '') {
      setNotice({ type: 'error', title: 'Missing marks', message: 'Please enter marks.' });
      return false;
    }
    const marksNumber = parseFloat(marks);
    if (Number.isNaN(marksNumber) || marksNumber < 0 || marksNumber > effectiveFullMarks) {
      setNotice({ type: 'error', title: 'Invalid marks', message: `Please enter marks between 0 and ${effectiveFullMarks}.` });
      return false;
    }
    return true;
  };

  const submitUpdateMarks = async () => {
    if (!selectedStudent) return;
    if (!validateMarks(marksInput)) return;

    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/tests/teacher/${testId}/marks`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.student._id, marksScored: parseFloat(marksInput) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error:', response.status, errorText);
        setNotice({ type: 'error', title: 'Update failed', message: `HTTP ${response.status}. ${errorText}` });
        return;
      }

      const data = await response.json();
      if (data.success) {
        setNotice({ type: 'success', title: 'Marks updated', message: `${selectedStudent.student.name}\u2019s marks were saved.` });
        closeUpdateMarks();
        await fetchTestDetails();
      } else {
        setNotice({ type: 'error', title: 'Update failed', message: data.message || 'Failed to update marks' });
      }
    } catch (err) {
      console.error('Network error updating marks:', err);
      setNotice({ type: 'error', title: 'Network error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkMarksChange = (studentId: string, marks: string) => {
    setBulkMarksUpdates((prev) => ({ ...prev, [studentId]: marks }));
  };

  const submitBulkUpdate = async () => {
    const updates: MarksUpdate[] = [];
    const validationErrors: string[] = [];

    for (const [studentId, marks] of Object.entries(bulkMarksUpdates)) {
      if (marks && marks.trim() !== '') {
        const marksNumber = parseFloat(marks);
        if (Number.isNaN(marksNumber) || marksNumber < 0 || marksNumber > effectiveFullMarks) {
          const student = studentsAssignments.find((s) => s.student._id === studentId);
          validationErrors.push(`Invalid marks for ${student?.student.name || 'Unknown'}: ${marks}`);
          continue;
        }
        updates.push({ studentId, marksScored: marksNumber });
      }
    }

    if (validationErrors.length > 0) {
      setNotice({ type: 'error', title: 'Some marks are invalid', message: validationErrors.join(' \u2022 ') });
      return;
    }

    if (updates.length === 0) {
      setNotice({ type: 'error', title: 'Nothing to update', message: 'Enter at least one mark to update.' });
      return;
    }

    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      return;
    }

    setIsBulkUpdating(true);
    try {
      const results: { success: boolean; studentId: string }[] = [];

      for (const update of updates) {
        try {
          const response = await fetch(`${API_BASE}/tests/teacher/${testId}/marks`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP Error for student ${update.studentId}:`, response.status, errorText);
            results.push({ success: false, studentId: update.studentId });
          } else {
            const data = await response.json();
            results.push({ success: data.success, studentId: update.studentId });
          }
        } catch (err) {
          console.error(`Network Error for student ${update.studentId}:`, err);
          results.push({ success: false, studentId: update.studentId });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        setNotice({ type: 'success', title: 'Bulk update complete', message: `Updated marks for ${successCount} student${successCount > 1 ? 's' : ''}.` });
        setShowBulkModal(false);
      } else {
        setNotice({ type: 'info', title: 'Partial success', message: `Updated ${successCount} of ${results.length} students. ${failedCount} failed.` });
      }
      await fetchTestDetails();
    } catch (err) {
      console.error('Error updating bulk marks:', err);
      setNotice({ type: 'error', title: 'Network error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const FILTERS: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: studentsAssignments.length },
    { key: 'submitted', label: 'Submitted', count: studentsAssignments.filter((s) => s.submittedAt).length },
    { key: 'evaluated', label: 'Evaluated', count: studentsAssignments.filter((s) => s.evaluatedAt).length },
    { key: 'pending', label: 'Pending', count: studentsAssignments.filter((s) => s.submittedAt && !s.evaluatedAt).length },
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
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Student scores</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">{test?.testTitle || testTitleParam}</h1>
            {test?.subjectName && test?.className && (
              <p className="mt-0.5 truncate text-[12px] text-[#8ea79c]">
                {test.subjectName} &middot; Class {test.className}
              </p>
            )}
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh scores"
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
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke="#04140d"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Bulk update</span>
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
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading student scores&hellip;</p>
          </div>
        ) : (
          <>
            {/* stats */}
            <div
              className={`mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-all duration-500 sm:grid-cols-4 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              <div className="text-center">
                <p className="font-mono text-[20px] font-bold text-emerald-400">{stats.totalStudents}</p>
                <p className="mt-1 text-[12px] text-[#8ea79c]">Total</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[20px] font-bold text-emerald-400">{stats.submittedCount}</p>
                <p className="mt-1 text-[12px] text-[#8ea79c]">Submitted</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[20px] font-bold text-emerald-400">{stats.evaluatedCount}</p>
                <p className="mt-1 text-[12px] text-[#8ea79c]">Evaluated</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[20px] font-bold text-emerald-400">{stats.averageMarks.toFixed(1)}</p>
                <p className="mt-1 text-[12px] text-[#8ea79c]">Avg marks</p>
              </div>
            </div>

            {/* filters */}
            <div className="mb-6 flex gap-2 overflow-x-auto">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                    filterStatus === filter.key ? 'bg-emerald-400 text-[#04140d]' : 'bg-[#101d17] text-[#8ea79c] hover:text-[#eef4f1]'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {/* student cards */}
            {filteredStudents.length === 0 ? (
              <div
                className={`flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center transition-all duration-500 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                    stroke="#8ea79c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">No students found</p>
                <p className="mt-2 max-w-[380px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                  {filterStatus === 'all' ? 'No students are assigned to this test.' : `No students match the "${filterStatus}" filter.`}
                </p>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 gap-4 transition-all duration-500 md:grid-cols-2 xl:grid-cols-3 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                {filteredStudents.map((assignment) => (
                  <StudentCard
                    key={assignment.student._id}
                    assignment={assignment}
                    fullMarks={effectiveFullMarks}
                    onUpdate={() => openUpdateMarks(assignment)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* single update modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={() => !isUpdating && closeUpdateMarks()}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Update marks</p>
              <button
                onClick={closeUpdateMarks}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{selectedStudent.student.name}</h3>
            <p className="mt-0.5 text-[13px] text-[#8ea79c]">{selectedStudent.student.email}</p>

            <p className="mb-2 mt-5 text-[12.5px] text-[#8ea79c]">Enter marks (0 &ndash; {effectiveFullMarks}):</p>
            <input
              type="number"
              min={0}
              max={effectiveFullMarks}
              value={marksInput}
              onChange={(e) => setMarksInput(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-center text-[18px] font-bold text-[#eef4f1] outline-none transition-colors focus:border-emerald-400/40"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeUpdateMarks}
                disabled={isUpdating}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={submitUpdateMarks}
                disabled={isUpdating}
                className="flex-1 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isUpdating ? 'Saving\u2026' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bulk update modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-6" onClick={() => !isBulkUpdating && setShowBulkModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-white/[0.08] bg-[#0a120f] shadow-2xl sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Bulk update</p>
                <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Update marks for multiple students</h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3">
                {studentsAssignments.map((assignment) => (
                  <div
                    key={assignment.student._id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#101d17] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-[#eef4f1]">{assignment.student.name}</p>
                      <p className="truncate text-[12px] text-[#8ea79c]">{assignment.student.email}</p>
                      <p className="mt-1 text-[11px] font-semibold" style={{ color: getStatusColor(assignment) }}>
                        {getStatusText(assignment)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={effectiveFullMarks}
                        value={bulkMarksUpdates[assignment.student._id] || ''}
                        onChange={(e) => handleBulkMarksChange(assignment.student._id, e.target.value)}
                        placeholder="0"
                        className="w-20 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-center text-[14px] font-bold text-[#eef4f1] outline-none transition-colors focus:border-emerald-400/40"
                      />
                      <span className="text-[13px] text-[#8ea79c]">/{effectiveFullMarks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 border-t border-white/[0.08] px-6 py-4.5">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={isBulkUpdating}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={submitBulkUpdate}
                disabled={isBulkUpdating}
                className="flex-1 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isBulkUpdating ? 'Updating\u2026' : 'Update all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StudentCard: React.FC<{ assignment: StudentAssignment; fullMarks: number; onUpdate: () => void }> = ({
  assignment,
  fullMarks,
  onUpdate,
}) => (
  <div className="flex flex-col rounded-2xl border border-emerald-400/[0.12] bg-[#101d17] p-5">
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold text-[#eef4f1]">{assignment.student.name}</p>
        <p className="truncate text-[12.5px] text-[#8ea79c]">{assignment.student.email}</p>
      </div>
      <span className="flex-shrink-0 text-[11.5px] font-semibold" style={{ color: getStatusColor(assignment) }}>
        {getStatusText(assignment)}
      </span>
    </div>

    <div className="mb-4 flex flex-col gap-1.5 border-t border-white/[0.08] pt-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-[#8ea79c]">Marks scored</span>
        <span className="text-[13px] font-semibold" style={{ color: assignment.marksScored !== null ? '#34d399' : '#6b7d75' }}>
          {assignment.marksScored !== null ? `${assignment.marksScored}/${fullMarks}` : 'Not evaluated'}
        </span>
      </div>
      {assignment.submittedAt && (
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-[#8ea79c]">Submitted</span>
          <span className="text-[12px] text-[#c7d6cf]">
            {new Date(assignment.submittedAt).toLocaleDateString()} &middot; {new Date(assignment.submittedAt).toLocaleTimeString()}
          </span>
        </div>
      )}
      {assignment.evaluatedAt && (
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-[#8ea79c]">Evaluated</span>
          <span className="text-[12px] text-[#c7d6cf]">
            {new Date(assignment.evaluatedAt).toLocaleDateString()} &middot; {new Date(assignment.evaluatedAt).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>

    <div className="mt-auto flex items-center justify-between gap-3">
      <button
        onClick={onUpdate}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
            stroke="#04140d"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {assignment.marksScored !== null ? 'Update marks' : 'Add marks'}
      </button>

      {assignment.marksScored !== null && (
        <span className="rounded-md bg-black/25 px-2.5 py-1.5 font-mono text-[13px] font-bold text-emerald-400">
          {((assignment.marksScored / fullMarks) * 100).toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

export default TeacherHandleScoresScreen;