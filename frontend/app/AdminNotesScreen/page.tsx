/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminNotesScreen.tsx (Expo). Same SUJHAV web
// design language as AdminCreateBatchesScreen / AdminDashboardScreen: bg
// #0a120f, cards #101d17, hairline white/[0.08] borders, emerald-400 accent,
// font-serif headings, font-mono for numerals. Same backend routes/payload
// shapes as the app version — file pickers become native <input type="file">
// with drag styling, and both modals become right-side drawers on desktop /
// full-screen sheets on mobile. Note: matching the app version, these
// requests are sent without an Authorization header.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PDF {
  _id?: string;
  pdfTitle: string;
  pdfDescription: string;
  originalName: string;
  fileSize: number;
  pages?: number;
}

interface PaidNotes {
  _id?: string;
  notesTitle: string;
  tutor: string;
  rating: number;
  category: 'jee' | 'neet' | 'boards';
  class: string;
  price: number;
  notesDetails: {
    subtitle: string;
    description: string;
  };
  pdfs: PDF[];
  thumbnailUri?: string;
  isActive: boolean;
  viewCount?: number;
  createdAt?: string;
}

const EMPTY_NOTES: PaidNotes = {
  notesTitle: '',
  tutor: '',
  rating: 0,
  category: 'jee',
  class: '',
  price: 0,
  notesDetails: { subtitle: '', description: '' },
  pdfs: [],
  thumbnailUri: '',
  isActive: true,
};

const EMPTY_PDF: PDF = { pdfTitle: '', pdfDescription: '', originalName: '', fileSize: 0, pages: 0 };

const CATEGORY_META: Record<PaidNotes['category'], { label: string; color: string }> = {
  jee: { label: 'JEE', color: '#38BDF8' },
  neet: { label: 'NEET', color: '#FB7185' },
  boards: { label: 'Boards', color: '#A3E635' },
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const Spinner: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ width: size, height: size }} />
);
const IconArrowLeft = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
);
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" /></svg>
);
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.6" /><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
const formatPrice = (price: number) => `₹${(price || 0).toLocaleString('en-IN')}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminNotesScreen: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [notes, setNotes] = useState<PaidNotes[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingPdf, setAddingPdf] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<PaidNotes | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<PaidNotes | null>(null);
  const [confirmDeleteNotes, setConfirmDeleteNotes] = useState<PaidNotes | null>(null);
  const [confirmDeletePdf, setConfirmDeletePdf] = useState<PDF | null>(null);

  const [notesForm, setNotesForm] = useState<PaidNotes>(EMPTY_NOTES);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

  const [pdfForm, setPdfForm] = useState<PDF>(EMPTY_PDF);
  const [selectedPDFFile, setSelectedPDFFile] = useState<File | null>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { loadNotes(); }, []);

  // ── data loading ──────────────────────────────────────────────────────

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/notes`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) setNotes(data.data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── thumbnail / pdf pickers ──────────────────────────────────────────

  const onThumbnailSelected = (file: File | null) => {
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const onPdfSelected = (file: File | null) => {
    if (!file) return;
    setSelectedPDFFile(file);
    setPdfForm((f) => ({ ...f, pdfTitle: f.pdfTitle || file.name, originalName: file.name, fileSize: file.size }));
  };

  // ── validation ────────────────────────────────────────────────────────

  const validateNotes = () => {
    if (!notesForm.notesTitle?.trim()) return 'Notes title is required';
    if (!notesForm.tutor?.trim()) return 'Tutor name is required';
    if (!notesForm.class?.trim()) return 'Class is required';
    if (!notesForm.notesDetails?.subtitle?.trim()) return 'Subtitle is required';
    if (!notesForm.notesDetails?.description?.trim()) return 'Description is required';
    if (!thumbnailFile && !editingNotes) return 'Thumbnail is required';
    if (notesForm.rating < 0 || notesForm.rating > 5) return 'Rating must be between 0 and 5';
    if (notesForm.price < 0) return 'Price must be 0 or greater';
    return null;
  };

  const validatePdf = () => {
    if (!pdfForm.pdfTitle?.trim()) return 'PDF title is required';
    if (!pdfForm.pdfDescription?.trim()) return 'PDF description is required';
    if (!selectedPDFFile) return 'Please select a PDF file';
    return null;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setNotesForm(EMPTY_NOTES);
    setEditingNotes(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
  };

  const resetPdfForm = () => {
    setPdfForm(EMPTY_PDF);
    setSelectedPDFFile(null);
  };

  const saveNotes = async () => {
    const err = validateNotes();
    if (err) return alert(err);

    try {
      setSaving(true);
      const url = editingNotes ? `${API_BASE_URL}/notes/${editingNotes._id}` : `${API_BASE_URL}/notes`;
      const method = editingNotes ? 'PUT' : 'POST';

      const formData = new FormData();
      formData.append('notesTitle', notesForm.notesTitle);
      formData.append('tutor', notesForm.tutor);
      formData.append('rating', notesForm.rating.toString());
      formData.append('category', notesForm.category);
      formData.append('class', notesForm.class);
      formData.append('price', notesForm.price.toString());
      formData.append('isActive', notesForm.isActive.toString());
      formData.append('notesDetails', JSON.stringify(notesForm.notesDetails));
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

      const response = await fetch(url, { method, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        resetForm();
        setShowAddModal(false);
        loadNotes();
      } else {
        alert(data.message || 'Failed to save notes');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const deleteNotes = async (item: PaidNotes) => {
    if (!item._id) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/notes/${item._id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) loadNotes();
    } catch (error) {
      console.error('Error deleting notes:', error);
    } finally {
      setLoading(false);
      setConfirmDeleteNotes(null);
    }
  };

  const addPDFToNotes = async () => {
    const err = validatePdf();
    if (err) return alert(err);
    if (!selectedNotes?._id) return;

    try {
      setAddingPdf(true);
      const formData = new FormData();
      formData.append('pdfTitle', pdfForm.pdfTitle.trim());
      formData.append('pdfDescription', pdfForm.pdfDescription.trim());
      formData.append('pages', (pdfForm.pages || 0).toString());
      if (selectedPDFFile) formData.append('pdf', selectedPDFFile);

      const response = await fetch(`${API_BASE_URL}/notes/${selectedNotes._id}/pdfs`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        resetPdfForm();
        setSelectedNotes(data.data);
        loadNotes();
      } else {
        alert(data.message || 'Failed to add PDF');
      }
    } catch (error) {
      console.error('Error adding PDF:', error);
      alert('Failed to add PDF. Please try again.');
    } finally {
      setAddingPdf(false);
    }
  };

  const deletePDFFromNotes = async (pdf: PDF) => {
    if (!selectedNotes?._id || !pdf._id) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/notes/${selectedNotes._id}/pdfs/${pdf._id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setSelectedNotes(data.data);
        loadNotes();
      }
    } catch (error) {
      console.error('Error deleting PDF:', error);
    } finally {
      setLoading(false);
      setConfirmDeletePdf(null);
    }
  };

  const editNotes = (item: PaidNotes) => {
    setNotesForm({
      ...item,
      notesDetails: item.notesDetails || { subtitle: '', description: '' },
      pdfs: item.pdfs || [],
      rating: item.rating || 0,
      price: item.price || 0,
      isActive: item.isActive !== undefined ? item.isActive : true,
      thumbnailUri: '',
    });
    setThumbnailFile(null);
    setThumbnailPreview('');
    setEditingNotes(item);
    setShowAddModal(true);
  };

  const managePDFs = (item: PaidNotes) => {
    setSelectedNotes(item);
    resetPdfForm();
    setShowPDFModal(true);
  };

  const stats = useMemo(
    () => [
      { label: 'Total notes', value: notes.length },
      { label: 'Active', value: notes.filter((n) => n.isActive).length },
      { label: 'Total views', value: notes.reduce((sum, n) => sum + (n.viewCount || 0), 0) },
      { label: 'PDFs uploaded', value: notes.reduce((sum, n) => sum + (n.pdfs?.length || 0), 0) },
    ],
    [notes]
  );

  // ── render ────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-56 h-[420px] w-[420px] rounded-full bg-emerald-400 opacity-5 blur-md" />
        <div className="absolute -left-36 bottom-16 h-[300px] w-[300px] rounded-full bg-emerald-400 opacity-[0.035] blur-md" />
      </div>

      {/* top nav */}
      <header
        className={`sticky top-0 z-20 border-b border-white/[0.08] bg-[#0a120f]/85 backdrop-blur-md transition-all duration-500 ${
          mounted ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8ea79c] transition-colors hover:border-white/[0.16] hover:text-[#eef4f1]"
            >
              <IconArrowLeft />
            </button>
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Admin dashboard</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Notes admin</h1>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[13px] font-bold text-emerald-400 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/15"
          >
            <IconPlus />
            <span className="hidden sm:inline">Add notes</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {/* stats */}
        <section
          className={`mb-9 grid grid-cols-2 gap-4 transition-all duration-500 delay-75 sm:grid-cols-4 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-4 text-center sm:p-5">
              <span className="block font-mono text-2xl font-bold text-emerald-400 sm:text-[28px]">{s.value}</span>
              <span className="mt-1 block text-[11.5px] leading-tight text-[#8ea79c] sm:text-[12.5px]">{s.label}</span>
            </div>
          ))}
        </section>

        {/* notes grid */}
        <section className={`transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Paid notes</h2>
            <span className="text-[13px] text-[#8ea79c]">{notes.length} notes</span>
          </div>

          {loading && notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101d17] py-16">
              <Spinner size={26} />
              <span className="text-[13px] text-[#8ea79c]">Loading paid notes…</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-16 text-center">
              <p className="mb-4 text-[14px] text-[#8ea79c]">No notes found.</p>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300"
              >
                Create your first notes
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {notes.map((item) => (
                <NotesCard
                  key={item._id}
                  item={item}
                  onEdit={() => editNotes(item)}
                  onManagePDFs={() => managePDFs(item)}
                  onDelete={() => setConfirmDeleteNotes(item)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── add / edit notes drawer ── */}
      <Drawer
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingNotes ? 'Edit notes' : 'Add new notes'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              Cancel
            </button>
            <button
              onClick={saveNotes}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? <Spinner size={16} /> : editingNotes ? 'Update notes' : 'Create notes'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <Field label="Notes title" required>
            <input
              value={notesForm.notesTitle}
              onChange={(e) => setNotesForm((f) => ({ ...f, notesTitle: e.target.value }))}
              placeholder="Enter notes title"
              className="input-field"
            />
          </Field>

          <Field label="Tutor name" required>
            <input
              value={notesForm.tutor}
              onChange={(e) => setNotesForm((f) => ({ ...f, tutor: e.target.value }))}
              placeholder="Enter tutor name"
              className="input-field"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (₹)" required>
              <input
                type="number"
                min={0}
                value={notesForm.price}
                onChange={(e) => setNotesForm((f) => ({ ...f, price: Math.max(parseFloat(e.target.value) || 0, 0) }))}
                placeholder="0"
                className="input-field"
              />
            </Field>
            <Field label="Rating (0–5)">
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={notesForm.rating}
                onChange={(e) => setNotesForm((f) => ({ ...f, rating: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 5) }))}
                placeholder="0"
                className="input-field"
              />
            </Field>
          </div>

          <Field label="Category" required>
            <div className="grid grid-cols-3 gap-2.5">
              {(['jee', 'neet', 'boards'] as const).map((category) => {
                const active = notesForm.category === category;
                const meta = CATEGORY_META[category];
                return (
                  <button
                    key={category}
                    onClick={() => setNotesForm((f) => ({ ...f, category }))}
                    className="rounded-[10px] border py-2.5 text-[13px] font-bold transition-colors"
                    style={
                      active
                        ? { borderColor: meta.color, background: `${meta.color}18`, color: meta.color }
                        : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#8ea79c' }
                    }
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Class" required>
            <input
              value={notesForm.class}
              onChange={(e) => setNotesForm((f) => ({ ...f, class: e.target.value }))}
              placeholder="e.g. 11, 12"
              className="input-field"
            />
          </Field>

          <Field label="Subtitle" required>
            <input
              value={notesForm.notesDetails.subtitle}
              onChange={(e) => setNotesForm((f) => ({ ...f, notesDetails: { ...f.notesDetails, subtitle: e.target.value } }))}
              placeholder="Enter notes subtitle"
              className="input-field"
            />
          </Field>

          <Field label="Description" required>
            <textarea
              value={notesForm.notesDetails.description}
              onChange={(e) => setNotesForm((f) => ({ ...f, notesDetails: { ...f.notesDetails, description: e.target.value } }))}
              placeholder="Enter detailed notes description"
              rows={4}
              className="input-field resize-none"
            />
          </Field>

          <Field label="Notes thumbnail" required={!editingNotes}>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onThumbnailSelected(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => thumbnailInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/[0.16] bg-white/[0.03] py-3 text-[13.5px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/40"
            >
              <IconImage />
              {thumbnailFile ? 'Change thumbnail' : 'Select thumbnail'}
            </button>
            {thumbnailPreview && (
              <img src={thumbnailPreview} alt="Thumbnail preview" className="mt-3 h-44 w-full rounded-[10px] object-cover" />
            )}
          </Field>

          <label className="flex cursor-pointer items-center gap-3">
            <span
              onClick={() => setNotesForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition-colors ${
                notesForm.isActive ? 'border-emerald-400 bg-emerald-400 text-[#08130f]' : 'border-[#8ea79c]/50 text-transparent'
              }`}
            >
              <IconCheck />
            </span>
            <span className="text-[14px] text-[#eef4f1]">{notesForm.isActive ? 'Active' : 'Inactive'} notes</span>
          </label>
        </div>
      </Drawer>

      {/* ── manage pdfs drawer ── */}
      <Drawer
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        title={`Manage PDFs · ${selectedNotes?.notesTitle || ''}`}
      >
        <div className="space-y-8">
          {/* add new pdf */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="mb-4 font-serif text-[15px] font-semibold text-[#eef4f1]">Add new PDF</h3>
            <div className="space-y-5">
              <Field label="PDF title" required>
                <input
                  value={pdfForm.pdfTitle}
                  onChange={(e) => setPdfForm((f) => ({ ...f, pdfTitle: e.target.value }))}
                  placeholder="Enter PDF title"
                  className="input-field"
                />
              </Field>
              <Field label="PDF description" required>
                <textarea
                  value={pdfForm.pdfDescription}
                  onChange={(e) => setPdfForm((f) => ({ ...f, pdfDescription: e.target.value }))}
                  placeholder="Enter PDF description"
                  rows={3}
                  className="input-field resize-none"
                />
              </Field>
              <Field label="Number of pages">
                <input
                  type="number"
                  min={0}
                  value={pdfForm.pages || 0}
                  onChange={(e) => setPdfForm((f) => ({ ...f, pages: Math.max(parseInt(e.target.value) || 0, 0) }))}
                  placeholder="0"
                  className="input-field"
                />
              </Field>
              <Field label="PDF file" required>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => onPdfSelected(e.target.files?.[0] || null)}
                />
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/[0.16] bg-white/[0.03] py-3 text-[13.5px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/40"
                >
                  <IconFile />
                  {selectedPDFFile ? 'Change PDF file' : 'Select PDF file'}
                </button>
                {selectedPDFFile && (
                  <div className="mt-3 rounded-[10px] bg-white/[0.04] px-4 py-3">
                    <p className="truncate text-[13px] font-semibold text-[#eef4f1]">{selectedPDFFile.name}</p>
                    <p className="mt-0.5 text-[12px] text-[#8ea79c]">Size: {formatFileSize(selectedPDFFile.size)}</p>
                  </div>
                )}
              </Field>
              <button
                onClick={addPDFToNotes}
                disabled={addingPdf}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {addingPdf ? <Spinner size={16} /> : 'Add PDF to notes'}
              </button>
            </div>
          </div>

          {/* existing pdfs */}
          <div>
            <h3 className="mb-4 font-serif text-[15px] font-semibold text-[#eef4f1]">
              Existing PDFs ({selectedNotes?.pdfs?.length || 0})
            </h3>
            {selectedNotes?.pdfs && selectedNotes.pdfs.length > 0 ? (
              <div className="space-y-3">
                {selectedNotes.pdfs.map((pdf, idx) => (
                  <div key={pdf._id || idx} className="flex items-start justify-between gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-[#eef4f1]">{pdf.pdfTitle || 'Untitled PDF'}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[#8ea79c]">{pdf.pdfDescription || 'No description'}</p>
                      <p className="mt-1 text-[11.5px] text-[#5f776e]">
                        {formatFileSize(pdf.fileSize || 0)}
                        {!!pdf.pages && ` · ${pdf.pages} pages`}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDeletePdf(pdf)}
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-red-400/15 px-3 py-1.5 text-[11.5px] font-bold text-red-400 transition-colors hover:bg-red-400/25"
                    >
                      <IconTrash />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-white/[0.1] bg-white/[0.02] py-10 text-center">
                <p className="text-[13.5px] text-[#8ea79c]">No PDFs added yet.</p>
                <p className="mt-1 text-[12px] text-[#5f776e]">Add your first PDF above.</p>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* ── confirm delete notes ── */}
      {confirmDeleteNotes && (
        <Dialog onClose={() => setConfirmDeleteNotes(null)}>
          <ConfirmBody
            title="Delete notes"
            message="Are you sure you want to delete this notes? This action cannot be undone."
            confirmLabel="Delete"
            loading={loading}
            onCancel={() => setConfirmDeleteNotes(null)}
            onConfirm={() => deleteNotes(confirmDeleteNotes)}
          />
        </Dialog>
      )}

      {/* ── confirm delete pdf ── */}
      {confirmDeletePdf && (
        <Dialog onClose={() => setConfirmDeletePdf(null)}>
          <ConfirmBody
            title="Delete PDF"
            message="Are you sure you want to delete this PDF from the notes?"
            confirmLabel="Delete"
            loading={loading}
            onCancel={() => setConfirmDeletePdf(null)}
            onConfirm={() => deletePDFFromNotes(confirmDeletePdf)}
          />
        </Dialog>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #eef4f1;
          padding: 0.7rem 0.9rem;
          border-radius: 10px;
          font-size: 14px;
          transition: border-color 0.15s ease;
        }
        .input-field::placeholder { color: #5f776e; }
        .input-field:focus { outline: none; border-color: rgba(52, 211, 153, 0.5); }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="mb-2 block text-[13.5px] font-bold text-[#eef4f1]">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const NotesCard: React.FC<{ item: PaidNotes; onEdit: () => void; onManagePDFs: () => void; onDelete: () => void }> = ({
  item, onEdit, onManagePDFs, onDelete,
}) => {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.jee;
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.14]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[17px] font-semibold text-[#eef4f1]">{item.notesTitle || 'Untitled notes'}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-[#8ea79c]">by {item.tutor || 'Unknown'}</p>
        </div>
        <span className="flex-shrink-0 rounded-lg bg-amber-400/15 px-2.5 py-1 text-[12.5px] font-bold text-amber-300">
          {formatPrice(item.price)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: `${meta.color}20`, color: meta.color }}>
          {meta.label}
        </span>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-[#c7d8d1]">
          Class {item.class || 'N/A'}
        </span>
        <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-[#c7d8d1]">
          <IconStar />{(item.rating || 0).toFixed(1)}
        </span>
        <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-[#c7d8d1]">
          <IconEye />{item.viewCount || 0}
        </span>
        <span className={`text-[11px] font-bold ${item.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-[#8ea79c]">
        {item.notesDetails?.subtitle || 'No subtitle available'}
      </p>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <CardAction label="Edit" color="#38BDF8" onClick={onEdit} />
        <CardAction label={`PDFs (${item.pdfs?.length || 0})`} color="#A78BFA" onClick={onManagePDFs} />
        <CardAction label="Delete" color="#FB7185" onClick={onDelete} />
      </div>
    </div>
  );
};

const CardAction: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-lg px-2 py-2 text-center text-[11.5px] font-bold transition-opacity hover:opacity-80"
    style={{ background: `${color}20`, color }}
  >
    {label}
  </button>
);

const Drawer: React.FC<{ open: boolean; onClose: () => void; title: string; footer?: React.ReactNode; children: React.ReactNode }> = ({
  open, onClose, title, footer, children,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#0a120f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h2 className="truncate font-serif text-lg font-semibold text-[#eef4f1]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8ea79c] transition-colors hover:border-white/[0.16] hover:text-[#eef4f1]"
          >
            <IconX />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="border-t border-white/[0.08] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
};

const Dialog: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 shadow-2xl">
      {children}
    </div>
  </div>
);

const ConfirmBody: React.FC<{
  title: string; message: string; confirmLabel: string; loading?: boolean; onCancel: () => void; onConfirm: () => void;
}> = ({ title, message, confirmLabel, loading, onCancel, onConfirm }) => (
  <div className="text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
      <IconTrash />
    </div>
    <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{title}</h3>
    <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">{message}</p>
    <div className="mt-6 flex gap-3">
      <button
        onClick={onCancel}
        disabled={loading}
        className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {loading ? <Spinner size={16} /> : confirmLabel}
      </button>
    </div>
  </div>
);

export default AdminNotesScreen;