/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherHandleTestScreen.tsx (Expo). Same backend
// contracts (`/tests/teacher/batch/:batchId/subjects`,
// `/tests/teacher/batch/:batchId/subject/:subjectName`,
// `/tests/batch/:batchId/class/:className/subject/:subjectName/students`,
// `POST|PUT|DELETE /tests/teacher/:id`), same dark SUJHAV design language as
// the rest of the web dashboard. The mobile app's full-screen `<Modal>` flows
// (create/edit test, assign students) become centered dialog panels here,
// native `<Picker>` becomes a styled `<select>`, and the file picker becomes
// a real `<input type="file">` drop zone. Everything reflows responsively
// instead of the single mobile column.
// ---------------------------------------------------------------------------

interface AssignedStudent {
  student: { _id: string; name: string; email: string };
  marksScored: number | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface Test {
  _id: string;
  testTitle: string;
  fullMarks: number;
  className: string;
  subjectName: string;
  batch: { _id: string; batchName: string; category: string };
  assignedStudents: AssignedStudent[];
  createdBy: { _id: string; name: string; email: string };
  instructions: string;
  dueDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasQuestionPdf?: boolean;
  hasAnswerPdf?: boolean;
}

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface BatchInfo {
  _id: string;
  batchName: string;
  category: string;
  classes: string[];
  subjects: { name: string; teacher: { _id: string; name: string; email: string } }[];
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const isValidDate = (dateString: string) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return false;
  return dateString === date.toISOString().split('T')[0];
};

const TeacherHandleTestScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') || '';

  // The batch-details "Manage tests" action only passes batchId (same as the
  // Expo app), so subject is not guaranteed to be in the URL. We treat the
  // URL value as an initial hint, keep it in local state so it can also be
  // set by picking a subject in-page, and mirror any change back to the URL.
  const [subjectName, setSubjectNameState] = useState(searchParams.get('subjectName') || '');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<{ name: string }[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTestForAssignment, setSelectedTestForAssignment] = useState<Test | null>(null);
  const [selectedTestForEdit, setSelectedTestForEdit] = useState<Test | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Test | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // form state
  const [testTitle, setTestTitle] = useState('');
  const [fullMarks, setFullMarks] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [answerPdf, setAnswerPdf] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedStudentsForAssignment, setSelectedStudentsForAssignment] = useState<string[]>([]);

  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Keeps the URL in sync (so refresh/share/back-navigation preserve the
  // chosen subject) without a full navigation.
  const selectSubject = (name: string) => {
    setSubjectNameState(name);
    router.replace(`/TeacherHandleTestScreen?batchId=${batchId}&subjectName=${encodeURIComponent(name)}`);
  };

  const fetchBatchInfo = async (token: string) => {
    const response = await fetch(`${API_BASE}/tests/teacher/batch/${batchId}/subjects`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data.success) {
      setBatchInfo(data.data.batch);
      setAvailableSubjects(data.data.subjects);
      // No subject in the URL: if the teacher only has one subject on this
      // batch, skip the picker and go straight to it.
      if (!subjectName && data.data.subjects.length === 1) {
        selectSubject(data.data.subjects[0].name);
      }
      return data.data.subjects as { name: string }[];
    }
    setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch batch info' });
    return [];
  };

  const fetchBatchSubjectTests = async (token: string, subject: string) => {
    setIsLoadingTests(true);
    try {
      const response = await fetch(`${API_BASE}/tests/teacher/batch/${batchId}/subject/${encodeURIComponent(subject)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setTests(data.data);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch tests' });
      }
    } finally {
      setIsLoadingTests(false);
    }
  };

  const loadData = async (silent = false) => {
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }
    if (!batchId) {
      setNotice({ type: 'error', title: 'Missing context', message: 'No batch was specified.' });
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      await fetchBatchInfo(token);
      // If a subject was already known (from the URL, or a prior selection)
      // and this is a manual refresh, re-fetch its tests too.
      if (silent && subjectName) await fetchBatchSubjectTests(token, subjectName);
    } catch (error) {
      console.error('Error loading tests data:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (!subjectName) return;
    const token = getToken();
    if (!token) return;
    fetchBatchSubjectTests(token, subjectName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectName]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const fetchAvailableStudents = async (className: string, subject?: string) => {
    const token = getToken();
    if (!token) return;
    const targetSubject = subject || selectedSubject;
    try {
      const response = await fetch(
        `${API_BASE}/tests/batch/${batchId}/class/${className}/subject/${targetSubject}/students`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data.success) {
        setAvailableStudents(data.data || []);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch students' });
        setAvailableStudents([]);
      }
    } catch (error) {
      console.error('Error fetching available students:', error);
      setAvailableStudents([]);
    }
  };

  const resetForm = () => {
    setTestTitle('');
    setFullMarks('');
    setSelectedClass('');
    setSelectedSubject(subjectName || (availableSubjects.length === 1 ? availableSubjects[0].name : ''));
    setInstructions('');
    setDueDate('');
    setQuestionPdf(null);
    setAnswerPdf(null);
    setIsActive(true);
    setFormError(null);
    if (questionInputRef.current) questionInputRef.current.value = '';
    if (answerInputRef.current) answerInputRef.current.value = '';
  };

  const handleCreateTest = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const populateFormWithTestData = (test: Test) => {
    setTestTitle(test.testTitle);
    setFullMarks(test.fullMarks.toString());
    setSelectedClass(test.className);
    setSelectedSubject(test.subjectName);
    setInstructions(test.instructions || '');
    setDueDate(test.dueDate ? new Date(test.dueDate).toISOString().split('T')[0] : '');
    setIsActive(test.isActive);
    setQuestionPdf(null);
    setAnswerPdf(null);
    setFormError(null);
  };

  const handleEditTest = (test: Test) => {
    setSelectedTestForEdit(test);
    populateFormWithTestData(test);
    setShowEditModal(true);
  };

  const handleCloseCreateModal = () => {
    resetForm();
    setShowCreateModal(false);
  };

  const handleCloseEditModal = () => {
    resetForm();
    setSelectedTestForEdit(null);
    setShowEditModal(false);
  };

  const handleAssignStudents = async (test: Test) => {
    setSelectedTestForAssignment(test);
    setSelectedStudentsForAssignment(test.assignedStudents.map((as) => as.student._id));
    setAvailableStudents([]);
    if (test.className && test.subjectName) {
      await fetchAvailableStudents(test.className, test.subjectName);
    }
    setShowAssignModal(true);
  };

  const handleCloseAssignModal = () => {
    setSelectedTestForAssignment(null);
    setSelectedStudentsForAssignment([]);
    setAvailableStudents([]);
    setShowAssignModal(false);
  };

  const handleClassSelectionChange = async (className: string) => {
    setSelectedClass(className);
    if (className && showAssignModal && selectedTestForAssignment) {
      await fetchAvailableStudents(className, selectedTestForAssignment.subjectName);
    }
  };

  const validateForm = () => {
    if (!testTitle.trim()) return 'Please enter a test title';
    if (!fullMarks.trim()) return 'Please enter full marks';
    const marksNumber = Number(fullMarks);
    if (Number.isNaN(marksNumber) || marksNumber <= 0) return 'Please enter valid full marks (greater than 0)';
    if (!selectedClass.trim()) return 'Please select a class';
    if (!selectedSubject.trim()) return 'Please select a subject';
    if (dueDate.trim() && !isValidDate(dueDate)) return 'Please enter the due date in YYYY-MM-DD format';
    return null;
  };

  const handleCreateTestSubmit = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setIsCreating(true);
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('testTitle', testTitle.trim());
      formData.append('fullMarks', fullMarks.trim());
      formData.append('batchId', batchId);
      formData.append('className', selectedClass);
      formData.append('subjectName', selectedSubject);
      formData.append('assignedStudents', JSON.stringify([]));
      formData.append('isActive', isActive.toString());
      if (instructions.trim()) formData.append('instructions', instructions.trim());
      if (dueDate.trim()) formData.append('dueDate', dueDate.trim());
      if (questionPdf) formData.append('questionPdf', questionPdf);
      if (answerPdf) formData.append('answerPdf', answerPdf);

      const response = await fetch(`${API_BASE}/tests/teacher/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setNotice({ type: 'success', title: 'Test created', message: 'You can now assign students to this test.' });
        handleCloseCreateModal();
        await fetchBatchSubjectTests(token, subjectName);
      } else {
        setFormError(data.message || 'Failed to create test');
      }
    } catch (error) {
      console.error('Error creating test:', error);
      setFormError('Network error. Please check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditTestSubmit = async () => {
    const error = validateForm();
    if (error || !selectedTestForEdit) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setIsEditing(true);
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('testTitle', testTitle.trim());
      formData.append('fullMarks', fullMarks.trim());
      formData.append('className', selectedClass);
      formData.append('subjectName', selectedSubject);
      formData.append('isActive', isActive.toString());
      if (instructions.trim()) formData.append('instructions', instructions.trim());
      if (dueDate.trim()) formData.append('dueDate', dueDate.trim());
      if (questionPdf) formData.append('questionPdf', questionPdf);
      if (answerPdf) formData.append('answerPdf', answerPdf);

      const response = await fetch(`${API_BASE}/tests/teacher/${selectedTestForEdit._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setNotice({ type: 'success', title: 'Test updated', message: 'Your changes have been saved.' });
        handleCloseEditModal();
        await fetchBatchSubjectTests(token, subjectName);
      } else {
        setFormError(data.message || 'Failed to update test');
      }
    } catch (error) {
      console.error('Error updating test:', error);
      setFormError('Network error. Please check your connection.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleAssignStudentsSubmit = async () => {
    if (!selectedTestForAssignment) return;
    setIsAssigning(true);
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tests/teacher/${selectedTestForAssignment._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedStudents: selectedStudentsForAssignment }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setNotice({ type: 'success', title: 'Students assigned', message: 'The test roster has been updated.' });
        handleCloseAssignModal();
        await fetchBatchSubjectTests(token, subjectName);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to assign students' });
      }
    } catch (error) {
      console.error('Error assigning students:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const token = getToken();
    if (!token) {
      router.push('/SignInScreen');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tests/teacher/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setNotice({ type: 'success', title: 'Test deleted', message: `"${deleteTarget.testTitle}" has been removed.` });
        setDeleteTarget(null);
        await fetchBatchSubjectTests(token, subjectName);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to delete test' });
      }
    } catch (error) {
      console.error('Error deleting test:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentsForAssignment((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = () => {
    setSelectedStudentsForAssignment((prev) =>
      prev.length === availableStudents.length ? [] : availableStudents.map((s) => s._id)
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a120f]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading tests&hellip;</p>
      </div>
    );
  }

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
            <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Tests management</span>
            <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
              {batchInfo?.batchName}
              {subjectName && <> &middot; {subjectName}</>}
            </h1>
          </div>
          {subjectName && availableSubjects.length > 1 && (
            <select
              value={subjectName}
              onChange={(e) => selectSubject(e.target.value)}
              className="ml-auto hidden rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] font-semibold text-[#eef4f1] outline-none focus:border-emerald-400/40 sm:block"
            >
              {availableSubjects.map((subject) => (
                <option key={subject.name} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          )}
          {subjectName && (
            <button
              onClick={handleCreateTest}
              className={`${availableSubjects.length > 1 ? '' : 'ml-auto'} flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-[13px] font-bold text-[#0a120f] transition-colors hover:bg-emerald-300`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#0a120f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              New test
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
        {!subjectName ? (
          <SubjectPicker subjects={availableSubjects} batchName={batchInfo?.batchName} onSelect={selectSubject} />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] text-[#8ea79c]">
                  {tests.length} test{tests.length !== 1 ? 's' : ''} for this subject
                </p>
                {availableSubjects.length > 1 && (
                  <button
                    onClick={() => {
                      setSubjectNameState('');
                      router.replace(`/TeacherHandleTestScreen?batchId=${batchId}`);
                    }}
                    className="text-[12.5px] font-semibold text-emerald-400 underline-offset-2 hover:underline sm:hidden"
                  >
                    Switch subject
                  </button>
                )}
              </div>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
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
                Refresh
              </button>
            </div>

            {isLoadingTests ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17] py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
                <p className="mt-3.5 text-sm text-[#8ea79c]">Loading tests&hellip;</p>
              </div>
            ) : tests.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12h6M9 16h6M9 8h1M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                    stroke="#8ea79c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-4 text-lg font-bold text-[#eef4f1]">No tests created</p>
                <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                  Create your first test for this subject to get started.
                </p>
                <button
                  onClick={handleCreateTest}
                  className="mt-6 flex items-center gap-1.5 rounded-lg bg-emerald-400 px-4 py-2.5 text-[13.5px] font-bold text-[#0a120f] transition-colors hover:bg-emerald-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="#0a120f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Create test
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {tests.map((test) => (
                  <TestCard
                    key={test._id}
                    test={test}
                    onEdit={() => handleEditTest(test)}
                    onAssign={() => handleAssignStudents(test)}
                    onDelete={() => setDeleteTarget(test)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* create / edit modal */}
      {(showCreateModal || showEditModal) && (
        <TestFormModal
          isEdit={showEditModal}
          onClose={showEditModal ? handleCloseEditModal : handleCloseCreateModal}
          onSubmit={showEditModal ? handleEditTestSubmit : handleCreateTestSubmit}
          submitting={showEditModal ? isEditing : isCreating}
          formError={formError}
          availableSubjects={availableSubjects}
          classes={batchInfo?.classes || []}
          testTitle={testTitle}
          setTestTitle={setTestTitle}
          fullMarks={fullMarks}
          setFullMarks={setFullMarks}
          selectedClass={selectedClass}
          onClassChange={showEditModal ? setSelectedClass : handleClassSelectionChange}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          instructions={instructions}
          setInstructions={setInstructions}
          dueDate={dueDate}
          setDueDate={setDueDate}
          isActive={isActive}
          setIsActive={setIsActive}
          questionPdf={questionPdf}
          setQuestionPdf={setQuestionPdf}
          answerPdf={answerPdf}
          setAnswerPdf={setAnswerPdf}
          questionInputRef={questionInputRef}
          answerInputRef={answerInputRef}
        />
      )}

      {/* assign students modal */}
      {showAssignModal && (
        <AssignStudentsModal
          test={selectedTestForAssignment}
          students={availableStudents}
          selected={selectedStudentsForAssignment}
          onToggle={handleStudentToggle}
          onSelectAll={handleSelectAllStudents}
          onClose={handleCloseAssignModal}
          onSubmit={handleAssignStudentsSubmit}
          submitting={isAssigning}
          onRetry={() => {
            if (selectedTestForAssignment) fetchAvailableStudents(selectedTestForAssignment.className, selectedTestForAssignment.subjectName);
          }}
        />
      )}

      {/* delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
                  stroke="#f87171"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Delete test</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">
              Delete &ldquo;{deleteTarget.testTitle}&rdquo;? This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTest}
                disabled={isDeleting}
                className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const SubjectPicker: React.FC<{ subjects: { name: string }[]; batchName?: string; onSelect: (name: string) => void }> = ({
  subjects,
  batchName,
  onSelect,
}) => (
  <div>
    <div className="mb-5">
      <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">Choose a subject</h2>
      <p className="mt-1 text-[13px] text-[#8ea79c]">
        {batchName ? `Select which subject in ${batchName} you'd like to manage tests for.` : "Select which subject you'd like to manage tests for."}
      </p>
    </div>

    {subjects.length === 0 ? (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-20 text-center">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
            stroke="#8ea79c"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No subjects found</p>
        <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
          You aren&rsquo;t assigned to teach any subject on this batch yet.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <button
            key={subject.name}
            onClick={() => onSelect(subject.name)}
            className="group flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 text-left transition-colors hover:border-emerald-400/30"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                  stroke="#34d399"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#eef4f1]">{subject.name}</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="flex-shrink-0 text-[#8ea79c] transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    )}
  </div>
);

const TestCard: React.FC<{ test: Test; onEdit: () => void; onAssign: () => void; onDelete: () => void }> = ({
  test,
  onEdit,
  onAssign,
  onDelete,
}) => {
  const submitted = test.assignedStudents.filter((s) => s.submittedAt).length;
  const evaluated = test.assignedStudents.filter((s) => s.evaluatedAt).length;

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-emerald-400/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[#eef4f1]">{test.testTitle}</p>
          <p className="mt-1 text-[13px] text-[#8ea79c]">
            Full marks: {test.fullMarks} &middot; Class: {test.className}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#4c6459]">Created {new Date(test.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <IconButton label="Edit test" color="#fbbf24" bg="rgba(251,191,36,0.15)" onClick={onEdit}>
            <path
              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </IconButton>
          <IconButton label="Assign students" color="#34d399" bg="rgba(52,211,153,0.15)" onClick={onAssign}>
            <path
              d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </IconButton>
          <IconButton label="Delete test" color="#f87171" bg="rgba(248,113,113,0.15)" onClick={onDelete}>
            <path
              d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-black/25 p-3">
        <StatCell label="Assigned" value={test.assignedStudents.length} />
        <StatCell label="Submitted" value={submitted} />
        <StatCell label="Evaluated" value={evaluated} />
        <div className="flex flex-col items-center">
          <span className="text-[11px] text-[#8ea79c]">Status</span>
          <span className={`mt-1 text-[13px] font-bold ${test.isActive ? 'text-emerald-400' : 'text-red-300'}`}>
            {test.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {test.instructions && <p className="mt-3.5 line-clamp-2 text-[13px] italic text-[#8ea79c]">{test.instructions}</p>}

      {(test.hasQuestionPdf || test.hasAnswerPdf) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {test.hasQuestionPdf && <FileTag label="Question PDF" />}
          {test.hasAnswerPdf && <FileTag label="Answer key" />}
        </div>
      )}

      {test.assignedStudents.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-white/[0.08] pt-4">
          <p className="text-[12.5px] text-[#8ea79c]">No students assigned yet</p>
          <button onClick={onAssign} className="rounded-full bg-emerald-400 px-4 py-1.5 text-[12px] font-bold text-[#0a120f] transition-colors hover:bg-emerald-300">
            Assign students
          </button>
        </div>
      )}
    </div>
  );
};

const IconButton: React.FC<{ label: string; color: string; bg: string; onClick: () => void; children: React.ReactNode }> = ({
  label,
  color,
  bg,
  onClick,
  children,
}) => (
  <button aria-label={label} onClick={onClick} style={{ background: bg, color }} className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-80">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      {children}
    </svg>
  </button>
);

const StatCell: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex flex-col items-center">
    <span className="text-[11px] text-[#8ea79c]">{label}</span>
    <span className="mt-1 font-mono text-[14px] font-bold text-[#eef4f1]">{value}</span>
  </div>
);

const FileTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-400">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {label}
  </span>
);

// ---------------------------------------------------------------------------

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }> = ({
  title,
  onClose,
  children,
  footer,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 sm:p-6" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17] shadow-2xl"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-6 py-4">
        <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:text-[#eef4f1]"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex-shrink-0 border-t border-white/[0.08] px-6 py-4">{footer}</div>}
    </div>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block text-[13px] font-semibold text-[#eef4f1]">{children}</label>
);

const inputClass =
  'w-full rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#4c6459] outline-none transition-colors focus:border-emerald-400/50';

interface TestFormModalProps {
  isEdit: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  formError: string | null;
  availableSubjects: { name: string }[];
  classes: string[];
  testTitle: string;
  setTestTitle: (v: string) => void;
  fullMarks: string;
  setFullMarks: (v: string) => void;
  selectedClass: string;
  onClassChange: (v: string) => void;
  selectedSubject: string;
  setSelectedSubject: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  questionPdf: File | null;
  setQuestionPdf: (f: File | null) => void;
  answerPdf: File | null;
  setAnswerPdf: (f: File | null) => void;
  questionInputRef: React.RefObject<HTMLInputElement | null>;
  answerInputRef: React.RefObject<HTMLInputElement | null>;
}

const TestFormModal: React.FC<TestFormModalProps> = ({
  isEdit,
  onClose,
  onSubmit,
  submitting,
  formError,
  availableSubjects,
  classes,
  testTitle,
  setTestTitle,
  fullMarks,
  setFullMarks,
  selectedClass,
  onClassChange,
  selectedSubject,
  setSelectedSubject,
  instructions,
  setInstructions,
  dueDate,
  setDueDate,
  isActive,
  setIsActive,
  questionPdf,
  setQuestionPdf,
  answerPdf,
  setAnswerPdf,
  questionInputRef,
  answerInputRef,
}) => (
  <ModalShell
    title={isEdit ? 'Edit test' : 'Create test'}
    onClose={onClose}
    footer={
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-400 py-3 text-[14px] font-bold text-[#0a120f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {submitting ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update test' : 'Create test'}
      </button>
    }
  >
    {formError && (
      <div className="mb-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3.5 py-2.5 text-[13px] text-red-200">{formError}</div>
    )}

    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>Subject *</FieldLabel>
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={inputClass}>
          <option value="">Select a subject</option>
          {availableSubjects.map((subject) => (
            <option key={subject.name} value={subject.name}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Test title *</FieldLabel>
        <input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Enter test title" className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Full marks *</FieldLabel>
          <input
            value={fullMarks}
            onChange={(e) => setFullMarks(e.target.value)}
            placeholder="100"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Class *</FieldLabel>
          <select value={selectedClass} onChange={(e) => onClassChange(e.target.value)} className={inputClass}>
            <option value="">Select a class</option>
            {classes.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Instructions</FieldLabel>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enter test instructions"
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <FieldLabel>Due date</FieldLabel>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
      </div>

      <div>
        <FieldLabel>Test status</FieldLabel>
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              onClick={() => setIsActive(val)}
              className={`flex-1 rounded-lg border-2 py-2.5 text-[13.5px] font-semibold transition-colors ${
                isActive === val ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-400' : 'border-white/[0.1] text-[#8ea79c]'
              }`}
            >
              {val ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-serif text-[15px] font-semibold text-[#eef4f1]">Files</p>
        <div className="flex flex-col gap-3">
          <FileDropField
            label="Question PDF"
            file={questionPdf}
            inputRef={questionInputRef}
            onChange={(f) => setQuestionPdf(f)}
          />
          <FileDropField label="Answer PDF" file={answerPdf} inputRef={answerInputRef} onChange={(f) => setAnswerPdf(f)} />
        </div>
      </div>
    </div>
  </ModalShell>
);

const FileDropField: React.FC<{
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (f: File | null) => void;
}> = ({ label, file, inputRef, onChange }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-emerald-400/30 bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-emerald-400/50"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          stroke="#34d399"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="truncate text-[13.5px] text-[#eef4f1]">{file ? file.name : `Upload ${label.toLowerCase()}`}</span>
    </button>
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => onChange(e.target.files?.[0] || null)}
    />
  </div>
);

// ---------------------------------------------------------------------------

const AssignStudentsModal: React.FC<{
  test: Test | null;
  students: Student[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  onRetry: () => void;
}> = ({ test, students, selected, onToggle, onSelectAll, onClose, onSubmit, submitting, onRetry }) => (
  <ModalShell
    title="Assign students"
    onClose={onClose}
    footer={
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-[#8ea79c]">{selected.length} selected</span>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-lg bg-emerald-400 px-5 py-2.5 text-[14px] font-bold text-[#0a120f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {submitting ? 'Assigning…' : 'Assign students'}
        </button>
      </div>
    }
  >
    {test && (
      <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <p className="text-[14.5px] font-bold text-[#eef4f1]">{test.testTitle}</p>
        <p className="mt-0.5 text-[12.5px] text-[#8ea79c]">
          Class: {test.className} &middot; Subject: {test.subjectName} &middot; Full marks: {test.fullMarks}
        </p>
      </div>
    )}

    <div className="mb-3 flex items-center justify-between">
      <p className="text-[13.5px] font-semibold text-[#eef4f1]">Available students ({students.length})</p>
      {students.length > 0 && (
        <button onClick={onSelectAll} className="rounded-full bg-emerald-400/15 px-3 py-1 text-[12px] font-semibold text-emerald-400">
          {selected.length === students.length ? 'Deselect all' : 'Select all'}
        </button>
      )}
    </div>

    {students.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 10v6M2 10l10-5 10 5-10 5-10-5zM6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"
            stroke="#8ea79c"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="max-w-[320px] text-[13px] text-[#8ea79c]">
          No students available for Class: {test?.className}, Subject: {test?.subjectName}
        </p>
        <button onClick={onRetry} className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#eef4f1]">
          Retry fetch
        </button>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {students.map((student) => {
          const isSelected = selected.includes(student._id);
          return (
            <button
              key={student._id}
              onClick={() => onToggle(student._id)}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                isSelected ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#eef4f1]">{student.name}</p>
                <p className="truncate text-[12.5px] text-[#8ea79c]">{student.email}</p>
              </div>
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-white/25'
                }`}
              >
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#0a120f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </ModalShell>
);

export default TeacherHandleTestScreen;