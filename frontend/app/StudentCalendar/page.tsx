/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken, getStoredUserData, clearSession } from '../lib/auth';
import BottomNavigation from '../components/BottomNavigation';
import SignupLoginBanner from '../components/SignupLoginBanner';
import EventCalendar from '../components/EventCalendar';

// ---------------------------------------------------------------------------
// Web (Tailwind) rewrite of StudentCalendarScreen.tsx (Expo). Same backend
// contract (`GET /calendar/student/my-events`), same design language as the
// rest of the SUJHAV web dashboard: bg #0a120f, cards #101d17, hairline
// white/[0.08] borders, emerald-400 accent, font-serif headings, font-mono
// for numerals. Responsive: single column on mobile, calendar + list split
// on larger screens.
// ---------------------------------------------------------------------------

interface UserData {
  id: string;
  email: string;
  name: string;
  token: string;
  role?: string;
}

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'exam' | 'assignment' | 'meeting' | 'other';
  batchId: { _id: string; batchName: string };
  createdBy: { _id: string; name: string; email: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EventCalendarEvent {
  _id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'exam' | 'assignment' | 'meeting' | 'other';
  batchId: string;
  createdBy: { _id: string; name: string; email: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const EVENT_TYPES: Record<CalendarEvent['type'], { label: string; color: string }> = {
  class: { label: 'Class', color: '#34d399' },
  exam: { label: 'Exam', color: '#f2685a' },
  assignment: { label: 'Assignment', color: '#f0b429' },
  meeting: { label: 'Meeting', color: '#38bdf8' },
  other: { label: 'Other', color: '#a78bfa' },
};

const EVENT_ICON_PATH: Record<CalendarEvent['type'], React.ReactNode> = {
  class: <path d="M4 6h16v10H4z M8 21h8 M4 12h16" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  exam: <path d="M9 11l3 3 6-6 M4 4h16v16H4z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  assignment: <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  meeting: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  other: <path d="M12 8v4l3 3 M12 22a10 10 0 100-20 10 10 0 000 20z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
};

const StudentCalendarScreen: React.FC = () => {
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const checkAuthStatus = (): UserData | null => {
    const token = getToken();
    const stored = getStoredUserData();

    if (token && stored?.id && stored?.name) {
      const userDataObj: UserData = {
        id: stored.id,
        name: stored.name,
        email: stored.email || '',
        token,
      };
      setUserData(userDataObj);
      setIsLoggedIn(true);
      return userDataObj;
    }

    setIsLoggedIn(false);
    setUserData(null);
    setShowBanner(true);
    return null;
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const currentUserData = checkAuthStatus();
      if (!currentUserData) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/calendar/student/my-events`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${currentUserData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        clearSession();
        setIsLoggedIn(false);
        setUserData(null);
        setShowBanner(true);
        return;
      }

      const responseText = await response.text();
      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        setNotice({ type: 'error', title: 'Error', message: `Server returned: ${responseText.substring(0, 100)}...` });
        return;
      }

      if (data.success) {
        setEvents(data.data || []);
      } else {
        setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch events' });
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transformEventsForCalendar = (evts: CalendarEvent[]): EventCalendarEvent[] =>
    evts.map((event) => ({ ...event, batchId: event.batchId._id }));

  const getEventStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalEvents = events.length;

    const todaysEvents = events.filter((event) => {
      const d = new Date(event.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    const upcomingEvents = events.filter((event) => {
      const d = new Date(event.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() > today.getTime();
    }).length;

    const batchCount = new Set(events.map((event) => event.batchId._id)).size;

    return { totalEvents, todaysEvents, upcomingEvents, batchCount };
  };

  const getFilteredEvents = () => {
    if (!selectedDate) return events;
    return events.filter((event) => new Date(event.date).toDateString() === selectedDate.toDateString());
  };

  if (loading && isLoggedIn === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a120f]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading&hellip;</p>
      </div>
    );
  }

  const stats = getEventStats();
  const filteredEvents = getFilteredEvents().sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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
          <div className="flex items-center gap-3">
            <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="h-[34px] w-[34px] rounded-lg object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] text-emerald-400">SUJHAV</span>
              <h1 className="mt-0.5 font-serif text-xl font-semibold text-[#eef4f1]">Calendar</h1>
            </div>
          </div>
          {isLoggedIn && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh events"
            >
              <svg className={refreshing ? 'animate-spin' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0011.9 3.1M19 9a7 7 0 00-11.9-3.1"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Refresh</span>
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
        {isLoggedIn === false ? (
          <UnauthenticatedContent router={router} mounted={mounted} />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading your events&hellip;</p>
          </div>
        ) : (
          <div className="pt-1">
            <StatisticsStrip stats={stats} mounted={mounted} />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_1fr]">
              {/* calendar column */}
              <aside
                className={`lg:sticky lg:top-[92px] transition-all duration-500 delay-75 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <EventCalendar events={transformEventsForCalendar(events)} onDateSelect={setSelectedDate} onEventPress={() => {}} />

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/[0.08] bg-[#101d17] p-4">
                  {(Object.keys(EVENT_TYPES) as CalendarEvent['type'][]).map((key) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: EVENT_TYPES[key].color }} />
                      <span className="text-[12px] text-[#8ea79c]">{EVENT_TYPES[key].label}</span>
                    </div>
                  ))}
                </div>
              </aside>

              {/* events column */}
              <section
                className={`min-w-0 transition-all duration-500 delay-100 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-[#eef4f1]">
                      {selectedDate ? `Events on ${selectedDate.toLocaleDateString()}` : 'All my events'}
                    </h2>
                    <p className="mt-1 text-[13px] text-[#8ea79c]">
                      {selectedDate ? 'Click a calendar date to change the view.' : `Events from all your ${stats.batchCount} assigned batches`}
                    </p>
                  </div>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30"
                    >
                      Show all events
                    </button>
                  )}
                </div>

                {filteredEvents.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {filteredEvents.map((event) => (
                      <EventCard key={event._id} event={event} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-14 text-center">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="5" width="16" height="15" rx="2" stroke="#8ea79c" strokeWidth="1.5" />
                      <path d="M4 9h16M8 3v3M16 3v3M9 14l2 2 4-4" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No events found</p>
                    <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                      {selectedDate ? 'No events scheduled for this date.' : 'No events have been created for your batches yet.'}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {showBanner && isLoggedIn === false && <SignupLoginBanner visible={showBanner} onClose={() => setShowBanner(false)} />}

    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const UnauthenticatedContent: React.FC<{ router: ReturnType<typeof useRouter>; mounted: boolean }> = ({ router, mounted }) => (
  <div
    className={`mx-auto my-16 flex max-w-[460px] flex-col items-center rounded-[18px] border border-white/[0.08] bg-[#101d17] px-9 py-12 text-center transition-all duration-500 ${
      mounted ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
    }`}
  >
    <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="mb-5.5 h-[72px] w-[72px] object-contain" />
    <h2 className="mb-3 font-serif text-2xl font-semibold text-[#eef4f1]">Sign in required</h2>
    <p className="mb-2 text-[15px] leading-relaxed text-[#eef4f1]">Sign in to view your class calendar and upcoming events.</p>
    <p className="mb-7 text-[13.5px] leading-relaxed text-[#8ea79c]">Join SUJHAV to stay on top of your schedule.</p>

    <div className="flex w-full flex-col gap-3">
      <button
        className="w-full rounded-[10px] bg-emerald-400 px-8 py-3.5 text-[15px] font-bold text-[#06140f] transition-all hover:brightness-110"
        onClick={() => router.push('/SignInScreen')}
      >
        Sign in
      </button>
      <button
        className="w-full rounded-[10px] border border-emerald-400/30 px-8 py-3 text-[14.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/10"
        onClick={() => router.push('/SignUpScreen')}
      >
        Create account
      </button>
    </div>
  </div>
);

const StatisticsStrip: React.FC<{
  stats: { totalEvents: number; todaysEvents: number; upcomingEvents: number; batchCount: number };
  mounted: boolean;
}> = ({ stats, mounted }) => {
  const items: Array<{ kind: 'total' | 'today' | 'upcoming' | 'batches'; value: string; label: string; accent?: boolean }> = [
    { kind: 'total', value: String(stats.totalEvents), label: 'Total events' },
    { kind: 'today', value: String(stats.todaysEvents), label: 'Today', accent: true },
    { kind: 'upcoming', value: String(stats.upcomingEvents), label: 'Upcoming' },
    { kind: 'batches', value: String(stats.batchCount), label: 'Batches' },
  ];

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-x-0 gap-y-4 overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#101d17] px-5.5 py-4.5 transition-all duration-500 sm:flex-nowrap ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.kind}>
          <div className="flex min-w-[42%] flex-1 items-center gap-3 sm:min-w-[140px]">
            <StatIcon kind={item.kind} />
            <div className="flex flex-col">
              <span className={`font-mono text-2xl font-semibold leading-tight ${item.accent ? 'text-emerald-400' : 'text-[#eef4f1]'}`}>
                {item.value}
              </span>
              <span className="mt-0.5 text-[12.5px] text-[#8ea79c]">{item.label}</span>
            </div>
          </div>
          {i < items.length - 1 && <div className="mx-4.5 hidden self-stretch border-l border-white/[0.08] sm:block" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const StatIcon: React.FC<{ kind: 'total' | 'today' | 'upcoming' | 'batches' }> = ({ kind }) => {
  const color = kind === 'today' ? '#34d399' : '#8ea79c';
  return (
    <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]">
      {kind === 'total' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.8" />
          <path d="M4 9h16M8 3v3M16 3v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {kind === 'today' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.8" />
          <path d="M4 9h16M8 3v3M16 3v3M9 14l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'upcoming' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
          <path d="M12 7v5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'batches' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l9 5-9 5-9-5 9-5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 12l9 5 9-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};

const EventCard: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  const type = EVENT_TYPES[event.type];
  const eventDate = new Date(event.date);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5 transition-colors hover:border-white/[0.14]">
      <div className="flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: `${type.color}20` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={type.color}>
            {EVENT_ICON_PATH[event.type]}
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-[#eef4f1]">{event.title}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: type.color }}>
                {type.label}
              </p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 12v5c3 2 9 2 12 0v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {event.batchId.batchName}
            </span>
          </div>

          {event.description && <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-[#c7d6cf]">{event.description}</p>}

          <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[#8ea79c]">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke="#8ea79c" strokeWidth="1.6" />
                <path d="M4 9h16M8 3v3M16 3v3" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {eventDate.toLocaleDateString()} ({eventDate.toLocaleDateString('en-US', { weekday: 'short' })})
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#8ea79c" strokeWidth="1.6" />
                <path d="M12 7v5l3 3" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {event.startTime} - {event.endTime}
            </span>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
            <span className="text-[12px] text-[#8ea79c]">Created by {event.createdBy.name}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                event.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.06] text-[#8ea79c]'
              }`}
            >
              {event.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCalendarScreen;