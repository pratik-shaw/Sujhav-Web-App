/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken, getStoredUserData } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherDailyFormScreen.tsx (Expo). Same backend
// contracts (GET /teacher-daily-form/check-submission, POST
// /teacher-daily-form/submit), same dark SUJHAV design language as the rest
// of the web dashboard: bg #0a120f, cards #101d17, hairline white/[0.08]
// borders, emerald-400 accent, font-serif headings, font-mono for numerals.
// The form is a single centered column (forms read better narrow than full
// width) with proper labelled inputs instead of native alerts for
// validation and submit feedback.
// ---------------------------------------------------------------------------

interface FormData {
  hasClassToday: boolean | null;
  teacherName: string;
  date: string;
  numberOfClasses: string;
  teacherAttendance: 'Present' | 'Absent' | null;
  classesTaken: string;
  subjectsTaught: string;
  topicsTaught: string;
  studentAttendanceMarked: boolean | null;
}

type FormErrors = Partial<Record<keyof FormData, string>>;
type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const REQUIRED_FIELDS_WITH_CLASS: (keyof FormData)[] = [
  'hasClassToday',
  'teacherName',
  'date',
  'teacherAttendance',
  'numberOfClasses',
  'classesTaken',
  'subjectsTaught',
  'topicsTaught',
  'studentAttendanceMarked',
];
const REQUIRED_FIELDS_NO_CLASS: (keyof FormData)[] = ['hasClassToday', 'teacherName', 'date', 'teacherAttendance'];

const TeacherDailyFormScreen: React.FC = () => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    hasClassToday: null,
    teacherName: '',
    date: todayStr(),
    numberOfClasses: '',
    teacherAttendance: null,
    classesTaken: '',
    subjectsTaught: '',
    topicsTaught: '',
    studentAttendanceMarked: null,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  useEffect(() => setMounted(true), []);

  const loadUserData = () => {
    const stored = getStoredUserData();
    const teacherName = stored?.name || '';
    setFormData((prev) => ({ ...prev, teacherName }));
  };

  const checkTodaySubmission = async () => {
    if (!formData.teacherName || !formData.date) return;
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_BASE}/teacher-daily-form/check-submission?teacherName=${encodeURIComponent(formData.teacherName)}&date=${formData.date}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data.success) setIsAlreadySubmitted(data.alreadySubmitted);
    } catch {
      // non-fatal — worst case the teacher sees the form and gets a duplicate error on submit
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
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (formData.teacherName && formData.date) checkTodaySubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.teacherName, formData.date]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkTodaySubmission();
    setRefreshing(false);
  };

  const handleFieldBlur = (fieldName: string) => setTouchedFields((prev) => new Set(prev).add(fieldName));
  const getFieldError = (fieldName: string) => (touchedFields.has(fieldName) ? formErrors[fieldName as keyof FormData] : undefined);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.teacherName.trim()) errors.teacherName = 'Teacher name is required';
    else if (formData.teacherName.trim().length < 2) errors.teacherName = 'Name must be at least 2 characters';

    if (!formData.date) errors.date = 'Date is required';
    if (formData.teacherAttendance === null) errors.teacherAttendance = 'Please select your attendance status';
    if (formData.hasClassToday === null) errors.hasClassToday = 'Please specify if you have class today';

    if (formData.hasClassToday) {
      if (!formData.numberOfClasses || parseInt(formData.numberOfClasses, 10) < 1) {
        errors.numberOfClasses = 'Number of classes must be at least 1';
      }
      if (!formData.classesTaken.trim()) errors.classesTaken = 'Please enter the classes taken';
      if (!formData.subjectsTaught.trim()) errors.subjectsTaught = 'Please enter subjects taught';
      if (!formData.topicsTaught.trim()) errors.topicsTaught = 'Please enter topics taught';
      if (formData.studentAttendanceMarked === null) errors.studentAttendanceMarked = 'Please specify if attendance was marked';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCompletionPercentage = (): number => {
    const requiredFields = formData.hasClassToday ? REQUIRED_FIELDS_WITH_CLASS : REQUIRED_FIELDS_NO_CLASS;
    const filledCount = requiredFields.filter((field) => {
      const value = formData[field];
      return value !== null && value !== '' && value !== undefined;
    }).length;
    return Math.round((filledCount / requiredFields.length) * 100);
  };

  const handleSubmit = async () => {
    const allFields = new Set([
      'hasClassToday',
      'teacherName',
      'date',
      'teacherAttendance',
      ...(formData.hasClassToday ? ['numberOfClasses', 'classesTaken', 'subjectsTaught', 'topicsTaught', 'studentAttendanceMarked'] : []),
    ]);
    setTouchedFields(allFields);

    if (!validateForm()) {
      setNotice({ type: 'error', title: 'Validation error', message: 'Please fill all required fields correctly' });
      return;
    }

    try {
      setIsSubmitting(true);

      const submitData: any = {
        hasClassToday: formData.hasClassToday,
        teacherName: formData.teacherName.trim(),
        date: formData.date,
        teacherAttendance: formData.teacherAttendance,
      };

      if (formData.hasClassToday) {
        submitData.numberOfClasses = parseInt(formData.numberOfClasses, 10);
        submitData.classesTaken = formData.classesTaken.trim();
        submitData.subjectsTaught = formData.subjectsTaught.trim();
        submitData.topicsTaught = formData.topicsTaught.trim();
        submitData.studentAttendanceMarked = formData.studentAttendanceMarked;
      }

      const response = await fetch(`${API_BASE}/teacher-daily-form/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success) {
        setIsAlreadySubmitted(true);
        setNotice({ type: 'success', title: 'Success', message: 'Your daily form has been submitted successfully.' });
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to submit form' });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const completion = getCompletionPercentage();

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
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-6 py-4">
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
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Daily form</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Fill your daily teaching report</h1>
            </div>
          </div>
          {!isAlreadySubmitted && (
            <span className="flex-shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 font-mono text-[12.5px] font-bold text-emerald-400">
              {completion}%
            </span>
          )}
        </div>
      </header>

      {notice && (
        <div className="relative z-[5] mx-auto max-w-[720px] px-6 pt-4.5">
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

      <main className="relative z-[1] mx-auto max-w-[720px] px-6 pt-7">
        {/* date pill */}
        <div className={`mb-6 flex flex-wrap items-center gap-3 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-[13px] font-medium text-[#eef4f1]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                stroke="#34d399"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {formatDate(formData.date)}
          </span>
          {isAlreadySubmitted && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Submitted
            </span>
          )}
          {isLoading && !refreshing && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
          )}
        </div>

        {/* progress bar */}
        {!isAlreadySubmitted && (
          <div className={`mb-8 transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <div className="h-1.5 overflow-hidden rounded-full border border-emerald-400/20 bg-[#101d17]">
              <div className="h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-center text-[12.5px] text-[#8ea79c]">{completion === 100 ? 'Ready to submit!' : 'Complete all fields to submit'}</p>
          </div>
        )}

        {/* already submitted */}
        {isAlreadySubmitted ? (
          <div className={`flex flex-col items-center rounded-2xl border border-emerald-400/30 bg-[#101d17] px-6 py-12 text-center transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 font-serif text-lg font-semibold text-[#eef4f1]">Form already submitted</h2>
            <p className="mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-[#8ea79c]">
              You have already submitted the form for today. Each teacher can submit only once per day.
            </p>
          </div>
        ) : (
          <div className={`flex flex-col gap-8 transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            {/* basic information */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
              <h2 className="mb-5 font-serif text-lg font-semibold text-[#eef4f1]">Basic information</h2>

              <Field label="Teacher name" error={getFieldError('teacherName')}>
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/40 bg-[#0a120f] px-3.5 py-2.5">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z"
                      stroke="#34d399"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[14px] font-medium text-[#eef4f1]">{formData.teacherName || 'Loading…'}</span>
                </div>
              </Field>

              <Field label="Your attendance today" error={getFieldError('teacherAttendance')}>
                <div className="flex gap-3">
                  <ToggleChip
                    label="Present"
                    selected={formData.teacherAttendance === 'Present'}
                    activeColor="#4ade80"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, teacherAttendance: 'Present' }));
                      handleFieldBlur('teacherAttendance');
                    }}
                    icon={
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    }
                  />
                  <ToggleChip
                    label="Absent"
                    selected={formData.teacherAttendance === 'Absent'}
                    activeColor="#f87171"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, teacherAttendance: 'Absent' }));
                      handleFieldBlur('teacherAttendance');
                    }}
                    icon={<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
                  />
                </div>
              </Field>
            </section>

            {/* class information */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-6">
              <h2 className="mb-5 font-serif text-lg font-semibold text-[#eef4f1]">Class information</h2>

              <Field label="Do you have class today?" error={getFieldError('hasClassToday')}>
                <div className="flex gap-3">
                  <ToggleChip
                    label="Yes"
                    selected={formData.hasClassToday === true}
                    activeColor="#34d399"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, hasClassToday: true }));
                      handleFieldBlur('hasClassToday');
                    }}
                  />
                  <ToggleChip
                    label="No"
                    selected={formData.hasClassToday === false}
                    activeColor="#34d399"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        hasClassToday: false,
                        numberOfClasses: '',
                        classesTaken: '',
                        subjectsTaught: '',
                        topicsTaught: '',
                        studentAttendanceMarked: null,
                      }));
                      handleFieldBlur('hasClassToday');
                    }}
                  />
                </div>
              </Field>

              {formData.hasClassToday && (
                <>
                  <Field label="Number of classes" error={getFieldError('numberOfClasses')}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.numberOfClasses}
                      onChange={(e) => setFormData((prev) => ({ ...prev, numberOfClasses: e.target.value.replace(/[^0-9]/g, '') }))}
                      onBlur={() => handleFieldBlur('numberOfClasses')}
                      placeholder="Enter number of classes"
                      className={inputClass(!!getFieldError('numberOfClasses'))}
                    />
                  </Field>

                  <Field label="Classes taken" error={getFieldError('classesTaken')}>
                    <textarea
                      value={formData.classesTaken}
                      onChange={(e) => setFormData((prev) => ({ ...prev, classesTaken: e.target.value }))}
                      onBlur={() => handleFieldBlur('classesTaken')}
                      placeholder="e.g., Class 10-A, Class 10-B"
                      rows={2}
                      className={inputClass(!!getFieldError('classesTaken'))}
                    />
                  </Field>

                  <Field label="Subjects taught" error={getFieldError('subjectsTaught')}>
                    <textarea
                      value={formData.subjectsTaught}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subjectsTaught: e.target.value }))}
                      onBlur={() => handleFieldBlur('subjectsTaught')}
                      placeholder="e.g., Mathematics, Physics"
                      rows={2}
                      className={inputClass(!!getFieldError('subjectsTaught'))}
                    />
                  </Field>

                  <Field label="Topics taught" error={getFieldError('topicsTaught')}>
                    <textarea
                      value={formData.topicsTaught}
                      onChange={(e) => setFormData((prev) => ({ ...prev, topicsTaught: e.target.value }))}
                      onBlur={() => handleFieldBlur('topicsTaught')}
                      placeholder="Enter topics covered in today's classes"
                      rows={3}
                      className={inputClass(!!getFieldError('topicsTaught'))}
                    />
                  </Field>

                  <Field label="Student attendance marked?" error={getFieldError('studentAttendanceMarked')} last>
                    <div className="flex gap-3">
                      <ToggleChip
                        label="Yes"
                        selected={formData.studentAttendanceMarked === true}
                        activeColor="#34d399"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, studentAttendanceMarked: true }));
                          handleFieldBlur('studentAttendanceMarked');
                        }}
                      />
                      <ToggleChip
                        label="No"
                        selected={formData.studentAttendanceMarked === false}
                        activeColor="#34d399"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, studentAttendanceMarked: false }));
                          handleFieldBlur('studentAttendanceMarked');
                        }}
                      />
                    </div>
                  </Field>
                </>
              )}
            </section>

            {/* submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || completion < 100}
              className="flex items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-6 py-4 text-[15px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8ea79c]"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04140d]/30 border-t-[#04140d]" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {isSubmitting ? 'Submitting…' : 'Submit form'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

const inputClass = (hasError: boolean) =>
  `w-full resize-none rounded-xl border ${
    hasError ? 'border-red-400/60' : 'border-white/[0.08]'
  } bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/50 focus:outline-none`;

const Field: React.FC<{ label: string; error?: string; last?: boolean; children: React.ReactNode }> = ({ label, error, last, children }) => (
  <div className={last ? '' : 'mb-5'}>
    <label className="mb-2 block text-[13px] font-semibold text-[#8ea79c]">{label}</label>
    {children}
    {error && <p className="mt-1.5 text-[12px] text-red-300">{error}</p>}
  </div>
);

const ToggleChip: React.FC<{ label: string; selected: boolean; activeColor: string; onClick: () => void; icon?: React.ReactNode }> = ({
  label,
  selected,
  activeColor,
  onClick,
  icon,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-semibold transition-colors"
    style={
      selected
        ? { background: activeColor, borderColor: activeColor, color: '#04140d' }
        : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#8ea79c' }
    }
  >
    {icon && (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        {icon}
      </svg>
    )}
    {label}
  </button>
);

export default TeacherDailyFormScreen;