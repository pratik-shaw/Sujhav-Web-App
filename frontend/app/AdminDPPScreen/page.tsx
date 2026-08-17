/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/purity */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../lib/auth';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminDPPScreen.tsx (Expo). Same SUJHAV
// web design language as AdminDashboardScreen: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 primary accent, sky-400 as the
// DPP-module accent (matching its color on the dashboard), font-serif
// headings, font-mono for numerals. Same backend routes as the Expo screen.
// ---------------------------------------------------------------------------

const API = API_BASE;

const BOARD_CONFIG = {
  JEE: { classes: ['11', '12'], subjects: ['Physics', 'Chemistry', 'Mathematics'] },
  NEET: { classes: ['11', '12'], subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] },
  CBSE: {
    classes: ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
    subjects: {
      '4-10': ['Science', 'Social Studies', 'Mathematics', 'English', 'Hindi', 'Computer'],
      '11-12': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'Hindi', 'Computer'],
    },
  },
  ICSE: {
    classes: ['4', '5', '6', '7', '8', '9', '10'],
    subjects: ['Science', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'History', 'Geography', 'Hindi', 'Computer'],
  },
  ISC: {
    classes: ['11', '12'],
    subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer'],
  },
} as const;

type Board = keyof typeof BOARD_CONFIG;
const BOARDS: Board[] = ['JEE', 'NEET', 'CBSE', 'ICSE', 'ISC'];

interface DPPFile {
  originalName: string;
  fileSize: number;
  pages: number;
  uploadedAt: string;
}

interface DPP {
  _id?: string;
  title: string;
  board: string;
  class: string;
  subject: string;
  questionPDF: DPPFile;
  answerPDF?: DPPFile;
  questionActive: boolean;
  answerActive: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const emptyForm = {
  title: '',
  board: 'JEE' as Board,
  class: '',
  subject: '',
  questionActive: true,
  answerActive: false,
  questionPages: 0,
  answerPages: 0,
};

const fmtBytes = (b: number) => {
  if (!b) return '0 B';
  const k = 1024;
  const sz = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sz[i]}`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminDPPScreen() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [dpps, setDpps] = useState<DPP[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState<Board | 'ALL'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingDPP, setEditingDPP] = useState<DPP | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [qPDF, setQPDF] = useState<File | null>(null);
  const [aPDF, setAPDF] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DPP | null>(null);

  const qInputRef = useRef<HTMLInputElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    loadDPPs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushToast = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };

  const availableSubjects = useMemo(() => {
    const config = BOARD_CONFIG[form.board];
    if (!config) return [] as string[];
    if (form.board === 'CBSE') {
      const c = parseInt(form.class, 10);
      const cbse = config.subjects as unknown as { '4-10': string[]; '11-12': string[] };
      if (c >= 4 && c <= 10) return cbse['4-10'];
      if (c >= 11 && c <= 12) return cbse['11-12'];
      return [];
    }
    return config.subjects as unknown as string[];
  }, [form.board, form.class]);

  const loadDPPs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/dpp?limit=1000`);
      const data = await res.json();
      if (data.success) setDpps(data.data || []);
      else pushToast('error', data.message || 'Failed to load DPPs');
    } catch {
      pushToast('error', 'Failed to load DPPs');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setQPDF(null);
    setAPDF(null);
    setEditingDPP(null);
    if (qInputRef.current) qInputRef.current.value = '';
    if (aInputRef.current) aInputRef.current.value = '';
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (d: DPP) => {
    setForm({
      title: d.title,
      board: d.board as Board,
      class: d.class,
      subject: d.subject,
      questionActive: d.questionActive,
      answerActive: d.answerActive,
      questionPages: d.questionPDF?.pages || 0,
      answerPages: d.answerPDF?.pages || 0,
    });
    setEditingDPP(d);
    setQPDF(null);
    setAPDF(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const pickPDF = (type: 'q' | 'a', file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      pushToast('error', 'Please select a PDF file');
      return;
    }
    if (type === 'q') setQPDF(file);
    else setAPDF(file);
  };

  const saveDPP = async () => {
    if (!form.title.trim() || !form.class.trim() || !form.subject.trim()) {
      pushToast('error', 'Title, class, and subject are required');
      return;
    }
    if (!editingDPP && !qPDF) {
      pushToast('error', 'Question PDF is required');
      return;
    }

    try {
      setSaving(true);
      const url = editingDPP ? `${API}/dpp/${editingDPP._id}` : `${API}/dpp`;
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('board', form.board);
      fd.append('class', form.class.trim());
      fd.append('subject', form.subject.trim());
      fd.append('questionActive', String(form.questionActive));
      fd.append('answerActive', String(form.answerActive));
      fd.append('questionPages', String(form.questionPages));
      fd.append('answerPages', String(form.answerPages));
      if (qPDF) fd.append('questionPDF', qPDF, qPDF.name);
      if (aPDF) fd.append('answerPDF', aPDF, aPDF.name);

      const res = await fetch(url, { method: editingDPP ? 'PUT' : 'POST', body: fd });
      const data = await res.json();

      if (data.success) {
        pushToast('success', editingDPP ? 'DPP updated' : 'DPP created');
        closeModal();
        loadDPPs();
      } else {
        pushToast('error', data.message || 'Failed to save DPP');
      }
    } catch {
      pushToast('error', 'Failed to save DPP');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/dpp/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        pushToast('success', 'DPP deleted');
        loadDPPs();
      } else pushToast('error', data.message || 'Failed to delete');
    } catch {
      pushToast('error', 'Failed to delete');
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  const toggleAnswer = async (id?: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/dpp/${id}/toggle-answer`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        pushToast('success', data.message || 'Answer visibility updated');
        loadDPPs();
      } else pushToast('error', data.message || 'Failed to toggle');
    } catch {
      pushToast('error', 'Failed to toggle');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return dpps.filter((d) => {
      const matchesBoard = boardFilter === 'ALL' || d.board === boardFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.class.toLowerCase().includes(q);
      return matchesBoard && matchesSearch;
    });
  }, [dpps, search, boardFilter]);

  const stats = useMemo(
    () => ({
      total: dpps.length,
      qActive: dpps.filter((d) => d.questionActive).length,
      aActive: dpps.filter((d) => d.answerActive).length,
      views: dpps.reduce((s, d) => s + (d.viewCount || 0), 0),
    }),
    [dpps]
  );

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      {/* ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 h-[420px] w-[420px] rounded-full bg-sky-400 opacity-5 blur-md" />
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
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-sky-400">Content · DPPs</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Daily Practice Problems</h1>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Add DPP</span>
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* quick stats */}
        <section
          className={`mb-8 transition-all duration-500 delay-75 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="grid grid-cols-2 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-[#101d17] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
            <StatItem label="Total DPPs" value={stats.total} />
            <StatItem label="Question active" value={stats.qActive} accent="text-sky-400" />
            <StatItem label="Answer active" value={stats.aActive} accent="text-lime-400" />
            <StatItem label="Total views" value={stats.views} />
          </div>
        </section>

        {/* filters */}
        <section
          className={`mb-6 flex flex-col gap-3 transition-all duration-500 delay-100 sm:flex-row sm:items-center sm:justify-between ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          <div className="relative w-full sm:max-w-xs">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c7469]"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, subject, class…"
              className="w-full rounded-full border border-white/[0.08] bg-[#101d17] py-2.5 pl-9 pr-4 text-[13.5px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
            />
          </div>

          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <FilterChip active={boardFilter === 'ALL'} onClick={() => setBoardFilter('ALL')}>
              All boards
            </FilterChip>
            {BOARDS.map((b) => (
              <FilterChip key={b} active={boardFilter === b} onClick={() => setBoardFilter(b)}>
                {b}
              </FilterChip>
            ))}
          </div>
        </section>

        {/* list */}
        {loading && !dpps.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[220px] animate-pulse rounded-2xl border border-white/[0.08] bg-[#101d17]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#101d17]/50 px-6 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-400/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 11l2 2 4-4 M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                  stroke="#38BDF8"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-serif text-lg font-semibold text-[#eef4f1]">
              {dpps.length === 0 ? 'No DPPs yet' : 'No matches found'}
            </p>
            <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[#8ea79c]">
              {dpps.length === 0
                ? 'Publish your first daily practice problem set to get started.'
                : 'Try a different search term or board filter.'}
            </p>
            {dpps.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-6 rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
              >
                Create first DPP
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d, idx) => (
              <DPPCard
                key={d._id || idx}
                dpp={d}
                onEdit={() => openEdit(d)}
                onToggleAnswer={() => toggleAnswer(d._id)}
                onDelete={() => setDeleteTarget(d)}
              />
            ))}
          </div>
        )}
      </main>

      {/* add / edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={closeModal}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-[#0d1712] shadow-2xl sm:max-w-xl sm:rounded-2xl"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-sky-400">
                  {editingDPP ? 'Edit' : 'New'} entry
                </span>
                <h2 className="mt-0.5 font-serif text-lg font-semibold text-[#eef4f1]">
                  {editingDPP ? 'Edit DPP' : 'Add DPP'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:border-red-400/30 hover:text-red-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <FormGroup label="Title" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Rotational Mechanics — Set 4"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7469] outline-none transition-colors focus:border-emerald-400/40"
                />
              </FormGroup>

              <FormGroup label="Board" required>
                <div className="flex flex-wrap gap-2">
                  {BOARDS.map((b) => (
                    <Chip
                      key={b}
                      active={form.board === b}
                      onClick={() => setForm({ ...form, board: b, class: '', subject: '' })}
                    >
                      {b}
                    </Chip>
                  ))}
                </div>
              </FormGroup>

              <FormGroup label="Class" required>
                <div className="flex flex-wrap gap-2">
                  {BOARD_CONFIG[form.board]?.classes.map((c) => (
                    <Chip key={c} active={form.class === c} onClick={() => setForm({ ...form, class: c, subject: '' })}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </FormGroup>

              <FormGroup label="Subject" required>
                <div className="flex flex-wrap gap-2">
                  {availableSubjects.length === 0 && (
                    <span className="text-[12.5px] text-[#5c7469]">Select a class to see subjects</span>
                  )}
                  {availableSubjects.map((s) => (
                    <Chip key={s} active={form.subject === s} onClick={() => setForm({ ...form, subject: s })}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </FormGroup>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormGroup label="Question PDF" required>
                  <UploadButton
                    file={qPDF}
                    inputRef={qInputRef}
                    onPick={(f) => pickPDF('q', f)}
                    existingName={editingDPP?.questionPDF?.originalName}
                  />
                </FormGroup>
                <FormGroup label="Question pages">
                  <input
                    type="number"
                    min={0}
                    value={form.questionPages}
                    onChange={(e) => setForm({ ...form, questionPages: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] outline-none transition-colors focus:border-emerald-400/40"
                  />
                </FormGroup>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormGroup label="Answer PDF">
                  <UploadButton
                    file={aPDF}
                    inputRef={aInputRef}
                    onPick={(f) => pickPDF('a', f)}
                    existingName={editingDPP?.answerPDF?.originalName}
                  />
                </FormGroup>
                <FormGroup label="Answer pages">
                  <input
                    type="number"
                    min={0}
                    value={form.answerPages}
                    onChange={(e) => setForm({ ...form, answerPages: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] outline-none transition-colors focus:border-emerald-400/40"
                  />
                </FormGroup>
              </div>

              <FormGroup label="Visibility">
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <ToggleRow
                    active={form.questionActive}
                    label="Question active"
                    onClick={() => setForm({ ...form, questionActive: !form.questionActive })}
                  />
                  <ToggleRow
                    active={form.answerActive}
                    label="Answer active"
                    onClick={() => setForm({ ...form, answerActive: !form.answerActive })}
                  />
                </div>
              </FormGroup>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-white/[0.08] px-6 py-4">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                Cancel
              </button>
              <button
                onClick={saveDPP}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Spinner /> : editingDPP ? 'Save changes' : 'Create DPP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setDeleteTarget(null)}
        >
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
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Delete this DPP?</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">
              “{deleteTarget.title}” will be permanently removed. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? 'Deleting…' : 'Delete'}
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
  accent = 'text-emerald-400',
}) => (
  <div className="flex flex-col items-center gap-1.5 px-4 py-5 text-center">
    <span className={`font-mono text-[22px] font-bold sm:text-[26px] ${accent}`}>{value}</span>
    <span className="text-[11.5px] text-[#8ea79c] sm:text-[12.5px]">{label}</span>
  </div>
);

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
      active
        ? 'border-sky-400 bg-sky-400/15 text-sky-300'
        : 'border-white/[0.08] bg-[#101d17] text-[#8ea79c] hover:border-white/[0.16]'
    }`}
  >
    {children}
  </button>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
      active
        ? 'border-emerald-400 bg-emerald-400 text-[#06170f]'
        : 'border-white/[0.08] bg-white/[0.04] text-[#8ea79c] hover:border-white/[0.16]'
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
      {label} {required && <span className="text-sky-400">*</span>}
    </label>
    {children}
  </div>
);

const ToggleRow: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-1 items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
      active
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
        : 'border-white/[0.08] bg-white/[0.04] text-[#8ea79c]'
    }`}
  >
    {label}
    <span
      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
        active ? 'bg-emerald-400' : 'bg-white/[0.12]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#0a120f] transition-transform ${
          active ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </span>
  </button>
);

const UploadButton: React.FC<{
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File | undefined) => void;
  existingName?: string;
}> = ({ file, inputRef, onPick, existingName }) => (
  <div>
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => onPick(e.target.files?.[0])}
    />
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sky-400/35 bg-sky-400/[0.04] px-4 py-5 text-center transition-colors hover:border-sky-400/60"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="#38BDF8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[12.5px] font-semibold text-sky-300">{file ? 'Change PDF' : 'Select PDF'}</span>
    </button>
    {file && (
      <div className="mt-2 flex items-center justify-between rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2">
        <span className="truncate text-[12px] font-medium text-sky-200">{file.name}</span>
        <span className="ml-2 flex-shrink-0 text-[11px] text-[#8ea79c]">{fmtBytes(file.size)}</span>
      </div>
    )}
    {!file && existingName && (
      <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
        <span className="block truncate text-[12px] font-medium text-amber-300">Current: {existingName}</span>
      </div>
    )}
  </div>
);

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const DPPCard: React.FC<{
  dpp: DPP;
  onEdit: () => void;
  onToggleAnswer: () => void;
  onDelete: () => void;
}> = ({ dpp, onEdit, onToggleAnswer, onDelete }) => (
  <div className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.16]">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="line-clamp-2 font-serif text-[15.5px] font-semibold leading-snug text-[#eef4f1]">{dpp.title}</p>
        <p className="mt-1.5 text-[12px] font-medium text-sky-400">
          {dpp.board} · Class {dpp.class} · {dpp.subject}
        </p>
      </div>
      <span className="flex-shrink-0 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono font-semibold text-[#8ea79c]">
        {dpp.viewCount || 0} views
      </span>
    </div>

    <div className="mb-3 flex flex-wrap gap-2">
      <StatusPill active={dpp.questionActive} label="Question" />
      <StatusPill active={dpp.answerActive} label="Answer" />
    </div>

    <div className="mb-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="truncate text-[11.5px] text-[#8ea79c]">
        <span className="font-semibold text-[#c9dcd3]">Q:</span> {dpp.questionPDF?.originalName} ·{' '}
        {fmtBytes(dpp.questionPDF?.fileSize)}
      </p>
      {dpp.answerPDF && (
        <p className="truncate text-[11.5px] text-[#8ea79c]">
          <span className="font-semibold text-[#c9dcd3]">A:</span> {dpp.answerPDF.originalName} · {fmtBytes(dpp.answerPDF.fileSize)}
        </p>
      )}
      <p className="text-[11px] text-[#5c7469]">Added {fmtDate(dpp.createdAt)}</p>
    </div>

    <div className="mt-auto flex gap-2">
      <button
        onClick={onEdit}
        className="flex-1 rounded-lg border border-sky-400/25 bg-sky-400/10 py-2 text-[12px] font-semibold text-sky-300 transition-colors hover:border-sky-400/45"
      >
        Edit
      </button>
      <button
        onClick={onToggleAnswer}
        className="flex-1 rounded-lg border border-amber-400/25 bg-amber-400/10 py-2 text-[12px] font-semibold text-amber-300 transition-colors hover:border-amber-400/45"
      >
        {dpp.answerActive ? 'Hide answer' : 'Show answer'}
      </button>
      <button
        onClick={onDelete}
        className="flex-1 rounded-lg border border-red-400/25 bg-red-400/10 py-2 text-[12px] font-semibold text-red-300 transition-colors hover:border-red-400/45"
      >
        Delete
      </button>
    </div>
  </div>
);

const StatusPill: React.FC<{ active: boolean; label: string }> = ({ active, label }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      active ? 'bg-emerald-400/12 text-emerald-300' : 'bg-white/[0.05] text-[#5c7469]'
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-[#5c7469]'}`} />
    {label} {active ? 'active' : 'inactive'}
  </span>
);