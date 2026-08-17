/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../lib/auth';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminComptestScreen.tsx (Expo) — full-length
// JEE/NEET mock tests. Same SUJHAV admin design language: bg #0a120f, cards
// #101d17, hairline white/[0.08] borders, emerald-400 primary accent, lime
// as this module's accent (matching its color on the dashboard), font-serif
// headings, font-mono numerals. Same backend routes as the Expo screen.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;
const CATEGORY_COLORS: Record<string, string> = { JEE: '#4ADE80', NEET: '#38BDF8' };

interface CompTest {
  _id: string;
  title: string;
  category: 'JEE' | 'NEET';
  duration: number;
  totalMarks: number;
  questionCount: number;
  mcqCount: number;
  subjectiveCount: number;
  subjectWiseCount: {
    Physics?: number;
    Chemistry?: number;
    Mathematics?: number;
    Biology?: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const emptyForm = { title: '', category: 'JEE' as 'JEE' | 'NEET', duration: '180' };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminComptestScreen() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tests, setTests] = useState<CompTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'JEE' | 'NEET'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<CompTest | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    fetchTests();
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

  const fetchTests = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/comp-tests?limit=100`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setTests(data.data);
      else pushToast('error', data.message || 'Failed to fetch tests');
    } catch {
      pushToast('error', 'Failed to fetch competitive tests');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTests = useMemo(() => {
    let f = [...tests];
    if (selectedCategory !== 'ALL') f = f.filter((t) => t.category === selectedCategory);
    if (selectedStatus === 'ACTIVE') f = f.filter((t) => t.isActive);
    else if (selectedStatus === 'INACTIVE') f = f.filter((t) => !t.isActive);
    return f;
  }, [tests, selectedCategory, selectedStatus]);

  const stats = useMemo(
    () => ({
      total: tests.length,
      active: tests.filter((t) => t.isActive).length,
      jee: tests.filter((t) => t.category === 'JEE').length,
      neet: tests.filter((t) => t.category === 'NEET').length,
    }),
    [tests]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setQuestionsFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (!form.title.trim()) return pushToast('error', 'Please enter a test title');
    if (!questionsFile) return pushToast('error', 'Please select an Excel file with questions');

    try {
      setIsCreating(true);
      const token = getToken();
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('duration', form.duration);
      fd.append('questionsFile', questionsFile, questionsFile.name);

      const res = await fetch(`${API_BASE_URL}/comp-tests`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Competitive test created');
        setShowCreateModal(false);
        resetForm();
        fetchTests();
      } else pushToast('error', data.message || 'Failed to create test');
    } catch {
      pushToast('error', 'Failed to create competitive test');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (testId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/comp-tests/${testId}/toggle-status`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', data.message || 'Status updated');
        fetchTests();
      } else pushToast('error', data.message || 'Failed to update status');
    } catch {
      pushToast('error', 'Failed to update test status');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE_URL}/comp-tests/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'Test deleted');
        fetchTests();
      } else pushToast('error', data.message || 'Failed to delete test');
    } catch {
      pushToast('error', 'Failed to delete test');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 h-[420px] w-[420px] rounded-full bg-lime-400 opacity-5 blur-md" />
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
                : t.type === 'error'
                  ? 'border-red-400/25 bg-red-400/10 text-red-300'
                  : 'border-sky-400/25 bg-sky-400/10 text-sky-300'
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
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-lime-400">Test series · Full length</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
                Mock Tests <span className="font-mono text-[13px] font-normal text-[#8ea79c]">({filteredTests.length})</span>
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">New test</span>
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* stats */}
        <section
          className={`mb-8 transition-all duration-500 delay-75 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="grid grid-cols-2 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-[#101d17] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
            <StatItem label="Total tests" value={stats.total} />
            <StatItem label="Active" value={stats.active} accent="text-emerald-400" />
            <StatItem label="JEE" value={stats.jee} accent="text-lime-400" />
            <StatItem label="NEET" value={stats.neet} accent="text-sky-400" />
          </div>
        </section>

        {/* filters */}
        <section
          className={`mb-6 flex flex-col gap-4 transition-all duration-500 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5c7469]">Category</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={selectedCategory === 'ALL'} color="#34d399" onClick={() => setSelectedCategory('ALL')}>
                All
              </FilterPill>
              {(['JEE', 'NEET'] as const).map((c) => (
                <FilterPill key={c} active={selectedCategory === c} color={CATEGORY_COLORS[c]} onClick={() => setSelectedCategory(c)}>
                  {c}
                </FilterPill>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[#5c7469]">Status</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={selectedStatus === 'ALL'} color="#34d399" onClick={() => setSelectedStatus('ALL')}>
                All
              </FilterPill>
              <FilterPill active={selectedStatus === 'ACTIVE'} color="#34d399" onClick={() => setSelectedStatus('ACTIVE')}>
                Active
              </FilterPill>
              <FilterPill active={selectedStatus === 'INACTIVE'} color="#f87171" onClick={() => setSelectedStatus('INACTIVE')}>
                Inactive
              </FilterPill>
            </div>
          </div>
        </section>

        {/* list */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[280px] animate-pulse rounded-2xl border border-white/[0.08] bg-[#101d17]" />
            ))}
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#101d17]/50 px-6 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12l2 2 4-4 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                  stroke="#A3E635"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-serif text-lg font-semibold text-[#eef4f1]">{tests.length === 0 ? 'No tests yet' : 'No matches found'}</p>
            <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[#8ea79c]">
              {tests.length === 0 ? 'Create your first full-length mock test to get started.' : 'Try a different category or status filter.'}
            </p>
            {tests.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-6 rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
              >
                Create test
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredTests.map((t) => (
              <TestCard
                key={t._id}
                test={t}
                onToggle={() => handleToggleStatus(t._id)}
                onDelete={() => setDeleteTarget(t)}
                onView={() => pushToast('info', 'Test details view coming soon')}
                onAttempts={() => pushToast('info', 'Test attempts view coming soon')}
              />
            ))}
          </div>
        )}
      </main>

      {/* create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-[#0d1712] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-lime-400">New entry</span>
                <h2 className="mt-0.5 font-serif text-lg font-semibold text-[#eef4f1]">Create test</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:border-red-400/30 hover:text-red-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <FormGroup label="Test title" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. JEE Main Full Mock — 04"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                />
              </FormGroup>

              <FormGroup label="Category" required>
                <div className="flex gap-2">
                  {(['JEE', 'NEET'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      style={form.category === c ? { borderColor: CATEGORY_COLORS[c], backgroundColor: `${CATEGORY_COLORS[c]}22`, color: CATEGORY_COLORS[c] } : undefined}
                      className={`flex-1 rounded-xl border py-2.5 text-[13.5px] font-semibold transition-colors ${
                        form.category === c ? '' : 'border-white/[0.08] bg-white/[0.04] text-[#8ea79c] hover:border-white/[0.16]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </FormGroup>

              <FormGroup label="Duration (minutes)" required>
                <input
                  type="number"
                  min={1}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="180"
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
                    {questionsFile ? questionsFile.name : 'Select Excel file'}
                  </span>
                </button>
              </FormGroup>

              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="9" stroke="#facc15" strokeWidth="1.7" />
                  <path d="M12 8h.01M11 11h1v5h1" stroke="#facc15" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[12px] leading-relaxed text-amber-300">
                  Excel columns: Question, Options (A, B, C, D), Correct Option, Marks, Subject
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                disabled={isCreating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? <Spinner /> : 'Create test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setDeleteTarget(null)}>
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
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Delete this test?</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">
              “{deleteTarget.title}” will be permanently removed. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatItem: React.FC<{ label: string; value: string | number; accent?: string }> = ({
  label,
  value,
  accent = 'text-[#eef4f1]',
}) => (
  <div className="flex flex-col items-center gap-1.5 px-4 py-5 text-center">
    <span className={`font-mono text-[22px] font-bold sm:text-[26px] ${accent}`}>{value}</span>
    <span className="text-[11.5px] text-[#8ea79c] sm:text-[12.5px]">{label}</span>
  </div>
);

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

const FormGroup: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div className="mb-5">
    <label className="mb-2 block text-[12.5px] font-semibold text-[#eef4f1]">
      {label} {required && <span className="text-lime-400">*</span>}
    </label>
    {children}
  </div>
);

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const TestCard: React.FC<{
  test: CompTest;
  onToggle: () => void;
  onDelete: () => void;
  onView: () => void;
  onAttempts: () => void;
}> = ({ test, onToggle, onDelete, onView, onAttempts }) => {
  const catColor = CATEGORY_COLORS[test.category] || '#34d399';
  const subjects = Object.entries(test.subjectWiseCount).filter(([, c]) => (c || 0) > 0);

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.16]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-serif text-[16px] font-semibold leading-snug text-[#eef4f1]">{test.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
              {test.category}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                test.isActive ? 'bg-emerald-400/12 text-emerald-300' : 'bg-red-400/12 text-red-300'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${test.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {test.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <MiniStat label="Questions" value={test.questionCount} />
        <MiniStat label="Minutes" value={test.duration} />
        <MiniStat label="Marks" value={test.totalMarks} />
      </div>

      <div className="mb-4 flex items-center gap-4 text-[12px] text-[#8ea79c]">
        <span>
          <span className="font-semibold text-[#c9dcd3]">{test.mcqCount}</span> MCQ
        </span>
        <span>
          <span className="font-semibold text-[#c9dcd3]">{test.subjectiveCount}</span> Subjective
        </span>
      </div>

      {subjects.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5c7469]">Subject distribution</p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map(([subject, count]) => (
              <span key={subject} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-[#c9dcd3]">
                {subject}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          onClick={onView}
          className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 py-2 text-[12px] font-semibold text-emerald-300 transition-colors hover:border-emerald-400/45"
        >
          View
        </button>
        <button
          onClick={onAttempts}
          className="rounded-lg border border-sky-400/25 bg-sky-400/10 py-2 text-[12px] font-semibold text-sky-300 transition-colors hover:border-sky-400/45"
        >
          Attempts
        </button>
        <button
          onClick={onToggle}
          className={`rounded-lg border py-2 text-[12px] font-semibold transition-colors ${
            test.isActive
              ? 'border-amber-400/25 bg-amber-400/10 text-amber-300 hover:border-amber-400/45'
              : 'border-lime-400/25 bg-lime-400/10 text-lime-300 hover:border-lime-400/45'
          }`}
        >
          {test.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg border border-red-400/25 bg-red-400/10 py-2 text-[12px] font-semibold text-red-300 transition-colors hover:border-red-400/45"
        >
          Delete
        </button>
      </div>

      <p className="mt-4 border-t border-white/[0.06] pt-3 text-center text-[11px] text-[#5c7469]">
        Created {fmtDate(test.createdAt)}
      </p>
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
    <span className="font-mono text-[16px] font-bold text-[#eef4f1]">{value}</span>
    <span className="text-[10.5px] text-[#8ea79c]">{label}</span>
  </div>
);