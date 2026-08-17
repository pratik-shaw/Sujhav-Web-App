/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of AdminPaidCourseScreen.tsx (Expo). Same SUJHAV
// web design language as AdminDashboardScreen: bg #0a120f, cards #101d17,
// hairline white/[0.08] borders, emerald-400 accent, font-serif headings,
// font-mono for numerals. Uses the same /paidCourses REST routes as the
// mobile app — only the transport (fetch + FormData) is unchanged, the
// layout is a proper responsive web grid instead of a stacked mobile list.
// ---------------------------------------------------------------------------

interface VideoLink {
  _id?: string;
  videoTitle: string;
  videoDescription: string;
  videoLink: string;
  duration: string;
}

interface StudentEnrollment {
  _id?: string;
  studentId: string;
  mode: string;
  schedule: string;
  enrolledAt?: string;
}

interface PaidCourse {
  _id?: string;
  courseTitle: string;
  tutor: string;
  rating: number;
  price: number;
  category: 'jee' | 'neet' | 'boards';
  class: string;
  courseDetails: {
    subtitle: string;
    description: string;
  };
  videoLinks: VideoLink[];
  courseThumbnail: string;
  isActive: boolean;
  studentsEnrolled?: StudentEnrollment[];
  createdAt?: string;
}

interface CourseFormState extends PaidCourse {
  thumbnailFile?: File | null;
  thumbnailPreview?: string;
}

const EMPTY_COURSE: CourseFormState = {
  courseTitle: '',
  tutor: '',
  rating: 0,
  price: 1,
  category: 'jee',
  class: '',
  courseDetails: { subtitle: '', description: '' },
  videoLinks: [],
  courseThumbnail: '',
  isActive: true,
  studentsEnrolled: [],
  thumbnailFile: null,
  thumbnailPreview: '',
};

const EMPTY_VIDEO: VideoLink = {
  videoTitle: '',
  videoDescription: '',
  videoLink: '',
  duration: '',
};

type Toast = { type: 'success' | 'error'; message: string };
type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const CATEGORY_LABEL: Record<PaidCourse['category'], string> = {
  jee: 'JEE',
  neet: 'NEET',
  boards: 'Boards',
};

function formatPrice(price: number) {
  return price >= 1000 ? `₹${(price / 1000).toFixed(1)}K` : `₹${price}`;
}

export default function AdminPaidCourseScreen() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [courses, setCourses] = useState<PaidCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PaidCourse | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<PaidCourse | null>(null);

  const [courseForm, setCourseForm] = useState<CourseFormState>(EMPTY_COURSE);
  const [videoForm, setVideoForm] = useState<VideoLink>(EMPTY_VIDEO);
  const [editingVideo, setEditingVideo] = useState<VideoLink | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (type: Toast['type'], message: string) => setToast({ type, message });

  // ------------------------------------------------------------------------
  // API calls
  // ------------------------------------------------------------------------

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/paidCourses`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setCourses(data.data || []);
      } else {
        notify('error', data.message || 'Failed to load paid courses');
      }
    } catch (error) {
      console.error('Error loading paid courses:', error);
      notify('error', 'Failed to load paid courses. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const saveCourse = async () => {
    if (!validateCourse()) return;

    try {
      setSaving(true);
      const url = editingCourse
        ? `${API_BASE}/paidCourses/${editingCourse._id}`
        : `${API_BASE}/paidCourses`;
      const method = editingCourse ? 'PUT' : 'POST';

      const formData = new FormData();
      formData.append('courseTitle', courseForm.courseTitle);
      formData.append('tutor', courseForm.tutor);
      formData.append('rating', courseForm.rating.toString());
      formData.append('price', courseForm.price.toString());
      formData.append('category', courseForm.category);
      formData.append('class', courseForm.class);
      formData.append('courseDetails', JSON.stringify(courseForm.courseDetails));
      formData.append('videoLinks', JSON.stringify(courseForm.videoLinks));
      formData.append('isActive', courseForm.isActive.toString());

      if (courseForm.thumbnailFile) {
        formData.append('thumbnail', courseForm.thumbnailFile);
      }

      const response = await fetch(url, { method, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.success) {
        notify('success', editingCourse ? 'Course updated' : 'Course created');
        resetForm();
        setShowAddModal(false);
        loadCourses();
      } else {
        notify('error', data.message || 'Failed to save paid course');
      }
    } catch (error) {
      console.error('Error saving paid course:', error);
      notify('error', 'Failed to save paid course. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = (courseId?: string) => {
    if (!courseId) {
      notify('error', 'Course ID is required');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Delete paid course',
      message: 'Are you sure you want to delete this paid course? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_BASE}/paidCourses/${courseId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          if (data.success) {
            notify('success', 'Paid course deleted');
            loadCourses();
          } else {
            notify('error', data.message || 'Failed to delete paid course');
          }
        } catch (error) {
          console.error('Error deleting paid course:', error);
          notify('error', 'Failed to delete paid course. Please check your connection.');
        } finally {
          setLoading(false);
          setConfirmState(null);
        }
      },
    });
  };

  const addVideoToCourse = async () => {
    if (!validateVideo()) return;
    if (!selectedCourse?._id) {
      notify('error', 'Course not selected');
      return;
    }
    try {
      setVideoSaving(true);
      const response = await fetch(`${API_BASE}/paidCourses/${selectedCourse._id}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoForm),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        notify('success', 'Video added to course');
        setVideoForm(EMPTY_VIDEO);
        setSelectedCourse(data.data);
        loadCourses();
      } else {
        notify('error', data.message || 'Failed to add video');
      }
    } catch (error) {
      console.error('Error adding video:', error);
      notify('error', 'Failed to add video. Please check your connection.');
    } finally {
      setVideoSaving(false);
    }
  };

  const updateVideoInCourse = async () => {
    if (!validateVideo()) return;
    if (!selectedCourse?._id || !editingVideo?._id) {
      notify('error', 'Invalid course or video selection');
      return;
    }
    try {
      setVideoSaving(true);
      const response = await fetch(
        `${API_BASE}/paidCourses/${selectedCourse._id}/videos/${editingVideo._id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(videoForm),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        notify('success', 'Video updated');
        setVideoForm(EMPTY_VIDEO);
        setEditingVideo(null);
        setSelectedCourse(data.data);
        loadCourses();
      } else {
        notify('error', data.message || 'Failed to update video');
      }
    } catch (error) {
      console.error('Error updating video:', error);
      notify('error', 'Failed to update video. Please check your connection.');
    } finally {
      setVideoSaving(false);
    }
  };

  const deleteVideoFromCourse = (videoId?: string) => {
    if (!selectedCourse?._id || !videoId) {
      notify('error', 'Invalid course or video selection');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Delete video',
      message: 'Are you sure you want to delete this video from the paid course?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          setVideoSaving(true);
          const response = await fetch(
            `${API_BASE}/paidCourses/${selectedCourse._id}/videos/${videoId}`,
            { method: 'DELETE' }
          );
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          if (data.success) {
            notify('success', 'Video deleted');
            setSelectedCourse(data.data);
            loadCourses();
          } else {
            notify('error', data.message || 'Failed to delete video');
          }
        } catch (error) {
          console.error('Error deleting video:', error);
          notify('error', 'Failed to delete video. Please check your connection.');
        } finally {
          setVideoSaving(false);
          setConfirmState(null);
        }
      },
    });
  };

  // ------------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------------

  const validateCourse = () => {
    if (!courseForm.courseTitle?.trim()) return notify('error', 'Course title is required'), false;
    if (!courseForm.tutor?.trim()) return notify('error', 'Tutor name is required'), false;
    if (!courseForm.class?.trim()) return notify('error', 'Class is required'), false;
    if (!courseForm.courseDetails?.subtitle?.trim()) return notify('error', 'Subtitle is required'), false;
    if (!courseForm.courseDetails?.description?.trim())
      return notify('error', 'Description is required'), false;
    if (!courseForm.thumbnailFile && !courseForm.courseThumbnail)
      return notify('error', 'Thumbnail is required'), false;
    if (courseForm.price < 1) return notify('error', 'Price must be at least ₹1 for paid courses'), false;
    if (courseForm.rating < 0 || courseForm.rating > 5)
      return notify('error', 'Rating must be between 0 and 5'), false;
    return true;
  };

  const validateVideo = () => {
    if (!videoForm.videoTitle?.trim()) return notify('error', 'Video title is required'), false;
    if (!videoForm.videoDescription?.trim())
      return notify('error', 'Video description is required'), false;
    if (!videoForm.videoLink?.trim()) return notify('error', 'Video link is required'), false;
    try {
      new URL(videoForm.videoLink);
    } catch {
      notify('error', 'Please enter a valid video URL');
      return false;
    }
    if (!videoForm.duration?.trim()) return notify('error', 'Video duration is required'), false;
    return true;
  };

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------

  const resetForm = () => {
    setCourseForm(EMPTY_COURSE);
    setEditingCourse(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const editCourse = (course: PaidCourse) => {
    setCourseForm({
      ...course,
      courseDetails: course.courseDetails || { subtitle: '', description: '' },
      videoLinks: course.videoLinks || [],
      rating: course.rating || 0,
      price: course.price || 1,
      isActive: course.isActive !== undefined ? course.isActive : true,
      studentsEnrolled: course.studentsEnrolled || [],
      thumbnailFile: null,
      thumbnailPreview: course.courseThumbnail || '',
    });
    setEditingCourse(course);
    setShowAddModal(true);
  };

  const editVideo = (video: VideoLink) => {
    setVideoForm({
      videoTitle: video.videoTitle,
      videoDescription: video.videoDescription,
      videoLink: video.videoLink,
      duration: video.duration,
    });
    setEditingVideo(video);
  };

  const cancelVideoEdit = () => {
    setVideoForm(EMPTY_VIDEO);
    setEditingVideo(null);
  };

  const manageVideos = (course: PaidCourse) => {
    setSelectedCourse(course);
    setShowVideoModal(true);
  };

  const closeCourseModal = () => {
    resetForm();
    setShowAddModal(false);
  };

  const closeVideoModal = () => {
    setVideoForm(EMPTY_VIDEO);
    setEditingVideo(null);
    setSelectedCourse(null);
    setShowVideoModal(false);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCourseForm((prev) => ({
      ...prev,
      thumbnailFile: file,
      thumbnailPreview: URL.createObjectURL(file),
    }));
  };

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      {/* ambient glows */}
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
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0 leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">
                Course management
              </span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">
                Paid courses
              </h1>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-[13px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Add course</span>
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
          <div className="grid grid-cols-2 divide-x divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-[#101d17] sm:grid-cols-4">
            <StatItem label="Total courses" value={courses.length} />
            <StatItem label="Active" value={courses.filter((c) => c.isActive).length} />
            <StatItem
              label="Total videos"
              value={courses.reduce((sum, c) => sum + (c.videoLinks?.length || 0), 0)}
            />
            <StatItem
              label="Students enrolled"
              value={courses.reduce((sum, c) => sum + (c.studentsEnrolled?.length || 0), 0)}
            />
          </div>
        </section>

        {/* course list */}
        <section
          className={`transition-all duration-500 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {loading && courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17] py-24">
              <Spinner />
              <p className="mt-4 text-[13.5px] text-[#8ea79c]">Loading paid courses…</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17] py-24 text-center">
              <p className="text-[15px] font-semibold text-[#eef4f1]">No paid courses yet</p>
              <p className="mt-1.5 max-w-xs text-[13px] text-[#8ea79c]">
                Create your first premium course to get it in front of students.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-6 rounded-full bg-emerald-400 px-5 py-2.5 text-[13.5px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300"
              >
                Create your first course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course._id}
                  course={course}
                  onEdit={() => editCourse(course)}
                  onManageVideos={() => manageVideos(course)}
                  onDelete={() => deleteCourse(course._id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* loading overlay for background actions (delete etc.) */}
      {loading && courses.length > 0 && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <Spinner size={34} />
        </div>
      )}

      {/* Add / Edit course modal */}
      {showAddModal && (
        <ModalShell
          title={editingCourse ? 'Edit course' : 'Add course'}
          onClose={closeCourseModal}
          widthClass="max-w-2xl"
        >
          <div className="space-y-5">
            <Field label="Course title" required>
              <TextInput
                value={courseForm.courseTitle}
                onChange={(v) => setCourseForm({ ...courseForm, courseTitle: v })}
                placeholder="Enter course title"
              />
            </Field>

            <Field label="Tutor name" required>
              <TextInput
                value={courseForm.tutor}
                onChange={(v) => setCourseForm({ ...courseForm, tutor: v })}
                placeholder="Enter tutor name"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Rating (0–5)">
                <TextInput
                  type="number"
                  value={courseForm.rating.toString()}
                  onChange={(v) =>
                    setCourseForm({
                      ...courseForm,
                      rating: Math.min(Math.max(parseFloat(v) || 0, 0), 5),
                    })
                  }
                  step="0.5"
                  min="0"
                  max="5"
                />
              </Field>
              <Field label="Price (₹)" required>
                <TextInput
                  type="number"
                  value={courseForm.price.toString()}
                  onChange={(v) =>
                    setCourseForm({ ...courseForm, price: Math.max(parseFloat(v) || 1, 1) })
                  }
                  min="1"
                />
              </Field>
            </div>
            <p className="-mt-3 text-[12px] italic text-amber-300/90">💰 Minimum price: ₹1</p>

            <Field label="Category" required>
              <div className="grid grid-cols-3 gap-2">
                {(['jee', 'neet', 'boards'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCourseForm({ ...courseForm, category: cat })}
                    className={`rounded-lg border px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                      courseForm.category === cat
                        ? 'border-emerald-400 bg-emerald-400 text-[#06170f]'
                        : 'border-white/[0.1] bg-white/[0.03] text-[#8ea79c] hover:border-white/[0.2]'
                    }`}
                  >
                    {CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Class" required>
              <TextInput
                value={courseForm.class}
                onChange={(v) => setCourseForm({ ...courseForm, class: v })}
                placeholder="e.g., 11, 12"
              />
            </Field>

            <Field label="Subtitle" required>
              <TextInput
                value={courseForm.courseDetails.subtitle}
                onChange={(v) =>
                  setCourseForm({
                    ...courseForm,
                    courseDetails: { ...courseForm.courseDetails, subtitle: v },
                  })
                }
                placeholder="Enter course subtitle"
              />
            </Field>

            <Field label="Description" required>
              <textarea
                value={courseForm.courseDetails.description}
                onChange={(e) =>
                  setCourseForm({
                    ...courseForm,
                    courseDetails: { ...courseForm.courseDetails, description: e.target.value },
                  })
                }
                placeholder="Enter detailed course description"
                rows={4}
                className="w-full resize-none rounded-lg border border-white/[0.1] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
              />
            </Field>

            <Field label="Course thumbnail" required>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="hidden"
                id="thumbnail-input"
              />
              <label
                htmlFor="thumbnail-input"
                className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/[0.16] bg-white/[0.03] px-4 py-3 text-[13.5px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/50"
              >
                {courseForm.thumbnailFile || courseForm.thumbnailPreview
                  ? 'Change thumbnail'
                  : 'Select thumbnail'}
              </label>
              {courseForm.thumbnailPreview && (
                <img
                  src={courseForm.thumbnailPreview}
                  alt="Thumbnail preview"
                  className="mt-3 h-44 w-full rounded-lg border border-white/[0.08] object-cover"
                />
              )}
            </Field>

            <Field label="Course status">
              <button
                type="button"
                onClick={() => setCourseForm({ ...courseForm, isActive: !courseForm.isActive })}
                className={`rounded-lg border px-4 py-2.5 text-[13.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                  courseForm.isActive
                    ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
                    : 'border-red-400/40 bg-red-400/10 text-red-300'
                }`}
              >
                {courseForm.isActive ? '✓ Active' : '✕ Inactive'}
              </button>
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-6 mt-6 border-t border-white/[0.08] bg-[#101d17] px-6 pt-4">
            <button
              onClick={saveCourse}
              disabled={saving}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-400 py-3 text-[14.5px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Spinner size={18} dark /> : editingCourse ? 'Update course' : 'Create course'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Video management modal */}
      {showVideoModal && selectedCourse && (
        <ModalShell
          title={selectedCourse.courseTitle || 'Videos'}
          onClose={closeVideoModal}
          widthClass="max-w-2xl"
        >
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="mb-4 font-serif text-[15px] font-semibold text-[#eef4f1]">
              {editingVideo ? 'Edit video' : 'Add new video'}
            </h3>

            <div className="space-y-4">
              <Field label="Video title" required>
                <TextInput
                  value={videoForm.videoTitle}
                  onChange={(v) => setVideoForm({ ...videoForm, videoTitle: v })}
                  placeholder="Enter video title"
                />
              </Field>

              <Field label="Video description" required>
                <textarea
                  value={videoForm.videoDescription}
                  onChange={(e) => setVideoForm({ ...videoForm, videoDescription: e.target.value })}
                  placeholder="Enter video description"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.1] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
                />
              </Field>

              <Field label="Video link" required>
                <TextInput
                  value={videoForm.videoLink}
                  onChange={(v) => setVideoForm({ ...videoForm, videoLink: v })}
                  placeholder="https://youtube.com/watch?v=..."
                  type="url"
                />
              </Field>

              <Field label="Duration" required>
                <TextInput
                  value={videoForm.duration}
                  onChange={(v) => setVideoForm({ ...videoForm, duration: v })}
                  placeholder="e.g., 15:30, 1h 20m"
                />
              </Field>

              <div className="flex gap-3 pt-1">
                {editingVideo ? (
                  <>
                    <button
                      onClick={updateVideoInCourse}
                      disabled={videoSaving}
                      className="flex flex-1 items-center justify-center rounded-lg bg-amber-400 py-2.5 text-[13.5px] font-bold text-[#211505] transition-colors hover:bg-amber-300 disabled:opacity-60"
                    >
                      {videoSaving ? <Spinner size={16} dark /> : 'Update'}
                    </button>
                    <button
                      onClick={cancelVideoEdit}
                      className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] py-2.5 text-[13.5px] font-bold text-[#eef4f1] transition-colors hover:border-white/[0.2]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={addVideoToCourse}
                    disabled={videoSaving}
                    className="flex w-full items-center justify-center rounded-lg bg-emerald-400 py-2.5 text-[13.5px] font-bold text-[#06170f] transition-colors hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {videoSaving ? <Spinner size={16} dark /> : 'Add video'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="mb-4 font-serif text-[15px] font-semibold text-[#eef4f1]">
              Videos ({selectedCourse.videoLinks?.length || 0})
            </h3>

            {selectedCourse.videoLinks && selectedCourse.videoLinks.length > 0 ? (
              <ul className="space-y-2.5">
                {selectedCourse.videoLinks.map((video, index) => (
                  <li
                    key={video._id || index}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#0a120f] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[#eef4f1]">
                        {video.videoTitle || 'Untitled video'}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[#8ea79c]">
                        {video.videoDescription || 'No description'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#5c7268]">
                        Duration: {video.duration || 'N/A'}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1.5">
                      <button
                        onClick={() => editVideo(video)}
                        aria-label="Edit video"
                        className="rounded-md bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-400/25"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVideoFromCourse(video._id)}
                        aria-label="Delete video"
                        className="rounded-md bg-red-400/15 px-2.5 py-1.5 text-[11px] font-bold text-red-300 transition-colors hover:bg-red-400/25"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <p className="text-[14px] text-[#8ea79c]">No videos yet</p>
                <p className="mt-1 text-[12px] text-[#5c7268]">Add your first video above</p>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* confirm dialog */}
      {confirmState?.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setConfirmState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"
                  stroke="#f87171"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{confirmState.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">{confirmState.message}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmState(null)}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16]"
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                className="flex-1 rounded-[10px] bg-red-400/90 px-4 py-2.5 text-[14px] font-bold text-[#1a0505] transition-colors hover:bg-red-400"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-6">
          <div
            className={`flex items-center gap-2.5 rounded-full border px-5 py-3 text-[13.5px] font-semibold shadow-2xl backdrop-blur-md ${
              toast.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                : 'border-red-400/30 bg-red-400/15 text-red-300'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

const StatItem: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex flex-col items-center gap-1 px-4 py-5 text-center">
    <span className="font-mono text-[22px] font-bold text-emerald-400">{value}</span>
    <span className="text-[11.5px] text-[#8ea79c]">{label}</span>
  </div>
);

const Spinner: React.FC<{ size?: number; dark?: boolean }> = ({ size = 26, dark = false }) => (
  <svg
    className="animate-spin"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ color: dark ? '#06170f' : '#34d399' }}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div>
    <label className="mb-1.5 block text-[13px] font-semibold text-[#eef4f1]">
      {label}
      {required && <span className="ml-1 text-emerald-400">*</span>}
    </label>
    {children}
  </div>
);

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
}> = ({ value, onChange, placeholder, type = 'text', step, min, max }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    step={step}
    min={min}
    max={max}
    className="w-full rounded-lg border border-white/[0.1] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
  />
);

const ModalShell: React.FC<{
  title: string;
  onClose: () => void;
  widthClass?: string;
  children: React.ReactNode;
}> = ({ title, onClose, widthClass = 'max-w-xl', children }) => (
  <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-sm sm:items-center">
    <div
      className={`relative w-full ${widthClass} rounded-2xl border border-white/[0.08] bg-[#101d17] shadow-2xl`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-white/[0.08] bg-[#101d17] px-6 py-4">
        <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8ea79c] transition-colors hover:border-red-400/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-6 py-6">{children}</div>
    </div>
  </div>
);

const CourseCard: React.FC<{
  course: PaidCourse;
  onEdit: () => void;
  onManageVideos: () => void;
  onDelete: () => void;
}> = ({ course, onEdit, onManageVideos, onDelete }) => (
  <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17] transition-colors hover:border-white/[0.16]">
    <div className="relative h-40 w-full overflow-hidden bg-white/[0.03]">
      {course.courseThumbnail ? (
        <img
          src={course.courseThumbnail}
          alt={course.courseTitle}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[12px] text-[#5c7268]">
          No thumbnail
        </div>
      )}
      <span className="absolute right-3 top-3 rounded-full border border-amber-300/40 bg-[#0a120f]/85 px-3 py-1 text-[12px] font-bold text-amber-300 backdrop-blur-sm">
        {formatPrice(course.price || 1)}
      </span>
      <span
        className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide backdrop-blur-sm ${
          course.isActive
            ? 'border border-emerald-400/40 bg-[#0a120f]/85 text-emerald-300'
            : 'border border-red-400/40 bg-[#0a120f]/85 text-red-300'
        }`}
      >
        {course.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>

    <div className="flex flex-1 flex-col p-5">
      <p className="line-clamp-2 font-serif text-[16px] font-bold leading-snug text-[#eef4f1]">
        {course.courseTitle || 'Untitled course'}
      </p>
      <p className="mt-1 text-[12.5px] text-[#8ea79c]">by {course.tutor || 'Unknown'}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[#8ea79c]">
        <span>{course.category ? CATEGORY_LABEL[course.category] : 'N/A'}</span>
        <span>Class {course.class || 'N/A'}</span>
        <span>⭐ {course.rating || 0}</span>
        <span>{course.studentsEnrolled?.length || 0} students</span>
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-[13px] italic text-[#8ea79c]">
        {course.courseDetails?.subtitle || 'No subtitle available'}
      </p>

      <div className="mt-5 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg bg-emerald-400/15 py-2 text-[12px] font-bold text-emerald-300 transition-colors hover:bg-emerald-400/25"
        >
          Edit
        </button>
        <button
          onClick={onManageVideos}
          className="flex-1 rounded-lg bg-amber-400/15 py-2 text-[12px] font-bold text-amber-300 transition-colors hover:bg-amber-400/25"
        >
          Videos ({course.videoLinks?.length || 0})
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded-lg bg-red-400/15 py-2 text-[12px] font-bold text-red-300 transition-colors hover:bg-red-400/25"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);