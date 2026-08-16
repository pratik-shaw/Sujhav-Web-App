/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminAccessStudentReportsScreen.tsx (Expo). Same
// backend contracts (`GET /batches`, `GET /attendance/comprehensive`), same
// dark SUJHAV design language as the rest of the web dashboard: bg
// #0a120f, cards #101d17, hairline white/[0.08] borders, emerald-400
// accent, font-serif headings, font-mono for numerals. Responsive:
// accordion batch/student list stays single-column (it's inherently
// hierarchical), but subject-wise attendance renders as a proper grid on
// wider screens instead of a stacked mobile list.
//
// NOTE: the Expo screen renders a separate `AcademicDetailedRecordComponent`
// for the academic-record drill-down, whose source wasn't provided. Below
// is a self-contained `AcademicRecordPanel` that fetches from
// `${API_BASE}/academic/student/:studentId` and renders whatever comes
// back in a generic, defensive layout (tests, subject averages, etc). Swap
// its fetch/JSX for your real component's logic once you share it.
// ---------------------------------------------------------------------------

const ALL_CENTERS_ID = '__all__';

type BatchCenterMap = Record<string, { centerId: string; centerName: string }>;

interface StudentAttendance {
  studentId: string;
  studentName: string;
  studentEmail: string;
  batchId: string;
  batchName: string;
  overallStatistics: {
    totalClasses: number;
    present: number;
    absent: number;
    attendancePercentage: number;
    totalSubjects: number;
  };
  subjects: Array<{
    subjectName: string;
    teacher: { name: string } | null;
    statistics: { totalClasses: number; present: number; absent: number; attendancePercentage: number };
  }>;
}

interface BatchGroup {
  batchId: string;
  batchName: string;
  centerId: string;
  centerName: string;
  students: StudentAttendance[];
  averageAttendance: number;
}

interface CenterTab {
  _id: string;
  centerName: string;
}

type ViewMode = 'attendance' | 'academic';
type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

function getAttendanceColor(pct: number) {
  if (pct >= 75) return '#34d399';
  if (pct >= 50) return '#fbbf24';
  return '#f87171';
}

function getAttendanceStatus(pct: number) {
  if (pct >= 75) return 'Good';
  if (pct >= 50) return 'Warning';
  return 'Critical';
}

function groupStudentsByBatch(students: StudentAttendance[], batchCenterMap: BatchCenterMap): BatchGroup[] {
  const batchMap = new Map<string, StudentAttendance[]>();

  students.forEach((student) => {
    if (!batchMap.has(student.batchId)) batchMap.set(student.batchId, []);
    batchMap.get(student.batchId)!.push(student);
  });

  return Array.from(batchMap.entries()).map(([batchId, batchStudents]) => {
    const sortedStudents = [...batchStudents].sort(
      (a, b) => a.overallStatistics.attendancePercentage - b.overallStatistics.attendancePercentage
    );

    const averageAttendance =
      batchStudents.length > 0
        ? batchStudents.reduce((sum, s) => sum + s.overallStatistics.attendancePercentage, 0) / batchStudents.length
        : 0;

    const centerInfo = batchCenterMap[batchId];

    return {
      batchId,
      batchName: batchStudents[0].batchName,
      centerId: centerInfo?.centerId ?? '',
      centerName: centerInfo?.centerName ?? 'Unknown center',
      students: sortedStudents,
      averageAttendance,
    };
  });
}

const AdminAccessStudentReportsScreen: React.FC = () => {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('attendance');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(ALL_CENTERS_ID);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      router.push('/SignInScreen');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [batchesRes, attendanceRes] = await Promise.all([
        fetch(`${API_BASE}/batches`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }),
        fetch(`${API_BASE}/attendance/comprehensive`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }),
      ]);

      const batchCenterMap: BatchCenterMap = {};
      const batchesData = await batchesRes.json();
      if (batchesData.success && Array.isArray(batchesData.data)) {
        for (const batch of batchesData.data) {
          if (batch._id && batch.center?._id) {
            batchCenterMap[batch._id] = { centerId: batch.center._id, centerName: batch.center.centerName || 'Unknown center' };
          }
        }
      }

      const contentType = attendanceRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response for attendance');
      }
      const attendanceData = await attendanceRes.json();

      if (attendanceData.success) {
        setBatchGroups(groupStudentsByBatch(attendanceData.data.students, batchCenterMap));
      } else {
        setNotice({ type: 'error', title: 'Couldn\u2019t load reports', message: attendanceData.message || 'Failed to fetch attendance data' });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Please check your connection and try again.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const centersInBatches: CenterTab[] = useMemo(() => {
    const list: CenterTab[] = [];
    const seen = new Set<string>();
    for (const group of batchGroups) {
      if (group.centerId && !seen.has(group.centerId)) {
        seen.add(group.centerId);
        list.push({ _id: group.centerId, centerName: group.centerName });
      }
    }
    return list;
  }, [batchGroups]);

  const filteredBatchGroups =
    selectedCenterId === ALL_CENTERS_ID ? batchGroups : batchGroups.filter((g) => g.centerId === selectedCenterId);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      next.has(batchId) ? next.delete(batchId) : next.add(batchId);
      return next;
    });
  };

  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  };

  const viewAcademicRecord = (studentId: string, studentName: string, studentEmail: string) => {
    setSelectedStudent({ id: studentId, name: studentName, email: studentEmail });
    setViewMode('academic');
  };

  const backToAttendance = () => {
    setViewMode('attendance');
    setSelectedStudent(null);
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
            onClick={() => (viewMode === 'academic' ? backToAttendance() : router.back())}
            aria-label="Go back"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 leading-tight">
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">
              {viewMode === 'academic' ? 'Academic record' : 'Attendance & academic reports'}
            </span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
              {viewMode === 'academic' ? selectedStudent?.name : 'Student reports'}
            </h1>
            {viewMode === 'attendance' && (
              <p className="mt-0.5 text-[12px] text-[#8ea79c]">
                {filteredBatchGroups.length} batch{filteredBatchGroups.length !== 1 ? 'es' : ''}
                {selectedCenterId !== ALL_CENTERS_ID ? ' in this center' : ''}
              </p>
            )}
          </div>

          {viewMode === 'attendance' && (
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
          )}
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading student reports&hellip;</p>
          </div>
        ) : viewMode === 'academic' && selectedStudent ? (
          <AcademicRecordPanel studentId={selectedStudent.id} studentName={selectedStudent.name} studentEmail={selectedStudent.email} />
        ) : (
          <>
            {centersInBatches.length > 0 && (
              <div className={`mb-6 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
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
                    const batchCount = center._id === ALL_CENTERS_ID ? batchGroups.length : batchGroups.filter((g) => g.centerId === center._id).length;

                    return (
                      <button
                        key={center._id}
                        onClick={() => setSelectedCenterId(center._id)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                          isSelected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' : 'border-white/[0.08] text-[#8ea79c] hover:border-emerald-400/30 hover:text-[#eef4f1]'
                        }`}
                      >
                        {center._id !== ALL_CENTERS_ID && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {center.centerName}
                        <span className={`rounded font-mono text-[11px] px-1.5 py-px ${isSelected ? 'bg-emerald-400/20' : 'bg-white/[0.08]'}`}>{batchCount}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredBatchGroups.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                  <path d="M21 8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2V8z M3 8l9 6 9-6" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">
                  {batchGroups.length === 0 ? 'No attendance data available' : 'No batches found for this center'}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col gap-4 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
                {filteredBatchGroups.map((batch) => (
                  <BatchAccordion
                    key={batch.batchId}
                    batch={batch}
                    isExpanded={expandedBatches.has(batch.batchId)}
                    onToggle={() => toggleBatch(batch.batchId)}
                    expandedStudents={expandedStudents}
                    onToggleStudent={toggleStudent}
                    onViewAcademic={viewAcademicRecord}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const BatchAccordion: React.FC<{
  batch: BatchGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedStudents: Set<string>;
  onToggleStudent: (id: string) => void;
  onViewAcademic: (id: string, name: string, email: string) => void;
}> = ({ batch, isExpanded, onToggle, expandedStudents, onToggleStudent, onViewAcademic }) => (
  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17]">
    <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 bg-emerald-400/[0.04] p-5 text-left">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z M6 12v5c3 3 9 3 12 0v-5" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[#eef4f1]">{batch.batchName}</p>
          <p className="mt-0.5 text-[13px] text-[#8ea79c]">
            {batch.students.length} student{batch.students.length !== 1 ? 's' : ''} &middot; Avg {batch.averageAttendance.toFixed(1)}%
          </p>
          {batch.centerName && batch.centerName !== 'Unknown center' && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {batch.centerName}
            </span>
          )}
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
        <path d="M6 9l6 6 6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>

    {isExpanded && (
      <div className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
        {batch.students.map((student) => (
          <StudentAccordion
            key={student.studentId}
            student={student}
            isExpanded={expandedStudents.has(student.studentId)}
            onToggle={() => onToggleStudent(student.studentId)}
            onViewAcademic={onViewAcademic}
          />
        ))}
      </div>
    )}
  </div>
);

const StudentAccordion: React.FC<{
  student: StudentAttendance;
  isExpanded: boolean;
  onToggle: () => void;
  onViewAcademic: (id: string, name: string, email: string) => void;
}> = ({ student, isExpanded, onToggle, onViewAcademic }) => {
  const color = getAttendanceColor(student.overallStatistics.attendancePercentage);

  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-5 text-left">
        <span className="h-10 w-1 flex-shrink-0 self-stretch rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#eef4f1]">{student.studentName}</p>
          <p className="truncate text-[12.5px] text-[#8ea79c]">{student.studentEmail}</p>
          <p className="mt-1 text-[12px] text-[#8ea79c]">
            {student.overallStatistics.present}/{student.overallStatistics.totalClasses} classes &middot; {student.overallStatistics.totalSubjects} subjects
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-mono text-[20px] font-bold" style={{ color }}>
            {student.overallStatistics.attendancePercentage.toFixed(1)}%
          </p>
          <span className="mt-1 inline-block rounded border px-2 py-0.5 text-[11px] font-semibold" style={{ color, borderColor: color }}>
            {getAttendanceStatus(student.overallStatistics.attendancePercentage)}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.06] bg-black/20 px-5 pb-5 pt-4">
          <button
            onClick={() => onViewAcademic(student.studentId, student.studentName, student.studentEmail)}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 py-3 text-[14px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/15"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z M6 12v5c3 3 9 3 12 0v-5" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View academic record
          </button>

          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-emerald-400">Subject-wise attendance</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {student.subjects.map((subject, index) => {
              const subjColor = getAttendanceColor(subject.statistics.attendancePercentage);
              return (
                <div key={index} className="rounded-xl border border-white/[0.08] bg-[#101d17] p-4">
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#eef4f1]">{subject.subjectName}</p>
                      <p className="truncate text-[11.5px] text-[#8ea79c]">{subject.teacher ? subject.teacher.name : 'No teacher assigned'}</p>
                    </div>
                    <p className="flex-shrink-0 font-mono text-[14px] font-bold" style={{ color: subjColor }}>
                      {subject.statistics.attendancePercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full" style={{ width: `${subject.statistics.attendancePercentage}%`, backgroundColor: subjColor }} />
                  </div>
                  <p className="text-[11px] text-[#8ea79c]">
                    {subject.statistics.present}/{subject.statistics.totalClasses} classes
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Academic record panel — exact port of AcademicDetailedRecordComponent.tsx
// (`GET /tests/reports/student/:studentId/report-card`)
// ---------------------------------------------------------------------------

interface TestScore {
  testId: string;
  testTitle: string;
  fullMarks: number;
  marksScored: number | null;
  className: string;
  createdAt: string;
  evaluatedAt: string | null;
  percentage: number | null;
  status: 'evaluated' | 'pending';
}

interface SubjectReport {
  subjectName: string;
  batch: { _id: string; batchName: string; category: string };
  tests: TestScore[];
  totalTests: number;
  evaluatedTests: number;
  totalMarksScored: number;
  totalFullMarks: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number | null;
  grade: string;
}

interface StudentReportCard {
  student: { _id: string; name: string; email: string };
  reportCard: SubjectReport[];
  overallStats: {
    totalTests: number;
    evaluatedTests: number;
    pendingTests: number;
    totalMarksScored: number;
    totalFullMarks: number;
    averagePercentage: number;
    overallGrade: string;
  };
}

function getGradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#4CAF50';
  if (grade === 'B+' || grade === 'B') return '#8BC34A';
  if (grade === 'C') return '#FF9800';
  if (grade === 'D') return '#FF5722';
  return '#F44336';
}

function getPercentageColor(percentage: number): string {
  if (percentage >= 90) return '#4CAF50';
  if (percentage >= 80) return '#8BC34A';
  if (percentage >= 70) return '#FFC107';
  if (percentage >= 60) return '#FF9800';
  if (percentage >= 50) return '#FF5722';
  return '#F44336';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const AcademicRecordPanel: React.FC<{ studentId: string; studentName: string; studentEmail: string }> = ({ studentId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportCard, setReportCard] = useState<StudentReportCard | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    fetchReportCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchReportCard = async () => {
    setLoading(true);
    const token = getToken();
    if (!token) {
      setNotice({ type: 'error', title: 'Session expired', message: 'Please sign in again.' });
      router.push('/SignInScreen');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tests/reports/student/${studentId}/report-card`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();

      if (data.success) {
        setReportCard(data.data);
      } else {
        setNotice({ type: 'error', title: 'Couldn\u2019t load report card', message: data.message || 'Failed to fetch report card' });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setNotice({ type: 'error', title: 'Network error', message: 'Failed to load academic reports.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectName: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      next.has(subjectName) ? next.delete(subjectName) : next.add(subjectName);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading academic reports&hellip;</p>
      </div>
    );
  }

  if (notice) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#f87171" strokeWidth="1.5" />
          <path d="M12 8v5M12 16h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">{notice.title}</p>
        <p className="mt-2 max-w-[380px] text-[13.5px] leading-relaxed text-[#8ea79c]">{notice.message}</p>
      </div>
    );
  }

  if (!reportCard || reportCard.reportCard.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z M6 12v5c3 3 9 3 12 0v-5" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">No academic data available</p>
        <p className="mt-2 text-[13.5px] text-[#8ea79c]">This student has no test records yet.</p>
      </div>
    );
  }

  const { overallStats } = reportCard;

  return (
    <div className="flex flex-col gap-6">
      {/* overall performance card */}
      <div className="rounded-2xl border border-emerald-400/20 bg-[#101d17] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-4" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Overall performance</h2>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="font-mono text-[26px] font-bold text-emerald-400">{overallStats.totalTests}</p>
            <p className="mt-1 text-[12px] text-[#8ea79c]">Total tests</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-[26px] font-bold text-emerald-400">{overallStats.evaluatedTests}</p>
            <p className="mt-1 text-[12px] text-[#8ea79c]">Evaluated</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-[26px] font-bold text-emerald-400">{overallStats.pendingTests}</p>
            <p className="mt-1 text-[12px] text-[#8ea79c]">Pending</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-5 sm:flex-row">
          <div className="flex flex-col items-center sm:items-start">
            <p className="text-[12px] text-[#8ea79c]">Overall average</p>
            <p className="mt-1 font-mono text-[34px] font-bold" style={{ color: getPercentageColor(overallStats.averagePercentage) }}>
              {overallStats.averagePercentage.toFixed(1)}%
            </p>
            <span
              className="mt-1.5 inline-block rounded-md px-3 py-1 text-[14px] font-bold text-white"
              style={{ backgroundColor: getGradeColor(overallStats.overallGrade) }}
            >
              {overallStats.overallGrade}
            </span>
          </div>
          <div className="flex flex-col items-center sm:items-end">
            <p className="text-[19px] font-semibold text-[#eef4f1]">
              {overallStats.totalMarksScored} / {overallStats.totalFullMarks}
            </p>
            <p className="mt-1 text-[12px] text-[#8ea79c]">Total marks</p>
          </div>
        </div>
      </div>

      {/* subject-wise reports */}
      <div>
        <p className="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-emerald-400">Subject-wise performance</p>

        <div className="flex flex-col gap-3">
          {reportCard.reportCard.map((subject, index) => {
            const isExpanded = expandedSubjects.has(subject.subjectName);

            return (
              <div key={index} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17]">
                <button onClick={() => toggleSubject(subject.subjectName)} className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path
                        d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                        stroke="#34d399"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[#eef4f1]">{subject.subjectName}</p>
                      <p className="truncate text-[12.5px] text-[#8ea79c]">{subject.batch.batchName}</p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-[18px] font-bold" style={{ color: getPercentageColor(subject.averagePercentage) }}>
                        {subject.averagePercentage.toFixed(1)}%
                      </p>
                      <span
                        className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: getGradeColor(subject.grade) }}
                      >
                        {subject.grade}
                      </span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <path d="M6 9l6 6 6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {/* subject stats summary */}
                <div className="grid grid-cols-4 gap-2 border-t border-white/[0.06] bg-black/20 px-4 py-3 sm:px-5">
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#eef4f1]">
                      {subject.evaluatedTests}/{subject.totalTests}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-[#8ea79c]">Tests</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#eef4f1]">{subject.highestScore.toFixed(0)}%</p>
                    <p className="mt-0.5 text-[10.5px] text-[#8ea79c]">Highest</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#eef4f1]">{subject.lowestScore !== null ? `${subject.lowestScore.toFixed(0)}%` : 'N/A'}</p>
                    <p className="mt-0.5 text-[10.5px] text-[#8ea79c]">Lowest</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#eef4f1]">
                      {subject.totalMarksScored}/{subject.totalFullMarks}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-[#8ea79c]">Marks</p>
                  </div>
                </div>

                {/* test history */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] bg-black/25 px-4 py-4 sm:px-5">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-emerald-400">Test history</p>
                    {subject.tests.length === 0 ? (
                      <p className="py-2 text-center text-[13px] text-[#8ea79c]">No tests available</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-white/[0.06]">
                        {subject.tests.map((test, testIndex) => (
                          <div key={testIndex} className="flex items-center justify-between gap-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-[#eef4f1]">{test.testTitle}</p>
                              <p className="truncate text-[12.5px] text-[#8ea79c]">{test.className}</p>
                              <p className="text-[11.5px] text-[#6b7d75]">{formatDate(test.createdAt)}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {test.status === 'evaluated' ? (
                                <>
                                  <p className="text-[17px] font-bold" style={{ color: getPercentageColor(test.percentage || 0) }}>
                                    {test.percentage?.toFixed(1)}%
                                  </p>
                                  <p className="text-[12.5px] text-[#8ea79c]">
                                    {test.marksScored}/{test.fullMarks}
                                  </p>
                                </>
                              ) : (
                                <span className="rounded-md border border-amber-400 bg-amber-400/15 px-3 py-1.5 text-[12.5px] font-semibold text-amber-300">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminAccessStudentReportsScreen;