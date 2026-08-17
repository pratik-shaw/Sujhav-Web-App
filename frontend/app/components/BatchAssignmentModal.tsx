/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useEffect, useState } from 'react';
import { getToken } from '../lib/auth';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of BatchAssignmentModal.tsx (Expo). Matches the
// SUJHAV dark ink-green design system used across the admin web screens.
// Same backend routes/behaviour as the app version — renders as a centered
// dialog on desktop and a full-height sheet on mobile.
// ---------------------------------------------------------------------------

const API_BASE_URL = API_BASE;

const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); reject(new Error('Request timeout')); }, timeoutMs);
    fetch(url, { ...options, signal: controller.signal })
      .then((response) => { clearTimeout(timeoutId); resolve(response); })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error?.name === 'AbortError' ? new Error('Request timeout') : error);
      });
  });
};

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'teacher';
  isAssigned?: boolean;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  enrolledAt?: string;
}

interface Subject {
  _id?: string;
  name: string;
  teacher?: User | string;
}

interface Batch {
  _id?: string;
  batchName: string;
  classes: string[];
  subjects: Subject[];
  category: 'jee' | 'neet' | 'boards';
  students: User[];
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

interface BatchData {
  batch: Batch;
  students?: User[];
  teachers?: User[];
  availableClasses?: string[];
  availableSubjects?: Subject[];
  statistics?: {
    totalStudents: number;
    totalSubjects: number;
    totalClasses: number;
    assignedTeachers: number;
    unassignedSubjects: number;
    isActive: boolean;
  };
}

interface BatchAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  batch: Batch | null;
  type: 'assign_students' | 'remove_students' | 'assign_teachers' | 'view_assignments';
  onAssign?: (assignments: StudentAssignment[] | TeacherAssignment[]) => void;
  onSuccess?: () => void;
}

interface ApiResponse {
  success: boolean;
  data?: BatchData;
  message?: string;
}

const Spinner: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ width: size, height: size }} />
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function BatchAssignmentModal({ visible, onClose, batch, type, onAssign, onSuccess }: BatchAssignmentModalProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, StudentAssignment>>({});
  const [teacherAssignments, setTeacherAssignments] = useState<Record<string, TeacherAssignment>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && batch) {
      resetState();
      loadBatchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type, batch?._id]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const resetState = () => {
    setSearchText('');
    setSelectedUsers([]);
    setStudentAssignments({});
    setTeacherAssignments({});
    setError(null);
  };

  const loadBatchData = async () => {
    if (!batch?._id) return;
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      let endpoint = '';
      switch (type) {
        case 'assign_students':
        case 'remove_students':
        case 'view_assignments':
          endpoint = `${API_BASE_URL}/batches/${batch._id}/students-assignments`;
          break;
        case 'assign_teachers':
          endpoint = `${API_BASE_URL}/batches/${batch._id}/teachers-assignments`;
          break;
        default:
          throw new Error('Invalid assignment type');
      }

      const response = await fetchWithTimeout(endpoint, { method: 'GET', headers }, 15000);

      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication failed. Please sign in again.');
        if (response.status === 403) throw new Error('Access denied. Administrator privileges required.');
        if (response.status === 404) throw new Error('Batch not found or endpoint unavailable.');
        if (response.status >= 500) throw new Error('Server error. Please try again later.');
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setBatchData(data.data);
      } else {
        throw new Error(data.message || 'Failed to load batch data');
      }
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Failed to load data';
      setError(message === 'Request timeout' ? 'Request timed out. Please check your connection and try again.' : message);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    switch (type) {
      case 'assign_students': return 'Assign students';
      case 'remove_students': return 'Remove students';
      case 'assign_teachers': return 'Assign teachers';
      case 'view_assignments': return 'View assignments';
      default: return 'Assignment';
    }
  };

  const getUsers = (): User[] => {
    if (!batchData) return [];
    switch (type) {
      case 'assign_students':
        return batchData.students?.filter((u) => !u.isAssigned) || [];
      case 'remove_students':
      case 'view_assignments':
        return batchData.students?.filter((u) => u.isAssigned) || [];
      case 'assign_teachers':
        return batchData.teachers || [];
      default:
        return [];
    }
  };

  const filteredUsers = getUsers().filter(
    (u) => u.name.toLowerCase().includes(searchText.toLowerCase()) || u.email.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const isSelected = selectedUsers.includes(userId);
    if (isSelected) {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
      if (type === 'assign_students') setStudentAssignments((prev) => { const n = { ...prev }; delete n[userId]; return n; });
      if (type === 'assign_teachers') setTeacherAssignments((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    } else {
      setSelectedUsers((prev) => [...prev, userId]);
      if (type === 'assign_students') setStudentAssignments((prev) => ({ ...prev, [userId]: { studentId: userId, assignedClasses: [], assignedSubjects: [] } }));
      if (type === 'assign_teachers') setTeacherAssignments((prev) => ({ ...prev, [userId]: { teacherId: userId, assignedSubjects: [] } }));
    }
  };

  const toggleClassForStudent = (studentId: string, className: string) => {
    setStudentAssignments((prev) => {
      const assignment = prev[studentId];
      if (!assignment) return prev;
      const isSelected = assignment.assignedClasses.includes(className);
      return {
        ...prev,
        [studentId]: {
          ...assignment,
          assignedClasses: isSelected ? assignment.assignedClasses.filter((c) => c !== className) : [...assignment.assignedClasses, className],
        },
      };
    });
  };

  const toggleSubjectForUser = (userId: string, subjectName: string, isTeacher = false) => {
    const setter = isTeacher ? setTeacherAssignments : setStudentAssignments;
    setter((prev: Record<string, any>) => {
      const assignment = prev[userId];
      if (!assignment) return prev;
      const isSelected = assignment.assignedSubjects.includes(subjectName);
      return {
        ...prev,
        [userId]: {
          ...assignment,
          assignedSubjects: isSelected ? assignment.assignedSubjects.filter((s: string) => s !== subjectName) : [...assignment.assignedSubjects, subjectName],
        },
      };
    });
  };

  const removeStudents = async (studentIds: string[]) => {
    if (!batch?._id) throw new Error('Batch ID is required');
    const headers = getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/batches/${batch._id}/remove-students`, {
      method: 'POST', headers, body: JSON.stringify({ studentIds }),
    }, 15000);
    if (!response.ok) throw new Error(`Removal failed: ${response.status}`);
    const result: ApiResponse = await response.json();
    if (!result.success) throw new Error(result.message || 'Removal failed');
  };

  const assignStudentsEnhanced = async (assignments: StudentAssignment[]) => {
    if (!batch?._id) throw new Error('Batch ID is required');
    const headers = getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/batches/${batch._id}/assign-students-enhanced`, {
      method: 'POST', headers, body: JSON.stringify({ studentAssignments: assignments }),
    }, 15000);
    if (!response.ok) throw new Error(`Assignment failed: ${response.status}`);
    const result: ApiResponse = await response.json();
    if (!result.success) throw new Error(result.message || 'Assignment failed');
  };

  const assignTeachersEnhanced = async (assignments: TeacherAssignment[]) => {
    if (!batch?._id) throw new Error('Batch ID is required');
    const headers = getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/batches/${batch._id}/assign-teachers-enhanced`, {
      method: 'POST', headers, body: JSON.stringify({ teacherAssignments: assignments }),
    }, 15000);
    if (!response.ok) throw new Error(`Teacher assignment failed: ${response.status}`);
    const result: ApiResponse = await response.json();
    if (!result.success) throw new Error(result.message || 'Teacher assignment failed');
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      if (type === 'remove_students') {
        await removeStudents(selectedUsers);
      } else if (type === 'assign_students') {
        const assignments = Object.values(studentAssignments);
        if (assignments.some((a) => a.assignedClasses.length === 0 && a.assignedSubjects.length === 0)) {
          setError('Assign at least one class or subject to each selected student.');
          setSubmitting(false);
          return;
        }
        await assignStudentsEnhanced(assignments);
      } else if (type === 'assign_teachers') {
        const assignments = Object.values(teacherAssignments);
        if (assignments.some((a) => a.assignedSubjects.length === 0)) {
          setError('Assign at least one subject to each selected teacher.');
          setSubmitting(false);
          return;
        }
        await assignTeachersEnhanced(assignments);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to complete assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const stats = batchData?.statistics;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 sm:px-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden border border-white/[0.08] bg-[#0a120f] shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-[560px] sm:rounded-2xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h2 className="truncate font-serif text-lg font-semibold text-[#eef4f1]">{getModalTitle()}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#8ea79c] transition-colors hover:border-white/[0.16] hover:text-[#eef4f1]"
          >
            <IconX />
          </button>
        </div>

        {/* batch info */}
        <div className="border-b border-white/[0.08] px-6 py-3.5">
          <p className="truncate text-[15px] font-bold text-[#eef4f1]">{batch?.batchName}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-[#8ea79c]">
            {batch?.category?.toUpperCase()} · {batch?.classes.join(', ')}
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-[13px] text-red-300">
            {error}
          </div>
        )}

        {/* statistics */}
        {stats && type !== 'view_assignments' && (
          <div className="border-b border-white/[0.08] px-6 py-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatBox value={stats.totalStudents || 0} label="Students" />
              <StatBox value={stats.assignedTeachers || 0} label="Teachers" />
              <StatBox value={stats.totalSubjects || 0} label="Subjects" />
              <StatBox value={stats.totalClasses || 0} label="Classes" />
            </div>
            {stats.unassignedSubjects > 0 && (
              <div className="mt-3 rounded-lg bg-amber-400/15 px-3 py-2 text-center text-[12px] text-amber-300">
                {stats.unassignedSubjects} subject(s) without teachers
              </div>
            )}
          </div>
        )}

        {/* search */}
        {type !== 'view_assignments' && (
          <div className="px-6 pt-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8ea79c]"><IconSearch /></span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search users…"
                className="w-full rounded-full border border-emerald-400/30 bg-white/[0.04] py-2.5 pl-9 pr-4 text-[14px] text-[#eef4f1] outline-none placeholder:text-[#5f776e] focus:border-emerald-400/60"
              />
            </div>
          </div>
        )}

        {selectedUsers.length > 0 && type !== 'view_assignments' && (
          <div className="mx-6 mt-3 rounded-lg bg-emerald-400/10 py-2 text-center text-[13px] font-semibold text-emerald-400">
            {selectedUsers.length} user(s) selected
          </div>
        )}

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size={26} />
              <span className="text-[13px] text-[#8ea79c]">Loading data…</span>
            </div>
          ) : error && !batchData ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <button onClick={loadBatchData} className="rounded-full bg-emerald-400 px-5 py-2.5 text-[13px] font-bold text-[#08130f] hover:bg-emerald-300">
                Retry
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[#8ea79c]">
              {type === 'assign_students' && 'No eligible students found.'}
              {type === 'remove_students' && 'No assigned students found.'}
              {type === 'assign_teachers' && 'No teachers found.'}
              {type === 'view_assignments' && 'No assignments found.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((item) => {
                const isSelected = selectedUsers.includes(item._id);
                const studentAssignment = type !== 'assign_teachers' ? studentAssignments[item._id] : undefined;
                const teacherAssignment = type === 'assign_teachers' ? teacherAssignments[item._id] : undefined;

                return (
                  <div key={item._id}>
                    <button
                      onClick={() => type !== 'view_assignments' && toggleUserSelection(item._id)}
                      disabled={type === 'view_assignments'}
                      className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                        isSelected
                          ? 'border-emerald-400/50 bg-emerald-400/[0.08]'
                          : item.isAssigned && type === 'view_assignments'
                          ? 'border-emerald-400/30 bg-emerald-400/[0.05]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-bold text-[#eef4f1]">{item.name}</p>
                        <p className="truncate text-[12.5px] text-[#8ea79c]">{item.email}</p>

                        {type === 'view_assignments' && item.isAssigned && (
                          <div className="mt-2 space-y-1">
                            {!!item.assignedClasses?.length && (
                              <p className="text-[12px] text-[#8ea79c]"><span className="font-bold text-emerald-400">Classes: </span>{item.assignedClasses.join(', ')}</p>
                            )}
                            {!!item.assignedSubjects?.length && (
                              <p className="text-[12px] text-[#8ea79c]"><span className="font-bold text-emerald-400">Subjects: </span>{item.assignedSubjects.join(', ')}</p>
                            )}
                            {item.enrolledAt && (
                              <p className="text-[12px] text-[#8ea79c]"><span className="font-bold text-emerald-400">Enrolled: </span>{new Date(item.enrolledAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {isSelected && type !== 'view_assignments' && <span className="flex-shrink-0 text-emerald-400"><IconCheck /></span>}
                      {item.isAssigned && type === 'view_assignments' && (
                        <span className="flex-shrink-0 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400">ASSIGNED</span>
                      )}
                    </button>

                    {isSelected && type !== 'remove_students' && type !== 'view_assignments' && (
                      <div className="mt-2.5 space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
                        {type === 'assign_students' && !!batchData?.availableClasses?.length && (
                          <div>
                            <p className="mb-2 text-[12.5px] font-bold text-emerald-400">Classes</p>
                            <div className="flex flex-wrap gap-1.5">
                              {batchData.availableClasses.map((className, idx) => {
                                const active = studentAssignment?.assignedClasses?.includes(className);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => toggleClassForStudent(item._id, className)}
                                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                      active ? 'bg-emerald-400 text-[#08130f]' : 'bg-white/[0.06] text-[#eef4f1] hover:bg-white/[0.1]'
                                    }`}
                                  >
                                    {className}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!!batchData?.availableSubjects?.length && (
                          <div>
                            <p className="mb-2 text-[12.5px] font-bold text-emerald-400">Subjects</p>
                            <div className="flex flex-wrap gap-1.5">
                              {batchData.availableSubjects.map((subject, idx) => {
                                const currentAssignment = type === 'assign_teachers' ? teacherAssignment : studentAssignment;
                                const active = currentAssignment?.assignedSubjects?.includes(subject.name);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => toggleSubjectForUser(item._id, subject.name, type === 'assign_teachers')}
                                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                      active ? 'bg-emerald-400 text-[#08130f]' : 'bg-white/[0.06] text-[#eef4f1] hover:bg-white/[0.1]'
                                    }`}
                                  >
                                    {subject.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer actions */}
        {type !== 'view_assignments' && (
          <div className="flex gap-3 border-t border-white/[0.08] px-6 py-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={submitting || selectedUsers.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#08130f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? (
                <Spinner size={16} />
              ) : type === 'assign_students' ? 'Assign students' : type === 'remove_students' ? 'Remove students' : 'Assign teachers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const StatBox: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div>
    <span className="block font-mono text-[18px] font-bold text-emerald-400">{value}</span>
    <span className="mt-0.5 block text-[11px] text-[#8ea79c]">{label}</span>
  </div>
);