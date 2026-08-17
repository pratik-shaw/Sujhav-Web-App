/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../lib/auth';
import { API_BASE } from '../config/api';
import BatchAssignmentModal from '../components/BatchAssignmentModal';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminCreateBatchesScreen.tsx (Expo). Same SUJHAV
// web design language as AdminDashboardScreen: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 accent, font-serif headings,
// font-mono for numerals. Same backend routes as the app version. Fully
// responsive: single column on mobile, multi-column grid on tablet/desktop,
// modals become right-side drawers on desktop and full-screen sheets on
// mobile.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subject {
  _id?: string;
  name: string;
  teacher?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'teacher';
}

interface Center {
  _id: string;
  centerName: string;
}

interface Batch {
  _id?: string;
  batchName: string;
  classes: string[];
  subjects: Subject[];
  category: 'jee' | 'neet' | 'boards';
  students: User[];
  center?: string | Center;
  schedule: string;
  description: string;
  isActive: boolean;
}

interface BatchForm {
  batchName: string;
  classes: string[];
  subjects: Subject[];
  category: 'jee' | 'neet' | 'boards';
  students: string[];
  center: string;
  schedule: string;
  description: string;
  isActive: boolean;
}

interface StudentAssignment {
  studentId: string;
  assignedClasses: string[];
  assignedSubjects: string[];
}

interface TeacherAssignment {
  teacherId: string;
  assignedSubjects: string[];
}

const EMPTY_FORM: BatchForm = {
  batchName: '',
  classes: [],
  subjects: [],
  category: 'jee',
  students: [],
  center: '',
  schedule: '',
  description: '',
  isActive: true,
};

const CATEGORY_META: Record<Batch['category'], { label: string; color: string }> = {
  jee: { label: 'JEE', color: '#38BDF8' },
  neet: { label: 'NEET', color: '#FB7185' },
  boards: { label: 'Boards', color: '#A3E635' },
};

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

const Spinner: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span
    className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-emerald-400"
    style={{ width: size, height: size }}
  />
);

const IconArrowLeft = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminCreateBatchesScreen: React.FC = () => {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<User[]>([]);
  const [allTeachers, setAllTeachers] = useState<User[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterFilter, setSelectedCenterFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [classInput, setClassInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentModalType, setAssignmentModalType] = useState<'assign_students' | 'remove_students' | 'assign_teachers'>('assign_students');
  const [selectedBatchForAssignment, setSelectedBatchForAssignment] = useState<Batch | null>(null);

  const [showCenterManageModal, setShowCenterManageModal] = useState(false);
  const [centerNameInput, setCenterNameInput] = useState('');
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [centerLoading, setCenterLoading] = useState(false);
  const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null);
  const [confirmDeleteCenter, setConfirmDeleteCenter] = useState<Center | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<Batch | null>(null);

  const [batchForm, setBatchForm] = useState<BatchForm>(EMPTY_FORM);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBatches = useMemo(() => {
    if (selectedCenterFilter === 'all') return batches;
    return batches.filter((batch) => {
      const centerId = typeof batch.center === 'object' && batch.center !== null ? (batch.center as Center)._id : batch.center;
      return centerId === selectedCenterFilter;
    });
  }, [batches, selectedCenterFilter]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const [batchesRes, studentsRes, teachersRes, centersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/batches`, { headers }),
        fetch(`${API_BASE_URL}/batches/eligible-students`, { headers }),
        fetch(`${API_BASE_URL}/batches/all-teachers`, { headers }),
        fetch(`${API_BASE_URL}/centers`, { headers }),
      ]);

      if (batchesRes.ok) {
        const data = await batchesRes.json();
        if (data.success) setBatches(data.data || []);
      }
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        if (data.success) setEligibleStudents(data.data || []);
      }
      if (teachersRes.ok) {
        const data = await teachersRes.json();
        if (data.success) setAllTeachers(data.data || []);
      }
      if (centersRes.ok) {
        const data = await centersRes.json();
        if (data.success) setCenters(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Center management ──────────────────────────────────────────────────

  const openCreateCenter = () => {
    setEditingCenter(null);
    setCenterNameInput('');
    setShowCenterManageModal(true);
  };

  const openEditCenter = (center: Center) => {
    setEditingCenter(center);
    setCenterNameInput(center.centerName);
    setShowCenterManageModal(true);
  };

  const saveCenter = async () => {
    if (!centerNameInput.trim()) return;
    try {
      setCenterLoading(true);
      const headers = getAuthHeaders();
      const url = editingCenter ? `${API_BASE_URL}/centers/${editingCenter._id}` : `${API_BASE_URL}/centers`;
      const method = editingCenter ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers, body: JSON.stringify({ centerName: centerNameInput.trim() }) });
      const data = await response.json();
      if (data.success) {
        setShowCenterManageModal(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to save center', error);
    } finally {
      setCenterLoading(false);
    }
  };

  const deleteCenter = async (center: Center) => {
    try {
      setDeletingCenterId(center._id);
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/centers/${center._id}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (data.success) {
        if (selectedCenterFilter === center._id) setSelectedCenterFilter('all');
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete center', error);
    } finally {
      setDeletingCenterId(null);
      setConfirmDeleteCenter(null);
    }
  };

  // ── Assignment handlers ────────────────────────────────────────────────

  const handleAssignStudents = (batch: Batch) => {
    setSelectedBatchForAssignment(batch);
    setAssignmentModalType('assign_students');
    setShowAssignmentModal(true);
  };
  const handleRemoveStudents = (batch: Batch) => {
    if (!batch.students?.length) return;
    setSelectedBatchForAssignment(batch);
    setAssignmentModalType('remove_students');
    setShowAssignmentModal(true);
  };
  const handleAssignTeachers = (batch: Batch) => {
    if (!batch.subjects?.length) return;
    setSelectedBatchForAssignment(batch);
    setAssignmentModalType('assign_teachers');
    setShowAssignmentModal(true);
  };

  const handleStudentAssignment = async (assignments: StudentAssignment[] | TeacherAssignment[]) => {
    if (!selectedBatchForAssignment?._id) return;
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      if (assignmentModalType === 'assign_students') {
        const response = await fetch(`${API_BASE_URL}/batches/${selectedBatchForAssignment._id}/assign-students-detailed`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ assignments }),
        });
        const data = await response.json();
        if (data.success) { setShowAssignmentModal(false); loadData(); }
      } else if (assignmentModalType === 'remove_students') {
        const studentIds = (assignments as StudentAssignment[]).map((a) => a.studentId);
        const response = await fetch(`${API_BASE_URL}/batches/${selectedBatchForAssignment._id}/remove-students`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ studentIds }),
        });
        const data = await response.json();
        if (data.success) { setShowAssignmentModal(false); loadData(); }
      } else if (assignmentModalType === 'assign_teachers') {
        const response = await fetch(`${API_BASE_URL}/batches/${selectedBatchForAssignment._id}/assign-teachers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ assignments }),
        });
        const data = await response.json();
        if (data.success) { setShowAssignmentModal(false); loadData(); }
      }
    } catch (error) {
      console.error('Failed to process assignment', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Batch CRUD ──────────────────────────────────────────────────────────

  const validateBatch = () => {
    if (!batchForm.batchName?.trim()) return false;
    if (batchForm.classes.length === 0) return false;
    if (!batchForm.center) return false;
    return true;
  };

  const resetForm = () => {
    setBatchForm(EMPTY_FORM);
    setEditingBatch(null);
    setClassInput('');
    setSubjectInput('');
  };

  const saveBatch = async () => {
    if (!validateBatch()) return;
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const url = editingBatch ? `${API_BASE_URL}/batches/${editingBatch._id}` : `${API_BASE_URL}/batches`;
      const method = editingBatch ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers, body: JSON.stringify(batchForm) });
      const data = await response.json();
      if (data.success) {
        resetForm();
        setShowBatchModal(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to save batch', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteBatch = async (batch: Batch) => {
    if (!batch._id) return;
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/batches/${batch._id}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (data.success) loadData();
    } catch (error) {
      console.error('Failed to delete batch', error);
    } finally {
      setLoading(false);
      setConfirmDeleteBatch(null);
    }
  };

  const editBatch = (batch: Batch) => {
    const centerId = typeof batch.center === 'object' && batch.center !== null ? (batch.center as Center)._id : (batch.center as string) || '';
    setBatchForm({
      batchName: batch.batchName,
      classes: batch.classes || [],
      subjects: batch.subjects || [],
      category: batch.category,
      students: batch.students?.map((s) => s._id) || [],
      center: centerId,
      schedule: batch.schedule || '',
      description: batch.description || '',
      isActive: batch.isActive !== undefined ? batch.isActive : true,
    });
    setEditingBatch(batch);
    setShowBatchModal(true);
  };

  const addClass = () => {
    if (classInput.trim() && !batchForm.classes.includes(classInput.trim())) {
      setBatchForm((f) => ({ ...f, classes: [...f.classes, classInput.trim()] }));
      setClassInput('');
    }
  };
  const removeClass = (cls: string) => setBatchForm((f) => ({ ...f, classes: f.classes.filter((c) => c !== cls) }));

  const addSubject = () => {
    if (subjectInput.trim() && !batchForm.subjects.some((s) => s.name === subjectInput.trim())) {
      setBatchForm((f) => ({ ...f, subjects: [...f.subjects, { name: subjectInput.trim() }] }));
      setSubjectInput('');
    }
  };
  const removeSubject = (name: string) => setBatchForm((f) => ({ ...f, subjects: f.subjects.filter((s) => s.name !== name) }));

  const toggleStudentSelection = (studentId: string) => {
    setBatchForm((f) => ({
      ...f,
      students: f.students.includes(studentId) ? f.students.filter((id) => id !== studentId) : [...f.students, studentId],
    }));
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getBatchCenterName = (batch: Batch): string => {
    if (!batch.center) return '';
    if (typeof batch.center === 'object' && (batch.center as Center).centerName) return (batch.center as Center).centerName;
    return centers.find((c) => c._id === batch.center)?.centerName || '';
  };

  const filteredStudentOptions = eligibleStudents.filter(
    (s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const stats = [
    { label: 'Total batches', value: batches.length },
    { label: 'Active', value: batches.filter((b) => b.isActive).length },
    { label: 'Available students', value: eligibleStudents.length },
    { label: 'Teachers', value: allTeachers.length },
  ];

  // ── Render ──────────────────────────────────────────────────────────────

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
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">Batch management</h1>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowBatchModal(true); }}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[13px] font-bold text-emerald-400 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/15"
          >
            <IconPlus />
            <span className="hidden sm:inline">Create batch</span>
            <span className="sm:hidden">Create</span>
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

        {/* centers */}
        <section
          className={`mb-8 transition-all duration-500 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Centers ({centers.length})</h2>
              <p className="mt-1 text-[13px] text-[#8ea79c]">Offline coaching locations</p>
            </div>
            <button
              onClick={openCreateCenter}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              <IconPlus />
              <span>New center</span>
            </button>
          </div>

          {centers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-6 text-center text-[13px] text-[#8ea79c]">
              No centers yet. Create one to start assigning batches.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {centers.map((center) => (
                <div
                  key={center._id}
                  className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#101d17] py-1.5 pl-4 pr-1.5"
                >
                  <span className="text-[13px] font-semibold text-[#eef4f1]">{center.centerName}</span>
                  <button
                    onClick={() => openEditCenter(center)}
                    aria-label={`Edit ${center.centerName}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/15 text-amber-400 transition-colors hover:bg-amber-400/25"
                  >
                    <IconEdit />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteCenter(center)}
                    aria-label={`Delete ${center.centerName}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-400/15 text-red-400 transition-colors hover:bg-red-400/25"
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* center filter tabs */}
        {centers.length > 0 && (
          <section className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <FilterTab
              label="All"
              count={batches.length}
              active={selectedCenterFilter === 'all'}
              onClick={() => setSelectedCenterFilter('all')}
            />
            {centers.map((center) => {
              const count = batches.filter((b) => {
                const centerId = typeof b.center === 'object' && b.center !== null ? (b.center as Center)._id : b.center;
                return centerId === center._id;
              }).length;
              return (
                <FilterTab
                  key={center._id}
                  label={center.centerName}
                  count={count}
                  active={selectedCenterFilter === center._id}
                  onClick={() => setSelectedCenterFilter(center._id)}
                />
              );
            })}
          </section>
        )}

        {/* batches */}
        <section className={`transition-all duration-500 delay-150 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">
              {selectedCenterFilter === 'all' ? 'All batches' : centers.find((c) => c._id === selectedCenterFilter)?.centerName}
            </h2>
            <span className="text-[13px] text-[#8ea79c]">
              {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101d17] py-16">
              <Spinner size={26} />
              <span className="text-[13px] text-[#8ea79c]">Loading batches…</span>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-16 text-center">
              <p className="text-[14px] text-[#8ea79c]">No batches found for this center.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filteredBatches.map((batch) => (
                <BatchCard
                  key={batch._id}
                  batch={batch}
                  centerName={getBatchCenterName(batch)}
                  allTeachers={allTeachers}
                  onEdit={() => editBatch(batch)}
                  onAssignStudents={() => handleAssignStudents(batch)}
                  onRemoveStudents={() => handleRemoveStudents(batch)}
                  onAssignTeachers={() => handleAssignTeachers(batch)}
                  onDelete={() => setConfirmDeleteBatch(batch)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── assignment modal ── */}
      <BatchAssignmentModal
        visible={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        batch={selectedBatchForAssignment}
        type={assignmentModalType}
        onAssign={handleStudentAssignment}
      />

      {/* ── create / edit batch drawer ── */}
      <Drawer
        open={showBatchModal}
        onClose={() => { setShowBatchModal(false); }}
        title={editingBatch ? 'Edit batch' : 'Create batch'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setShowBatchModal(false)}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              Cancel
            </button>
            <button
              onClick={saveBatch}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? <Spinner size={16} /> : editingBatch ? 'Save changes' : 'Create batch'}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <Field label="Batch name" required>
            <input
              value={batchForm.batchName}
              onChange={(e) => setBatchForm((f) => ({ ...f, batchName: e.target.value }))}
              placeholder="e.g. JEE Morning Batch A"
              className="input-field"
            />
          </Field>

          <Field label="Center" required hint={!batchForm.center ? 'Select a center. Create a new one from the main screen if needed.' : undefined}>
            <div className="relative">
              <select
                value={batchForm.center}
                onChange={(e) => setBatchForm((f) => ({ ...f, center: e.target.value }))}
                className={`input-field appearance-none pr-9 ${!batchForm.center ? 'border-red-400/40' : ''}`}
              >
                <option value="" disabled>Select center *</option>
                {centers.map((c) => (
                  <option key={c._id} value={c._id}>{c.centerName}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8ea79c]"><IconChevron /></span>
            </div>
          </Field>

          <Field label="Category" required>
            <div className="grid grid-cols-3 gap-2.5">
              {(['jee', 'neet', 'boards'] as const).map((category) => {
                const active = batchForm.category === category;
                const meta = CATEGORY_META[category];
                return (
                  <button
                    key={category}
                    onClick={() => setBatchForm((f) => ({ ...f, category }))}
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

          <Field label="Classes" required>
            <TagInput
              value={classInput}
              onChange={setClassInput}
              onAdd={addClass}
              placeholder="e.g. 11, 12"
              items={batchForm.classes}
              onRemove={removeClass}
            />
          </Field>

          <Field label="Subjects">
            <TagInput
              value={subjectInput}
              onChange={setSubjectInput}
              onAdd={addSubject}
              placeholder="e.g. Physics"
              items={batchForm.subjects.map((s) => s.name)}
              onRemove={removeSubject}
            />
          </Field>

          <Field label="Schedule">
            <input
              value={batchForm.schedule}
              onChange={(e) => setBatchForm((f) => ({ ...f, schedule: e.target.value }))}
              placeholder="e.g. Mon–Fri, 4:00–7:00 PM"
              className="input-field"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={batchForm.description}
              onChange={(e) => setBatchForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Enter description"
              rows={3}
              className="input-field resize-none"
            />
          </Field>

          <button
            onClick={() => setShowStudentSelector(true)}
            className="flex w-full items-center justify-between rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-white/[0.16]"
          >
            <span className="text-[14px] font-semibold text-[#eef4f1]">
              Select students ({batchForm.students.length} selected)
            </span>
            <span className="text-[#8ea79c] rotate-[-90deg]"><IconChevron /></span>
          </button>

          <label className="flex cursor-pointer items-center gap-3">
            <span
              onClick={() => setBatchForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition-colors ${
                batchForm.isActive ? 'border-emerald-400 bg-emerald-400 text-[#08130f]' : 'border-[#8ea79c]/50 text-transparent'
              }`}
            >
              <IconCheck />
            </span>
            <span className="text-[14px] text-[#eef4f1]">Active batch</span>
          </label>
        </div>
      </Drawer>

      {/* ── student selector drawer ── */}
      <Drawer
        open={showStudentSelector}
        onClose={() => setShowStudentSelector(false)}
        title="Select students"
        footer={
          <button
            onClick={() => setShowStudentSelector(false)}
            className="w-full rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300"
          >
            Done · {batchForm.students.length} selected
          </button>
        }
      >
        <div className="mb-4 relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8ea79c]"><IconSearch /></span>
          <input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Search students…"
            className="input-field pl-9"
          />
        </div>
        <div className="space-y-2">
          {filteredStudentOptions.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#8ea79c]">No eligible students found.</p>
          ) : (
            filteredStudentOptions.map((student) => {
              const selected = batchForm.students.includes(student._id);
              return (
                <button
                  key={student._id}
                  onClick={() => toggleStudentSelection(student._id)}
                  className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-3 text-left transition-colors ${
                    selected ? 'border-emerald-400/50 bg-emerald-400/[0.08]' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-[#eef4f1]">{student.name}</span>
                    <span className="block truncate text-[12.5px] text-[#8ea79c]">{student.email}</span>
                  </span>
                  {selected && <span className="flex-shrink-0 text-emerald-400"><IconCheck /></span>}
                </button>
              );
            })
          )}
        </div>
      </Drawer>

      {/* ── center create/edit dialog ── */}
      {showCenterManageModal && (
        <Dialog onClose={() => setShowCenterManageModal(false)}>
          <h3 className="text-center font-serif text-lg font-semibold text-[#eef4f1]">
            {editingCenter ? 'Edit center' : 'New center'}
          </h3>
          <input
            autoFocus
            value={centerNameInput}
            onChange={(e) => setCenterNameInput(e.target.value)}
            placeholder="Center name"
            className="input-field mt-5"
          />
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setShowCenterManageModal(false)}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              Cancel
            </button>
            <button
              onClick={saveCenter}
              disabled={centerLoading || !centerNameInput.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {centerLoading ? <Spinner size={16} /> : editingCenter ? 'Update' : 'Create'}
            </button>
          </div>
        </Dialog>
      )}

      {/* ── confirm delete center ── */}
      {confirmDeleteCenter && (
        <Dialog onClose={() => setConfirmDeleteCenter(null)}>
          <ConfirmBody
            title="Delete center"
            message={`Are you sure you want to delete "${confirmDeleteCenter.centerName}"? This may affect batches linked to this center.`}
            confirmLabel="Delete"
            loading={deletingCenterId === confirmDeleteCenter._id}
            onCancel={() => setConfirmDeleteCenter(null)}
            onConfirm={() => deleteCenter(confirmDeleteCenter)}
          />
        </Dialog>
      )}

      {/* ── confirm delete batch ── */}
      {confirmDeleteBatch && (
        <Dialog onClose={() => setConfirmDeleteBatch(null)}>
          <ConfirmBody
            title="Delete batch"
            message={`Are you sure you want to delete "${confirmDeleteBatch.batchName}"? This cannot be undone.`}
            confirmLabel="Delete"
            loading={loading}
            onCancel={() => setConfirmDeleteBatch(null)}
            onConfirm={() => deleteBatch(confirmDeleteBatch)}
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
        .input-field::placeholder {
          color: #5f776e;
        }
        .input-field:focus {
          outline: none;
          border-color: rgba(52, 211, 153, 0.5);
        }
        select.input-field option {
          background: #101d17;
          color: #eef4f1;
        }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

const FilterTab: React.FC<{ label: string; count: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
      active ? 'border-emerald-400/50 bg-emerald-400/[0.1] text-emerald-400' : 'border-white/[0.08] bg-[#101d17] text-[#8ea79c] hover:border-white/[0.16]'
    }`}
  >
    <span>{label}</span>
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] ${
        active ? 'bg-emerald-400/25 text-emerald-400' : 'bg-white/[0.08] text-[#8ea79c]'
      }`}
    >
      {count}
    </span>
  </button>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <div>
    <label className="mb-2 block text-[13.5px] font-bold text-[#eef4f1]">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1.5 text-[12px] italic text-[#8ea79c]">{hint}</p>}
  </div>
);

const TagInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  items: string[];
  onRemove: (item: string) => void;
}> = ({ value, onChange, onAdd, placeholder, items, onRemove }) => (
  <div>
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        className="input-field"
      />
      <button
        onClick={onAdd}
        className="flex-shrink-0 rounded-[10px] bg-emerald-400 px-4 text-[13px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300"
      >
        Add
      </button>
    </div>
    {items.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] py-1 pl-3 pr-1.5 text-[12.5px] text-[#eef4f1]">
            {item}
            <button onClick={() => onRemove(item)} className="flex h-5 w-5 items-center justify-center rounded-full text-red-400 hover:bg-red-400/15">
              <IconX />
            </button>
          </span>
        ))}
      </div>
    )}
  </div>
);

const BatchCard: React.FC<{
  batch: Batch;
  centerName: string;
  allTeachers: User[];
  onEdit: () => void;
  onAssignStudents: () => void;
  onRemoveStudents: () => void;
  onAssignTeachers: () => void;
  onDelete: () => void;
}> = ({ batch, centerName, allTeachers, onEdit, onAssignStudents, onRemoveStudents, onAssignTeachers, onDelete }) => {
  const meta = CATEGORY_META[batch.category];
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.14]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[17px] font-semibold text-[#eef4f1]">{batch.batchName}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-bold"
              style={{ background: `${meta.color}20`, color: meta.color }}
            >
              {meta.label}
            </span>
            {centerName && (
              <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                {centerName}
              </span>
            )}
          </div>
        </div>
        <span className={`flex-shrink-0 text-[12px] font-bold ${batch.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
          {batch.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mb-3 space-y-1 text-[13px] text-[#8ea79c]">
        <p>Classes: <span className="text-[#c7d8d1]">{batch.classes?.join(', ') || 'None'}</span></p>
        <p>Students: <span className="font-mono text-[#c7d8d1]">{batch.students?.length || 0}</span> · Subjects: <span className="font-mono text-[#c7d8d1]">{batch.subjects?.length || 0}</span></p>
        {batch.schedule && <p>Schedule: <span className="text-[#c7d8d1]">{batch.schedule}</span></p>}
      </div>

      {batch.description && <p className="mb-3 text-[13px] italic leading-relaxed text-[#8ea79c]">{batch.description}</p>}

      {!!batch.subjects?.length && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {batch.subjects.map((subject, idx) => (
            <span key={idx} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-[#eef4f1]">
              {subject.name}
              {subject.teacher && (
                <span className="ml-1 text-emerald-400">· {allTeachers.find((t) => t._id === subject.teacher)?.name || 'Teacher'}</span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 pt-1 sm:grid-cols-5">
        <CardAction label="Edit" color="#FBBF24" onClick={onEdit} />
        <CardAction label="+ Students" color="#34d399" onClick={onAssignStudents} />
        <CardAction label="− Students" color="#FB7185" onClick={onRemoveStudents} />
        <CardAction label="Teachers" color="#38BDF8" onClick={onAssignTeachers} />
        <CardAction label="Delete" color="#94A3B8" onClick={onDelete} />
      </div>
    </div>
  );
};

const CardAction: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-lg px-2 py-2 text-center text-[11px] font-bold transition-opacity hover:opacity-80"
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
      <div className="relative flex h-full w-full max-w-[480px] flex-col border-l border-white/[0.08] bg-[#0a120f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8ea79c] transition-colors hover:border-white/[0.16] hover:text-[#eef4f1]"
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

export default AdminCreateBatchesScreen;