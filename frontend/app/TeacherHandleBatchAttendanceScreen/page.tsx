/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherHandleBatchAttendanceScreen.tsx (Expo).
// Same backend contracts (GET /attendance/students, /attendance/stats,
// /attendance/date, POST /attendance/mark), same dark SUJHAV design
// language as the rest of the web dashboard: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 accent, font-serif headings,
// font-mono for numerals. batchId/batchName/subjects arrive via query
// string from TeacherBatchAttendanceScreen. Responsive: student roster is a
// card grid instead of a single mobile column, quick actions and the save
// bar sit inline instead of native alerts/sheets.
// ---------------------------------------------------------------------------

interface Subject {
  name: string;
  teacher: string;
  _id?: string;
}

interface Student {
  _id: string;
  name: string;
  email: string;
  enrolledAt?: string;
}

interface AttendanceRecord {
  student: string;
  status: 'present' | 'absent' | 'no_class';
}

interface StudentStats {
  present: number;
  absent: number;
  noClass: number;
  totalClasses: number;
  attendancePercentage: number;
}

interface StudentWithStats extends Student {
  stats?: StudentStats;
  todayStatus?: 'present' | 'absent' | 'no_class';
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;
type AttendanceStatus = 'present' | 'absent' | 'no_class';

const pad = (n: number) => n.toString().padStart(2, '0');
const toDateInputValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const STATUS_META: Record<AttendanceStatus | 'unmarked', { label: string; color: string; next: string }> = {
  present: { label: 'Present', color: '#4ade80', next: 'Mark no class' },
  absent: { label: 'Absent', color: '#f87171', next: 'Mark present' },
  no_class: { label: 'No class', color: '#fb923c', next: 'Mark absent' },
  unmarked: { label: 'Not marked', color: '#8ea79c', next: 'Mark present' },
};

const getStatusMeta = (status?: AttendanceStatus) => STATUS_META[status || 'unmarked'];

const TeacherHandleBatchAttendanceScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const batchId = searchParams.get('batchId') || '';
  const batchName = searchParams.get('batchName') || 'Batch';
  const subjects: Subject[] = useMemo(() => {
    try {
      return JSON.parse(searchParams.get('subjects') || '[]');
    } catch {
      return [];
    }
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [statsStudent, setStatsStudent] = useState<StudentWithStats | null>(null);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [isAttendanceAlreadyMarked, setIsAttendanceAlreadyMarked] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  const fetchStudentStats = async (studentId: string): Promise<StudentStats | undefined> => {
    if (!selectedSubject) return undefined;
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/attendance/stats/${batchId}/${encodeURIComponent(selectedSubject.name)}/${studentId}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data.success) return data.data.statistics;
    } catch {
      // stats are supplementary; ignore individual failures
    }
    return undefined;
  };

  const fetchStudentsForSubject = async () => {
    if (!selectedSubject) return;
    try {
      const token = getToken();
      if (!token) {
        setNotice({ type: 'error', title: 'Error', message: 'No authentication token found' });
        return;
      }

      const response = await fetch(
        `${API_BASE}/attendance/students/${batchId}/${encodeURIComponent(selectedSubject.name)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();

      if (data.success) {
        const studentsWithStats = await Promise.all(
          data.data.students.map(async (studentData: any) => {
            const stats = await fetchStudentStats(studentData.student._id);
            return { ...studentData.student, stats, enrolledAt: studentData.enrolledAt };
          })
        );
        setStudents(studentsWithStats);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch students' });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    }
  };

  const fetchTodayAttendance = async () => {
    if (!selectedSubject) return;
    try {
      const token = getToken();
      const dateStr = toDateInputValue(selectedDate);

      const response = await fetch(
        `${API_BASE}/attendance/date/${batchId}/${encodeURIComponent(selectedSubject.name)}/${dateStr}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();

      if (data.success && data.data) {
        const records: AttendanceRecord[] = data.data.studentAttendance.map((record: any) => ({
          student: record.student._id,
          status: record.status,
        }));
        setAttendanceRecords(records);
        setIsAttendanceAlreadyMarked(true);
        setStudents((prev) =>
          prev.map((student) => ({ ...student, todayStatus: records.find((r) => r.student === student._id)?.status }))
        );
      } else {
        setAttendanceRecords([]);
        setIsAttendanceAlreadyMarked(false);
        setStudents((prev) => prev.map((student) => ({ ...student, todayStatus: undefined })));
      }
    } catch {
      setIsAttendanceAlreadyMarked(false);
    }
  };

  const loadSubjectData = async () => {
    if (!selectedSubject) return;
    setIsLoading(true);
    try {
      await Promise.all([fetchStudentsForSubject(), fetchTodayAttendance()]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubject) loadSubjectData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedSubject) await loadSubjectData();
    setRefreshing(false);
  };

  const toggleStudentAttendance = (studentId: string) => {
    const currentRecord = attendanceRecords.find((r) => r.student === studentId);
    let newStatus: AttendanceStatus;

    if (!currentRecord || currentRecord.status === 'absent') newStatus = 'present';
    else if (currentRecord.status === 'present') newStatus = 'no_class';
    else newStatus = 'absent';

    const updatedRecords = attendanceRecords.filter((r) => r.student !== studentId);
    updatedRecords.push({ student: studentId, status: newStatus });
    setAttendanceRecords(updatedRecords);
    setStudents((prev) => prev.map((s) => (s._id === studentId ? { ...s, todayStatus: newStatus } : s)));
  };

  const markAllPresent = () => {
    const records = students.map((s) => ({ student: s._id, status: 'present' as const }));
    setAttendanceRecords(records);
    setStudents((prev) => prev.map((s) => ({ ...s, todayStatus: 'present' as const })));
  };

  const markAllAbsent = () => {
    const records = students.map((s) => ({ student: s._id, status: 'absent' as const }));
    setAttendanceRecords(records);
    setStudents((prev) => prev.map((s) => ({ ...s, todayStatus: 'absent' as const })));
  };

  const submitAttendance = async () => {
    if (!selectedSubject || attendanceRecords.length === 0) {
      setNotice({ type: 'error', title: 'Error', message: 'Please mark attendance for at least one student' });
      return;
    }

    try {
      setIsMarkingAttendance(true);
      const token = getToken();

      const response = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          subject: selectedSubject.name,
          date: toDateInputValue(selectedDate),
          studentAttendance: attendanceRecords,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAttendanceAlreadyMarked(true);
        setNotice({ type: 'success', title: 'Success', message: 'Attendance saved successfully' });
        await loadSubjectData();
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to save attendance' });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please try again.' });
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
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
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-4">
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
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Mark daily attendance</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">{batchName}</h1>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            <label className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-[13px] font-medium text-[#eef4f1]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                  stroke="#34d399"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="date"
                value={toDateInputValue(selectedDate)}
                onChange={(e) => e.target.value && setSelectedDate(new Date(`${e.target.value}T00:00:00`))}
                className="bg-transparent text-[13px] text-[#eef4f1] [color-scheme:dark] focus:outline-none"
              />
            </label>
            {isAttendanceAlreadyMarked && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Marked
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing || isLoading}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
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
        <p className="mb-6 text-[13px] text-[#8ea79c]">{formatDate(selectedDate)}</p>

        {/* subject tabs */}
        <section className={`mb-6 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <h2 className="mb-3 font-serif text-lg font-semibold text-[#eef4f1]">Select subject</h2>
          {subjects.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {subjects.map((subject, index) => {
                const isSelected = selectedSubject?.name === subject.name;
                return (
                  <button
                    key={`${subject.name}-${index}`}
                    onClick={() => setSelectedSubject(subject)}
                    className={`rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                      isSelected
                        ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-400'
                        : 'border-white/[0.08] bg-[#101d17] text-[#8ea79c] hover:border-emerald-400/30 hover:text-[#eef4f1]'
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-[#8ea79c]">No subjects are configured for this batch.</p>
          )}
        </section>

        {selectedSubject && (
          <>
            {/* controls */}
            <section className={`mb-6 transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Attendance for {selectedSubject.name}</h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 font-mono text-[12.5px] font-bold text-emerald-400">
                  {presentCount} / {students.length} present
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={markAllPresent}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400/90 px-4 py-3 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-400"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Mark all present
                </button>
                <button
                  onClick={markAllAbsent}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-400/90 px-4 py-3 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Mark all absent
                </button>
              </div>
            </section>

            {/* roster */}
            <section className={`transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
              {isLoading && !refreshing ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17] py-20">
                  <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
                  <p className="mt-3.5 text-sm text-[#8ea79c]">Loading students&hellip;</p>
                </div>
              ) : students.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {students.map((student) => (
                    <StudentCard
                      key={student._id}
                      student={student}
                      onToggle={() => toggleStudentAttendance(student._id)}
                      onViewStats={() => setStatsStudent(student)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75"
                      stroke="#8ea79c"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No students found</p>
                  <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">No students are assigned to this subject.</p>
                </div>
              )}
            </section>

            {/* submit */}
            {students.length > 0 && (
              <section className="mt-6">
                <button
                  onClick={submitAttendance}
                  disabled={isMarkingAttendance}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-6 py-4 text-[15px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8ea79c]"
                >
                  {isMarkingAttendance ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/30 border-t-[#04140d]" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {isMarkingAttendance ? 'Saving attendance…' : isAttendanceAlreadyMarked ? 'Update attendance' : 'Save attendance'}
                </button>
              </section>
            )}
          </>
        )}
      </main>

      {/* stats modal */}
      {statsStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:px-6" onClick={() => setStatsStudent(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-white/[0.08] bg-[#101d17] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
              <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{statsStudent.name} &ndash; attendance details</h3>
              <button onClick={() => setStatsStudent(null)} aria-label="Close" className="flex-shrink-0 text-[#8ea79c] hover:text-[#eef4f1]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {statsStudent.stats && (
              <div className="grid grid-cols-2 gap-4 px-6 py-6">
                <DetailedStat label="Days present" value={statsStudent.stats.present} color="#4ade80" />
                <DetailedStat label="Days absent" value={statsStudent.stats.absent} color="#f87171" />
                <DetailedStat label="No class" value={statsStudent.stats.noClass} color="#fb923c" />
                <DetailedStat label="Attendance rate" value={`${statsStudent.stats.attendancePercentage.toFixed(1)}%`} color="#34d399" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StudentCard: React.FC<{ student: StudentWithStats; onToggle: () => void; onViewStats: () => void }> = ({
  student,
  onToggle,
  onViewStats,
}) => {
  const meta = getStatusMeta(student.todayStatus);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-emerald-400/15">
          <span className="text-[17px] font-bold text-emerald-400">{student.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-[#eef4f1]">{student.name}</p>
          <p className="truncate text-[12.5px] text-[#8ea79c]">{student.email}</p>
          <button onClick={onToggle} className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold hover:underline" style={{ color: meta.color }}>
            {meta.label}
            <span className="text-[#5c7268]">&middot; {meta.next}</span>
          </button>
        </div>
        <button
          onClick={onToggle}
          aria-label="Toggle attendance status"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          style={{ background: meta.color }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            {student.todayStatus === 'present' && <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
            {student.todayStatus === 'absent' && <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
            {student.todayStatus === 'no_class' && <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
            {!student.todayStatus && <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />}
          </svg>
        </button>
      </div>

      {student.stats && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#0a120f] px-4 py-3">
          <div className="text-center">
            <p className="font-mono text-[15px] font-bold text-[#eef4f1]">{student.stats.attendancePercentage.toFixed(1)}%</p>
            <p className="text-[10.5px] text-[#8ea79c]">Attendance</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-[15px] font-bold text-[#eef4f1]">{student.stats.present}</p>
            <p className="text-[10.5px] text-[#8ea79c]">Present</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-[15px] font-bold text-[#eef4f1]">{student.stats.absent}</p>
            <p className="text-[10.5px] text-[#8ea79c]">Absent</p>
          </div>
          <button
            onClick={onViewStats}
            aria-label="View detailed stats"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 transition-colors hover:border-emerald-400/50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

const DetailedStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0a120f] px-4 py-6 text-center">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    <p className="font-mono text-2xl font-bold text-[#eef4f1]">{value}</p>
    <p className="text-[12px] text-[#8ea79c]">{label}</p>
  </div>
);

export default TeacherHandleBatchAttendanceScreen;