'use client';

import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Web rewrite of the Expo EventCalendar component. Same data contract as the
// mobile app (CalendarEvent[] in, onDateSelect / onEventPress out), same
// dark editorial design language as the rest of the SUJHAV web dashboard
// (bg #0a120f / cards #101d17 / hairline borders / emerald-400 accent /
// font-serif headings / font-mono for numerals).
// ---------------------------------------------------------------------------

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'exam' | 'assignment' | 'meeting' | 'other';
  batchId: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onEventPress?: (event: CalendarEvent) => void;
}

const EVENT_TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  class: '#34d399',
  exam: '#f2685a',
  assignment: '#f0b429',
  meeting: '#38bdf8',
  other: '#a78bfa',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

export default function EventCalendar({ events, onDateSelect, onEventPress }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getEventsForDate = (date: Date) =>
    events.filter((event) => isSameDay(new Date(event.date), date));

  const navigateMonth = (direction: 'prev' | 'next') => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentDate(next);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    onDateSelect?.(today);
  };

  const handleDatePress = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayEvents = getEventsForDate(date);
    const isToday = isSameDay(date, today);
    const isSelected = !!selectedDate && isSameDay(date, selectedDate);
    const isPast = date < today && !isToday;

    cells.push(
      <button
        key={day}
        type="button"
        onClick={() => handleDatePress(day)}
        className={`group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[9px] text-[13px] font-medium transition-colors
          ${isSelected ? 'bg-emerald-400 text-[#06140f] font-bold' : 'text-[#eef4f1] hover:bg-white/[0.06]'}
          ${isToday && !isSelected ? 'border border-emerald-400/60 text-emerald-400' : ''}
          ${isPast && !isSelected ? 'text-[#5c6f66]' : ''}
        `}
      >
        <span>{day}</span>
        {dayEvents.length > 0 && (
          <span className="absolute bottom-1 flex items-center gap-[3px]">
            {dayEvents.slice(0, 3).map((event) => (
              <span
                key={event._id}
                className="h-[4px] w-[4px] rounded-full"
                style={{ background: isSelected ? '#06140f' : EVENT_TYPE_COLORS[event.type] }}
              />
            ))}
            {dayEvents.length > 3 && (
              <span className={`text-[8px] font-bold ${isSelected ? 'text-[#06140f]' : 'text-emerald-400'}`}>
                +{dayEvents.length - 3}
              </span>
            )}
          </span>
        )}
      </button>,
    );
  }

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
      {/* month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => navigateMonth('prev')}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-emerald-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button type="button" onClick={goToToday} className="flex flex-col items-center rounded-lg px-2 py-1 transition-colors hover:bg-white/[0.04]">
          <span className="font-serif text-lg font-semibold leading-tight text-[#eef4f1]">{MONTHS[currentDate.getMonth()]}</span>
          <span className="mt-0.5 text-xs font-medium text-emerald-400">{currentDate.getFullYear()}</span>
        </button>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => navigateMonth('next')}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-emerald-400 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* weekday row */}
      <div className="mb-1.5 grid grid-cols-7">
        {DAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#8ea79c]">
            {d}
          </div>
        ))}
      </div>

      {/* day grid */}
      <div className="grid grid-cols-7 gap-1">{cells}</div>

      {/* selected date preview */}
      {selectedDate && (
        <div className="mt-4 border-t border-white/[0.08] pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke="#34d399" strokeWidth="1.8" />
                <path d="M4 9h16M8 3v3M16 3v3" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[13px] font-semibold text-[#eef4f1]">
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                onDateSelect?.(null as unknown as Date);
              }}
              className="text-[11px] font-semibold text-[#8ea79c] hover:text-[#eef4f1]"
            >
              Clear
            </button>
          </div>

          {selectedDateEvents.length === 0 ? (
            <p className="text-[12.5px] text-[#8ea79c]">No events scheduled for this date.</p>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {selectedDateEvents.map((event) => (
                <button
                  key={event._id}
                  type="button"
                  onClick={() => onEventPress?.(event)}
                  className="min-w-[130px] max-w-[160px] flex-shrink-0 rounded-lg border-l-[3px] bg-white/[0.04] p-2.5 text-left transition-colors hover:bg-white/[0.07]"
                  style={{ borderLeftColor: EVENT_TYPE_COLORS[event.type] }}
                >
                  <p className="truncate text-[12px] font-semibold text-[#eef4f1]">{event.title}</p>
                  <p className="mt-1 text-[10.5px] text-[#8ea79c]">
                    {event.startTime} – {event.endTime}
                  </p>
                  <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: EVENT_TYPE_COLORS[event.type] }}>
                    {event.type}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}