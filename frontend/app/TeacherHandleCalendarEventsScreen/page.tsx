/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken } from '../lib/auth';
import EventCalendar from '../components/EventCalendar';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of TeacherHandleCalendarEventsScreen.tsx (Expo).
// Same backend contracts (GET/POST/PUT/DELETE /calendar/events), same dark
// SUJHAV design language as the rest of the web dashboard: bg #0a120f,
// cards #101d17, hairline white/[0.08] borders, emerald-400 accent,
// font-serif headings, font-mono for numerals. The EventCalendar component
// is reused as-is. Responsive: calendar + list sit side by side on large
// screens and stack on mobile; the create/edit form is a proper modal
// instead of a native picker sheet.
// ---------------------------------------------------------------------------

type EventType = 'class' | 'exam' | 'assignment' | 'meeting' | 'other';

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  batchId: string;
  createdBy: { _id: string; name: string; email: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EventFormData {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: EventType;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const EVENT_TYPES: { key: EventType; label: string; color: string }[] = [
  { key: 'class', label: 'Class', color: '#4ade80' },
  { key: 'exam', label: 'Exam', color: '#f87171' },
  { key: 'assignment', label: 'Assignment', color: '#fb923c' },
  { key: 'meeting', label: 'Meeting', color: '#38bdf8' },
  { key: 'other', label: 'Other', color: '#c084fc' },
];

const pad = (n: number) => n.toString().padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTimeStr = (offsetMinutes = 0) => {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const getEventTypeConfig = (type: string) => EVENT_TYPES.find((t) => t.key === type) || EVENT_TYPES[0];

const TeacherHandleCalendarEventsScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') || '';
  const batchName = searchParams.get('batchName') || 'Batch';

  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  const emptyForm: EventFormData = {
    title: '',
    description: '',
    date: todayStr(),
    startTime: nowTimeStr(),
    endTime: nowTimeStr(60),
    type: 'class',
  };
  const [formData, setFormData] = useState<EventFormData>(emptyForm);

  useEffect(() => setMounted(true), []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) {
        setNotice({ type: 'error', title: 'Error', message: 'No authentication token found' });
        return;
      }

      const response = await fetch(`${API_BASE}/calendar/events/${batchId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        setNotice({ type: 'error', title: 'Error', message: `Server returned: ${responseText.substring(0, 100)}...` });
        return;
      }

      if (data.success) {
        setEvents(data.data);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch events' });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
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
    if (!batchId) {
      setNotice({ type: 'error', title: 'Missing batch', message: 'No batch was specified for this calendar.' });
      return;
    }
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const getEventStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalEvents = events.length;

    const todaysEvents = events.filter((event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    }).length;

    const upcomingEvents = events.filter((event) => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() > today.getTime();
    }).length;

    return { totalEvents, todaysEvents, upcomingEvents };
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      ...emptyForm,
      date: selectedDate
        ? `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
        : todayStr(),
    });
    setIsModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      date: event.date.split('T')[0],
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormData(emptyForm);
  };

  const handleEventAction = async () => {
    if (!formData.title.trim()) {
      setNotice({ type: 'error', title: 'Error', message: 'Please enter an event title' });
      return;
    }

    const isEdit = !!editingEvent;

    try {
      setSaving(true);
      const token = getToken();

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        type: formData.type,
        ...(isEdit ? {} : { batchId }),
      };

      const url = isEdit ? `${API_BASE}/calendar/events/${editingEvent!._id}` : `${API_BASE}/calendar/events`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();

      if (data.success) {
        setNotice({ type: 'success', title: 'Success', message: `Event ${isEdit ? 'updated' : 'created'} successfully` });
        closeModal();
        fetchEvents();
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || `Failed to ${isEdit ? 'update' : 'create'} event` });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const token = getToken();
      const response = await fetch(`${API_BASE}/calendar/events/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setNotice({ type: 'success', title: 'Success', message: 'Event deleted successfully' });
        setDeleteTarget(null);
        fetchEvents();
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to delete event' });
      }
    } catch {
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  const getFilteredEvents = () => {
    if (!selectedDate) return events;
    return events.filter((event) => new Date(event.date).toDateString() === selectedDate.toDateString());
  };

  const stats = getEventStats();
  const sortedFilteredEvents = [...getFilteredEvents()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="relative min-h-screen bg-[#0a120f] pb-24 font-sans">
      {/* ambient glows */}
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
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
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
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">Calendar events</span>
              <h1 className="mt-0.5 truncate font-serif text-xl font-semibold text-[#eef4f1]">{batchName}</h1>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            <button
              onClick={onRefresh}
              disabled={refreshing || isLoading}
              aria-label="Refresh events"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
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
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3.5 py-2 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">New event</span>
            </button>
          </div>
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
        {/* stats */}
        <section className={`mb-8 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total events" count={stats.totalEvents} color="#34d399" icon="event" />
            <StatCard title="Today" count={stats.todaysEvents} color="#38bdf8" icon="today" />
            <StatCard title="Upcoming" count={stats.upcomingEvents} color="#fb923c" icon="schedule" />
          </div>
        </section>

        {/* calendar + events */}
        <section className={`grid grid-cols-1 gap-6 transition-all duration-500 delay-100 xl:grid-cols-[380px_1fr] ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          <div className="xl:sticky xl:top-24 xl:self-start">
            <EventCalendar events={events} onDateSelect={setSelectedDate} onEventPress={openEditModal} />
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">
                  {selectedDate ? `Events on ${selectedDate.toLocaleDateString()}` : 'All events'}
                </h2>
                {selectedDate ? (
                  <button onClick={() => setSelectedDate(null)} className="mt-1 text-[13px] text-emerald-400 hover:underline">
                    Clear date filter
                  </button>
                ) : (
                  <p className="mt-1 text-[13px] text-[#8ea79c]">Select a date on the calendar to filter</p>
                )}
              </div>
            </div>

            {isLoading && !refreshing ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#101d17] py-20">
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
                <p className="mt-3.5 text-sm text-[#8ea79c]">Loading events&hellip;</p>
              </div>
            ) : sortedFilteredEvents.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sortedFilteredEvents.map((event) => (
                  <EventCard key={event._id} event={event} onEdit={() => openEditModal(event)} onDelete={() => setDeleteTarget(event)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                    stroke="#8ea79c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No events found</p>
                <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                  {selectedDate ? 'No events scheduled for this date. Create one to get started.' : 'No events created yet. Create your first event.'}
                </p>
                <button
                  onClick={openCreateModal}
                  className="mt-5 rounded-lg bg-emerald-400 px-4 py-2.5 text-[13px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300"
                >
                  New event
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* create / edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:px-6" onClick={() => !saving && closeModal()}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/[0.08] bg-[#101d17] shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
              <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">{editingEvent ? 'Edit event' : 'Create new event'}</h3>
              <button onClick={closeModal} aria-label="Close" className="text-[#8ea79c] hover:text-[#eef4f1]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 py-6">
              <Field label="Event title *">
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter event title"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/50 focus:outline-none"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter event description (optional)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] placeholder:text-[#5c7268] focus:border-emerald-400/50 focus:outline-none"
                />
              </Field>

              <Field label="Event type">
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => {
                    const selected = formData.type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, type: t.key }))}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors ${
                          selected ? 'bg-white/[0.06] text-[#eef4f1]' : 'border-white/[0.08] text-[#8ea79c] hover:border-white/[0.16]'
                        }`}
                        style={{ borderColor: selected ? t.color : undefined }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] [color-scheme:dark] focus:border-emerald-400/50 focus:outline-none"
                  />
                </Field>
                <Field label="Start time">
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] [color-scheme:dark] focus:border-emerald-400/50 focus:outline-none"
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0a120f] px-3.5 py-2.5 text-[14px] text-[#eef4f1] [color-scheme:dark] focus:border-emerald-400/50 focus:outline-none"
                  />
                </Field>
              </div>
            </div>

            <div className="flex gap-3 border-t border-white/[0.08] px-6 py-5">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={handleEventAction}
                disabled={saving}
                className="flex-1 rounded-[10px] bg-emerald-400 px-4 py-2.5 text-[14px] font-bold text-[#04140d] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving ? (editingEvent ? 'Updating…' : 'Creating…') : editingEvent ? 'Update event' : 'Create event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101d17] p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                  stroke="#f87171"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Delete event</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8ea79c]">
              Are you sure you want to delete &ldquo;{deleteTarget.title}&rdquo;? This can&apos;t be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-[#eef4f1] transition-colors hover:border-white/[0.16] disabled:opacity-55"
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
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-[13px] font-semibold text-[#eef4f1]">{label}</span>
    {children}
  </label>
);

const StatCard: React.FC<{ title: string; count: number; color: string; icon: 'event' | 'today' | 'schedule' }> = ({
  title,
  count,
  color,
}) => (
  <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${color}20` }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </div>
    <div>
      <p className="font-mono text-2xl font-bold text-[#eef4f1]">{count}</p>
      <p className="text-[12.5px] font-medium text-[#8ea79c]">{title}</p>
    </div>
  </div>
);

const EventCard: React.FC<{ event: CalendarEvent; onEdit: () => void; onDelete: () => void }> = ({ event, onEdit, onDelete }) => {
  const typeConfig = getEventTypeConfig(event.type);
  const eventDate = new Date(event.date);

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${typeConfig.color}20` }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeConfig.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-[#eef4f1]">{event.title}</p>
          <p className="mt-0.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: typeConfig.color }}>
            {typeConfig.label}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={onEdit}
            aria-label="Edit event"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-emerald-400 transition-colors hover:border-emerald-400/30"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete event"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10 text-red-300 transition-colors hover:border-red-400/40"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {event.description && <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-[#8ea79c]">{event.description}</p>}

      <div className="mb-3 flex flex-col gap-1.5 text-[12.5px] text-[#c7d6cf]">
        <span className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
              stroke="#8ea79c"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {eventDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#8ea79c" strokeWidth="1.6" />
            <path d="M12 7v5l3 3" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {event.startTime} &ndash; {event.endTime}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
        <span className="truncate text-[11.5px] text-[#8ea79c]">By {event.createdBy?.name || 'Unknown'}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            event.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.06] text-[#8ea79c]'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: event.isActive ? '#34d399' : '#8ea79c' }} />
          {event.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
};

export default TeacherHandleCalendarEventsScreen;