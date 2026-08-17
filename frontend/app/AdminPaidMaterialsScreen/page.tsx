/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminPaidMaterialsScreen.tsx (Expo). Same SUJHAV
// web design language as AdminNotesScreen / AdminCreateBatchesScreen: bg
// #0a120f, cards #101d17, hairline white/[0.08] borders, emerald-400 accent,
// font-serif headings, font-mono for numerals. Same backend routes/payload
// shapes as the app version (multipart 'photos' field, multiple files) — no
// Authorization header, matching the RN version. File picker becomes a
// native multi-select <input type="file"> with a thumbnail strip.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialPhoto {
  _id?: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface PaidMaterial {
  _id?: string;
  materialTitle: string;
  description: string;
  price: number;
  category: 'jee' | 'neet' | 'boards';
  class: string;
  rating: number;
  materialPhotos: MaterialPhoto[];
  isActive: boolean;
  viewCount?: number;
  createdAt?: string;
}

const EMPTY_MATERIAL: PaidMaterial = {
  materialTitle: '',
  description: '',
  price: 0,
  category: 'jee',
  class: '',
  rating: 0,
  materialPhotos: [],
  isActive: true,
};

const CATEGORY_META: Record<PaidMaterial['category'], { label: string; color: string }> = {
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

const formatPrice = (price: number) => `₹${(price || 0).toLocaleString('en-IN')}`;

interface SelectedImage {
  file: File;
  previewUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminPaidMaterialsScreen: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [materials, setMaterials] = useState<PaidMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PaidMaterial | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PaidMaterial | null>(null);

  const [materialForm, setMaterialForm] = useState<PaidMaterial>(EMPTY_MATERIAL);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { loadMaterials(); }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/paidMaterials`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) setMaterials(data.data || []);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── image picking ────────────────────────────────────────────────────

  const onImagesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const additions: SelectedImage[] = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setSelectedImages((prev) => [...prev, ...additions]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── validation ────────────────────────────────────────────────────────

  const validateMaterial = () => {
    if (!materialForm.materialTitle?.trim()) return 'Material title is required';
    if (!materialForm.description?.trim()) return 'Description is required';
    if (!materialForm.class?.trim()) return 'Class is required';
    if (materialForm.price <= 0) return 'Price must be greater than 0';
    if (materialForm.rating < 0 || materialForm.rating > 5) return 'Rating must be between 0 and 5';
    if (selectedImages.length === 0 && !editingMaterial) return 'At least one photo is required';
    return null;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setMaterialForm(EMPTY_MATERIAL);
    setSelectedImages([]);
    setEditingMaterial(null);
  };

  const saveMaterial = async () => {
    const err = validateMaterial();
    if (err) return alert(err);

    try {
      setSaving(true);
      const url = editingMaterial ? `${API_BASE_URL}/paidMaterials/${editingMaterial._id}` : `${API_BASE_URL}/paidMaterials`;
      const method = editingMaterial ? 'PUT' : 'POST';

      const formData = new FormData();
      formData.append('materialTitle', materialForm.materialTitle);
      formData.append('description', materialForm.description);
      formData.append('price', materialForm.price.toString());
      formData.append('category', materialForm.category);
      formData.append('class', materialForm.class);
      formData.append('rating', materialForm.rating.toString());
      formData.append('isActive', materialForm.isActive.toString());
      selectedImages.forEach((img) => formData.append('photos', img.file));

      const response = await fetch(url, { method, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        resetForm();
        setShowModal(false);
        loadMaterials();
      } else {
        alert(data.message || 'Failed to save material');
      }
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Failed to save material. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMaterial = async (material: PaidMaterial) => {
    if (!material._id) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/paidMaterials/${material._id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) loadMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const editMaterial = (material: PaidMaterial) => {
    setMaterialForm({
      ...material,
      materialPhotos: material.materialPhotos || [],
      rating: material.rating || 0,
      price: material.price || 0,
      isActive: material.isActive !== undefined ? material.isActive : true,
    });
    setSelectedImages([]);
    setEditingMaterial(material);
    setShowModal(true);
  };

  const stats = useMemo(
    () => [
      { label: 'Total materials', value: materials.length },
      { label: 'Active', value: materials.filter((m) => m.isActive).length },
      { label: 'Total views', value: materials.reduce((sum, m) => sum + (m.viewCount || 0), 0) },
      { label: 'Photos uploaded', value: materials.reduce((sum, m) => sum + (m.materialPhotos?.length || 0), 0) },
    ],
    [materials]
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
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Paid materials admin</h1>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[13px] font-bold text-emerald-400 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/15"
          >
            <IconPlus />
            <span className="hidden sm:inline">Add material</span>
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

        {/* materials grid */}
        <section className={`transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Paid materials</h2>
            <span className="text-[13px] text-[#8ea79c]">{materials.length} materials</span>
          </div>

          {loading && materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101d17] py-16">
              <Spinner size={26} />
              <span className="text-[13px] text-[#8ea79c]">Loading materials…</span>
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-16 text-center">
              <p className="mb-4 text-[14px] text-[#8ea79c]">No materials found.</p>
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300"
              >
                Create your first material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {materials.map((item) => (
                <MaterialCard
                  key={item._id}
                  item={item}
                  onEdit={() => editMaterial(item)}
                  onDelete={() => setConfirmDelete(item)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── add / edit material drawer ── */}
      <Drawer
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingMaterial ? 'Edit material' : 'Add new material'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              Cancel
            </button>
            <button
              onClick={saveMaterial}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? <Spinner size={16} /> : editingMaterial ? 'Update material' : 'Create material'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <Field label="Material title" required>
            <input
              value={materialForm.materialTitle}
              onChange={(e) => setMaterialForm((f) => ({ ...f, materialTitle: e.target.value }))}
              placeholder="Enter material title"
              className="input-field"
            />
          </Field>

          <Field label="Description" required>
            <textarea
              value={materialForm.description}
              onChange={(e) => setMaterialForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Enter material description"
              rows={4}
              className="input-field resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (₹)" required>
              <input
                type="number"
                min={0}
                value={materialForm.price}
                onChange={(e) => setMaterialForm((f) => ({ ...f, price: Math.max(parseFloat(e.target.value) || 0, 0) }))}
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
                value={materialForm.rating}
                onChange={(e) => setMaterialForm((f) => ({ ...f, rating: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 5) }))}
                placeholder="0"
                className="input-field"
              />
            </Field>
          </div>

          <Field label="Category" required>
            <div className="grid grid-cols-3 gap-2.5">
              {(['jee', 'neet', 'boards'] as const).map((category) => {
                const active = materialForm.category === category;
                const meta = CATEGORY_META[category];
                return (
                  <button
                    key={category}
                    onClick={() => setMaterialForm((f) => ({ ...f, category }))}
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
              value={materialForm.class}
              onChange={(e) => setMaterialForm((f) => ({ ...f, class: e.target.value }))}
              placeholder="e.g. 11, 12"
              className="input-field"
            />
          </Field>

          <Field label="Material photos" required={!editingMaterial}>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onImagesSelected(e.target.files)}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/[0.16] bg-white/[0.03] py-3 text-[13.5px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/40"
            >
              <IconImage />
              {selectedImages.length > 0 ? `Add more photos (${selectedImages.length})` : 'Select photos'}
            </button>

            {selectedImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={img.previewUrl} alt={`Selected ${index + 1}`} className="h-20 w-20 rounded-[10px] object-cover" />
                    <button
                      onClick={() => removeImage(index)}
                      aria-label="Remove image"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-400 text-[#1a0505] shadow"
                    >
                      <IconX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <label className="flex cursor-pointer items-center gap-3">
            <span
              onClick={() => setMaterialForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition-colors ${
                materialForm.isActive ? 'border-emerald-400 bg-emerald-400 text-[#08130f]' : 'border-[#8ea79c]/50 text-transparent'
              }`}
            >
              <IconCheck />
            </span>
            <span className="text-[14px] text-[#eef4f1]">{materialForm.isActive ? 'Active' : 'Inactive'} material</span>
          </label>
        </div>
      </Drawer>

      {/* ── confirm delete ── */}
      {confirmDelete && (
        <Dialog onClose={() => setConfirmDelete(null)}>
          <ConfirmBody
            title="Delete material"
            message="Are you sure you want to delete this material? This action cannot be undone."
            confirmLabel="Delete"
            loading={loading}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => deleteMaterial(confirmDelete)}
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

const MaterialCard: React.FC<{ item: PaidMaterial; onEdit: () => void; onDelete: () => void }> = ({ item, onEdit, onDelete }) => {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.jee;
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.14]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[17px] font-semibold text-[#eef4f1]">{item.materialTitle || 'Untitled material'}</h3>
        </div>
        <span className="flex-shrink-0 rounded-lg bg-emerald-400/15 px-2.5 py-1 text-[12.5px] font-bold text-emerald-400">
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
        {item.description || 'No description'}
      </p>

      <p className="mb-4 text-[12px] text-[#5f776e]">{item.materialPhotos?.length || 0} photo{(item.materialPhotos?.length || 0) !== 1 ? 's' : ''} attached</p>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <CardAction label="Edit" color="#FBBF24" onClick={onEdit} />
        <CardAction label="Delete" color="#FB7185" onClick={onDelete} />
      </div>
    </div>
  );
};

const CardAction: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-lg px-2 py-2 text-center text-[12px] font-bold transition-opacity hover:opacity-80"
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

export default AdminPaidMaterialsScreen;