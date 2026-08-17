/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-unused-expressions */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../lib/auth';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminComptestChapwiseScreen.tsx (Expo). Same
// SUJHAV admin design language: bg #0a120f, cards #101d17, hairline
// white/[0.08] borders, emerald-400 primary accent, font-serif headings,
// font-mono numerals. Same backend routes as the Expo screen. Three-level
// collapsible hierarchy: Subject doc -> Chapter -> Test.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;

const CATEGORY_COLORS: Record<string, string> = { JEE: '#4ADE80', NEET: '#38BDF8' };
const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#FB923C',
  Chemistry: '#C084FC',
  Mathematics: '#F87171',
  Biology: '#4ADE80',
};

interface ChapterTest {
  _id: string;
  title: string;
  testNumber: number;
  duration: number;
  totalMarks: number;
  questionCount: number;
  mcqCount: number;
  subjectiveCount: number;
  isActive: boolean;
}

interface Chapter {
  _id: string;
  name: string;
  subject: string;
  chapterNumber: number;
  description: string;
  tests: ChapterTest[];
  isActive: boolean;
}

interface SubjectDoc {
  _id: string;
  category: 'JEE' | 'NEET';
  subject: string;
  chapters: Chapter[];
  isActive: boolean;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const emptyChapterForm = {
  category: 'JEE' as 'JEE' | 'NEET',
  subject: 'Physics',
  name: '',
  chapterNumber: '',
  description: '',
};

const emptyTestForm = { title: '', testNumber: '', duration: '60' };

export default function AdminComptestChapwiseScreen() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [docs, setDocs] = useState<SubjectDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [selCategory, setSelCategory] = useState<'ALL' | 'JEE' | 'NEET'>('ALL');
  const [selSubject, setSelSubject] = useState<string>('ALL');

  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterForm, setChapterForm] = useState(emptyChapterForm);
  const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);

  const [showTestModal, setShowTestModal] = useState(false);
  const [testModalCtx, setTestModalCtx] = useState<{ docId: string; chapterId: string } | null>(null);
  const [testForm, setTestForm] = useState(emptyTestForm);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chapterDeleteTarget, setChapterDeleteTarget] = useState<{ docId: string; chapterId: string; name: string } | null>(null);
  const [testDeleteTarget, setTestDeleteTarget] = useState<{ docId: string; chapterId: string; testId: string; title: string } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushToast = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };

  const getHeaders = (): Record<string, string> => {
    const token = getToken();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const fetchDocs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/comp-tests-chap`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setDocs(data.data);
      else pushToast('error', data.message || 'Failed to fetch data');
    } catch {
      pushToast('error', 'Failed to fetch chapter-wise tests');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocs = useMemo(() => {
    let f = [...docs];
    if (selCategory !== 'ALL') f = f.filter((d) => d.category === selCategory);
    if (selSubject !== 'ALL') f = f.filter((d) => d.subject === selSubject);
    return f;
  }, [docs, selCategory, selSubject]);

  const subjectOptionsForFilter = useMemo(() => {
    const subjects = new Set(docs.map((d) => d.subject));
    return ['ALL', ...Array.from(subjects)];
  }, [docs]);

  // ── Chapter CRUD ──

  const handleCreateChapter = async () => {
    if (!chapterForm.name.trim()) return pushToast('error', 'Chapter name is required');
    if (!chapterForm.chapterNumber) return pushToast('error', 'Chapter number is required');

    try {
      setIsSubmittingChapter(true);
      const res = await fetch(`${API_BASE_URL}/comp-tests-chap/chapters`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(chapterForm),
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Chapter created');
        setShowChapterModal(false);
        setChapterForm(emptyChapterForm);
        fetchDocs();
      } else pushToast('error', data.message || 'Failed to create chapter');
    } catch {
      pushToast('error', 'Failed to create chapter');
    } finally {
      setIsSubmittingChapter(false);
    }
  };

  const handleToggleChapter = async (docId: string, chapterId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/comp-tests-chap/${docId}/chapters/${chapterId}/toggle`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) fetchDocs();
      else pushToast('error', data.message || 'Failed to toggle chapter');
    } catch {
      pushToast('error', 'Failed to toggle chapter status');
    }
  };

  const confirmDeleteChapter = async () => {
    if (!chapterDeleteTarget) return;
    const { docId, chapterId } = chapterDeleteTarget;
    try {
      const res = await fetch(`${API_BASE_URL}/comp-tests-chap/${docId}/chapters/${chapterId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Chapter deleted');
        fetchDocs();
      } else pushToast('error', data.message || 'Failed to delete');
    } catch {
      pushToast('error', 'Failed to delete chapter');
    } finally {
      setChapterDeleteTarget(null);
    }
  };

  // ── Test CRUD ──

  const openTestModal = (docId: string, chapterId: string) => {
    setTestModalCtx({ docId, chapterId });
    setTestForm(emptyTestForm);
    setQuestionsFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowTestModal(true);
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const okTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ];
    if (!okTypes.includes(f.type) && !/\.(xlsx|xls|xlsm)$/i.test(f.name)) {
      pushToast('error', 'Please select an Excel file (.xlsx, .xls)');
      return;
    }
    setQuestionsFile(f);
  };

  const handleCreateTest = async () => {
    if (!testModalCtx) return;
    if (!testForm.title.trim()) return pushToast('error', 'Test title is required');
    if (!testForm.testNumber) return pushToast('error', 'Test number is required');
    if (!questionsFile) return pushToast('error', 'Please select an Excel file');

    try {
      setIsSubmittingTest(true);
      const fd = new FormData();
      fd.append('title', testForm.title);
      fd.append('testNumber', testForm.testNumber);
      fd.append('duration', testForm.duration);
      fd.append('questionsFile', questionsFile, questionsFile.name);

      const { docId, chapterId } = testModalCtx;
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/comp-tests-chap/${docId}/chapters/${chapterId}/tests`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Test created');
        setShowTestModal(false);
        fetchDocs();
      } else pushToast('error', data.message || 'Failed to create test');
    } catch {
      pushToast('error', 'Failed to create test');
    } finally {
      setIsSubmittingTest(false);
    }
  };

  const handleToggleTest = async (docId: string, chapterId: string, testId: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/comp-tests-chap/${docId}/chapters/${chapterId}/tests/${testId}/toggle`,
        { method: 'PATCH', headers: getHeaders() }
      );
      const data = await res.json();
      if (data.success) fetchDocs();
      else pushToast('error', data.message || 'Failed to toggle test');
    } catch {
      pushToast('error', 'Failed to toggle test status');
    }
  };

  const confirmDeleteTest = async () => {
    if (!testDeleteTarget) return;
    const { docId, chapterId, testId } = testDeleteTarget;
    try {
      const res = await fetch(
        `${API_BASE_URL}/comp-tests-chap/${docId}/chapters/${chapterId}/tests/${testId}`,
        { method: 'DELETE', headers: getHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Test deleted');
        fetchDocs();
      } else pushToast('error', data.message || 'Failed to delete test');
    } catch {
      pushToast('error', 'Failed to delete test');
    } finally {
      setTestDeleteTarget(null);
    }
  };

  const toggleDoc = (id: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const subjectOptionsForModal = chapterForm.category === 'JEE' ? ['Physics', 'Chemistry', 'Mathematics'] : ['Physics', 'Chemistry', 'Biology'];

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 h-[420px] w-[420px] rounded-full bg-orange-400 opacity-5 blur-md" />
        <div className="absolute -left-36 bottom-16 h-[300px] w-[300px] rounded-full bg-emerald-400 opacity-[0.035] blur-md" />
      </div>

      {/* toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-[13.5px] font-medium shadow-lg backdrop-blur-md ${
              t.type === 'success'
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-red-400/25 bg-red-400/10 text-red-300'
            }`}
          >
            {t.message}
          </div>
        ))}
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
              onClick={() => router.push('/AdminDashboardScreen')}
              aria-label="Back to dashboard"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:border-white/[0.16] hover:text-[#eef4f1]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-orange-400">Test series · Chapter-wise</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
                Chapter-wise Tests <span className="font-mono text-[13px] font-normal text-[#8ea79c]">({filteredDocs.length})</span>
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowChapterModal(true)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">New chapter</span>
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* filters */}
        <section
          className={`mb-6 flex flex-col gap-4 transition-all duration-500 delay-75 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5c7469]">Category</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={selCategory === 'ALL'} color="#34d399" onClick={() => setSelCategory('ALL')}>
                All
              </FilterPill>
              {(['JEE', 'NEET'] as const).map((c) => (
                <FilterPill key={c} active={selCategory === c} color={CATEGORY_COLORS[c]} onClick={() => setSelCategory(c)}>
                  {c}
                </FilterPill>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5c7469]">Subject</p>
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {subjectOptionsForFilter.map((s) => (
                <FilterPill
                  key={s}
                  active={selSubject === s}
                  color={s === 'ALL' ? '#34d399' : SUBJECT_COLORS[s] || '#34d399'}
                  onClick={() => setSelSubject(s)}
                >
                  {s === 'ALL' ? 'All' : s}
                </FilterPill>
              ))}
            </div>
          </div>
        </section>

        {/* content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-white/[0.08] bg-[#101d17]" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#101d17]/50 px-6 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-400/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z M9 7h7M9 11h7"
                  stroke="#FB923C"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-serif text-lg font-semibold text-[#eef4f1]">{docs.length === 0 ? 'No data yet' : 'No matches found'}</p>
            <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[#8ea79c]">
              {docs.length === 0 ? 'Create your first chapter to get started.' : 'Try a different category or subject filter.'}
            </p>
            {docs.length === 0 && (
              <button
                onClick={() => setShowChapterModal(true)}
                className="mt-6 rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
              >
                Create chapter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDocs.map((doc) => (
              <SubjectDocCard
                key={doc._id}
                doc={doc}
                expanded={expandedDocs.has(doc._id)}
                onToggle={() => toggleDoc(doc._id)}
                expandedChapters={expandedChapters}
                onToggleChapter={toggleChapter}
                onToggleChapterActive={handleToggleChapter}
                onDeleteChapter={(chapterId, name) => setChapterDeleteTarget({ docId: doc._id, chapterId, name })}
                onAddTest={(chapterId) => openTestModal(doc._id, chapterId)}
                onToggleTest={handleToggleTest}
                onDeleteTest={(chapterId, testId, title) => setTestDeleteTarget({ docId: doc._id, chapterId, testId, title })}
              />
            ))}
          </div>
        )}
      </main>

      {/* create chapter modal */}
      {showChapterModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setShowChapterModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-[#0d1712] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-orange-400">New entry</span>
                <h2 className="mt-0.5 font-serif text-lg font-semibold text-[#eef4f1]">Create chapter</h2>
              </div>
              <ModalCloseBtn onClick={() => setShowChapterModal(false)} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <FormGroup label="Category" required>
                <div className="flex gap-2">
                  {(['JEE', 'NEET'] as const).map((c) => (
                    <Chip
                      key={c}
                      active={chapterForm.category === c}
                      color={CATEGORY_COLORS[c]}
                      onClick={() => setChapterForm((p) => ({ ...p, category: c, subject: 'Physics' }))}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </FormGroup>

              <FormGroup label="Subject" required>
                <div className="flex flex-wrap gap-2">
                  {subjectOptionsForModal.map((s) => (
                    <Chip
                      key={s}
                      active={chapterForm.subject === s}
                      color={SUBJECT_COLORS[s] || '#34d399'}
                      onClick={() => setChapterForm((p) => ({ ...p, subject: s }))}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </FormGroup>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <FormGroup label="Chapter no." required>
                    <input
                      type="number"
                      min={1}
                      value={chapterForm.chapterNumber}
                      onChange={(e) => setChapterForm((p) => ({ ...p, chapterNumber: e.target.value }))}
                      placeholder="1"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                    />
                  </FormGroup>
                </div>
                <div className="sm:col-span-2">
                  <FormGroup label="Chapter name" required>
                    <input
                      value={chapterForm.name}
                      onChange={(e) => setChapterForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Kinematics"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                    />
                  </FormGroup>
                </div>
              </div>

              <FormGroup label="Description (optional)">
                <textarea
                  value={chapterForm.description}
                  onChange={(e) => setChapterForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Short description…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                />
              </FormGroup>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                onClick={() => setShowChapterModal(false)}
                disabled={isSubmittingChapter}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChapter}
                disabled={isSubmittingChapter}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingChapter ? <Spinner /> : 'Create chapter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* create test modal */}
      {showTestModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setShowTestModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-[#0d1712] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-orange-400">New entry</span>
                <h2 className="mt-0.5 font-serif text-lg font-semibold text-[#eef4f1]">Add test</h2>
              </div>
              <ModalCloseBtn onClick={() => setShowTestModal(false)} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormGroup label="Test number" required>
                  <input
                    type="number"
                    min={1}
                    value={testForm.testNumber}
                    onChange={(e) => setTestForm((p) => ({ ...p, testNumber: e.target.value }))}
                    placeholder="1"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                  />
                </FormGroup>
                <FormGroup label="Duration (min)" required>
                  <input
                    type="number"
                    min={1}
                    value={testForm.duration}
                    onChange={(e) => setTestForm((p) => ({ ...p, duration: e.target.value }))}
                    placeholder="60"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                  />
                </FormGroup>
              </div>

              <FormGroup label="Test title" required>
                <input
                  value={testForm.title}
                  onChange={(e) => setTestForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Kinematics Practice Set 1"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                />
              </FormGroup>

              <FormGroup label="Questions Excel file" required>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2.5 rounded-xl border-2 border-dashed border-emerald-400/35 bg-emerald-400/[0.05] px-4 py-4 text-left transition-colors hover:border-emerald-400/60"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                    <path
                      d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"
                      stroke="#34d399"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="truncate text-[13px] font-semibold text-emerald-300">
                    {questionsFile ? questionsFile.name : 'Tap to select Excel file'}
                  </span>
                </button>
              </FormGroup>

              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="9" stroke="#facc15" strokeWidth="1.7" />
                  <path d="M12 8h.01M11 11h1v5h1" stroke="#facc15" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[12px] leading-relaxed text-amber-300">
                  Excel columns: Question, A, B, C, D, Correct Option, Marks, Subject
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                onClick={() => setShowTestModal(false)}
                disabled={isSubmittingTest}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                disabled={isSubmittingTest}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingTest ? <Spinner /> : 'Create test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete chapter confirm */}
      {chapterDeleteTarget && (
        <ConfirmDeleteModal
          title="Delete this chapter?"
          message={`"${chapterDeleteTarget.name}" and all its tests will be permanently removed. This can't be undone.`}
          onCancel={() => setChapterDeleteTarget(null)}
          onConfirm={confirmDeleteChapter}
        />
      )}

      {/* delete test confirm */}
      {testDeleteTarget && (
        <ConfirmDeleteModal
          title="Delete this test?"
          message={`"${testDeleteTarget.title}" will be permanently removed. This can't be undone.`}
          onCancel={() => setTestDeleteTarget(null)}
          onConfirm={confirmDeleteTest}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FilterPill: React.FC<{ active: boolean; color: string; onClick: () => void; children: React.ReactNode }> = ({
  active,
  color,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    style={active ? { borderColor: color, backgroundColor: `${color}22`, color } : undefined}
    className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
      active ? '' : 'border-white/[0.08] bg-[#101d17] text-[#8ea79c] hover:border-white/[0.16]'
    }`}
  >
    {children}
  </button>
);

const Chip: React.FC<{ active: boolean; color: string; onClick: () => void; children: React.ReactNode }> = ({
  active,
  color,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={active ? { borderColor: color, backgroundColor: `${color}22`, color } : undefined}
    className={`rounded-lg border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
      active ? '' : 'border-white/[0.08] bg-white/[0.04] text-[#8ea79c] hover:border-white/[0.16]'
    }`}
  >
    {children}
  </button>
);

const FormGroup: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div className="mb-5">
    <label className="mb-2 block text-[12.5px] font-semibold text-[#eef4f1]">
      {label} {required && <span className="text-orange-400">*</span>}
    </label>
    {children}
  </div>
);

const ModalCloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    aria-label="Close"
    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:border-red-400/30 hover:text-red-300"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </button>
);

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const ConfirmDeleteModal: React.FC<{
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, message, onCancel, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
              stroke="#f87171"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
            disabled={busy}
            className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SubjectDocCard: React.FC<{
  doc: SubjectDoc;
  expanded: boolean;
  onToggle: () => void;
  expandedChapters: Set<string>;
  onToggleChapter: (id: string) => void;
  onToggleChapterActive: (docId: string, chapterId: string) => void;
  onDeleteChapter: (chapterId: string, name: string) => void;
  onAddTest: (chapterId: string) => void;
  onToggleTest: (docId: string, chapterId: string, testId: string) => void;
  onDeleteTest: (chapterId: string, testId: string, title: string) => void;
}> = ({
  doc,
  expanded,
  onToggle,
  expandedChapters,
  onToggleChapter,
  onToggleChapterActive,
  onDeleteChapter,
  onAddTest,
  onToggleTest,
  onDeleteTest,
}) => {
  const catColor = CATEGORY_COLORS[doc.category] || '#34d399';
  const subColor = SUBJECT_COLORS[doc.subject] || '#eef4f1';
  const totalChapters = doc.chapters.length;
  const totalTests = doc.chapters.reduce((s, c) => s + c.tests.length, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17]">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${catColor}20`, color: catColor }}
          >
            {doc.category}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: `${subColor}20`, color: subColor }}
          >
            {doc.subject}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-4">
          <div className="hidden text-center sm:block">
            <p className="font-mono text-[17px] font-bold text-[#eef4f1]">{totalChapters}</p>
            <p className="text-[10.5px] text-[#8ea79c]">Chapters</p>
          </div>
          <div className="hidden h-8 w-px bg-white/[0.1] sm:block" />
          <div className="hidden text-center sm:block">
            <p className="font-mono text-[17px] font-bold text-[#eef4f1]">{totalTests}</p>
            <p className="text-[10.5px] text-[#8ea79c]">Tests</p>
          </div>
          <span className="font-mono text-[12px] text-[#8ea79c] sm:hidden">
            {totalChapters}ch · {totalTests}t
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className={`text-[#8ea79c] transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-4 sm:px-5">
          {doc.chapters.length === 0 ? (
            <p className="py-3 text-center text-[13px] text-[#5c7469]">No chapters yet.</p>
          ) : (
            doc.chapters.map((ch) => (
              <ChapterCard
                key={ch._id}
                chapter={ch}
                expanded={expandedChapters.has(ch._id)}
                onToggle={() => onToggleChapter(ch._id)}
                onToggleActive={() => onToggleChapterActive(doc._id, ch._id)}
                onDelete={() => onDeleteChapter(ch._id, ch.name)}
                onAddTest={() => onAddTest(ch._id)}
                onToggleTest={(testId) => onToggleTest(doc._id, ch._id, testId)}
                onDeleteTest={(testId, title) => onDeleteTest(ch._id, testId, title)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ChapterCard: React.FC<{
  chapter: Chapter;
  expanded: boolean;
  onToggle: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onAddTest: () => void;
  onToggleTest: (testId: string) => void;
  onDeleteTest: (testId: string, title: string) => void;
}> = ({ chapter, expanded, onToggle, onToggleActive, onDelete, onAddTest, onToggleTest, onDeleteTest }) => (
  <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-bold ${
            chapter.isActive ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : 'border-white/[0.1] bg-white/[0.04] text-[#5c7469]'
          }`}
        >
          {chapter.chapterNumber}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-[14px] font-semibold ${chapter.isActive ? 'text-[#eef4f1]' : 'text-[#5c7469]'}`}>{chapter.name}</p>
          <p className="truncate text-[11.5px] text-[#8ea79c]">
            {chapter.tests.length} test{chapter.tests.length !== 1 ? 's' : ''}
            {chapter.description ? ` · ${chapter.description}` : ''}
          </p>
        </div>
      </button>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          onClick={onToggleActive}
          aria-label={chapter.isActive ? 'Hide chapter' : 'Show chapter'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#8ea79c] transition-colors hover:bg-white/[0.06]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            {chapter.isActive ? (
              <>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" stroke="#34d399" strokeWidth="1.7" />
              </>
            ) : (
              <path
                d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a20.3 20.3 0 015.06-5.94M9.9 4.24A10.9 10.9 0 0112 4c7 0 11 8 11 8a20.3 20.3 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete chapter"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#8ea79c] transition-colors hover:bg-red-400/10 hover:text-red-300"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button onClick={onToggle} aria-label="Expand chapter" className="flex h-7 w-7 items-center justify-center rounded-full text-[#8ea79c] transition-colors hover:bg-white/[0.06]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    {expanded && (
      <div className="space-y-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
        {chapter.tests.length === 0 ? (
          <p className="py-2 text-center text-[12.5px] text-[#5c7469]">No tests yet in this chapter.</p>
        ) : (
          chapter.tests.map((t) => (
            <TestCard key={t._id} test={t} onToggle={() => onToggleTest(t._id)} onDelete={() => onDeleteTest(t._id, t.title)} />
          ))
        )}
        <button
          onClick={onAddTest}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] py-2.5 text-[12.5px] font-semibold text-emerald-300 transition-colors hover:border-emerald-400/50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add test
        </button>
      </div>
    )}
  </div>
);

const TestCard: React.FC<{ test: ChapterTest; onToggle: () => void; onDelete: () => void }> = ({ test, onToggle, onDelete }) => (
  <div className="rounded-lg border border-white/[0.06] bg-[#0a120f] p-3">
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-[#eef4f1]">
          Test {test.testNumber}: {test.title}
        </p>
        <p className="mt-1 truncate text-[11px] text-[#8ea79c]">
          {test.questionCount} Qs · {test.totalMarks} Marks · {test.duration} min · {test.mcqCount} MCQ / {test.subjectiveCount} Subj
        </p>
      </div>
      <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${test.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
    </div>
    <div className="flex gap-2">
      <button
        onClick={onToggle}
        className={`flex-1 rounded-md border py-1.5 text-[11px] font-semibold transition-colors ${
          test.isActive
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:border-emerald-400/45'
            : 'border-red-400/25 bg-red-400/10 text-red-300 hover:border-red-400/45'
        }`}
      >
        {test.isActive ? 'Active' : 'Inactive'}
      </button>
      <button
        onClick={onDelete}
        className="flex-1 rounded-md border border-red-400/25 bg-red-400/10 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:border-red-400/45"
      >
        Delete
      </button>
    </div>
  </div>
);