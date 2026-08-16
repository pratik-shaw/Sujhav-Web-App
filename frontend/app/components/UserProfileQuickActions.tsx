/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACCENT = '#34d399';
const WARNING = '#f0b429';
const MUTED = '#8ea79c';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const Icon = {
  attendance: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14l2.5 2.5L16 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  curriculum: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 014 18.5V5.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 001.5-1.5V5.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  report: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const UserProfileQuickActions: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [curriculumNotice, setCurriculumNotice] = useState(false);

  useEffect(() => setMounted(true), []);

  const actions: QuickAction[] = [
    {
      id: 'attendance',
      title: 'Attendance',
      subtitle: 'View records',
      color: ACCENT,
      icon: Icon.attendance(ACCENT),
      onClick: () => router.push('/StudentAttendanceRecords'),
    },
    {
      id: 'calendar',
      title: 'Calendar',
      subtitle: 'Events & dates',
      color: WARNING,
      icon: Icon.calendar(WARNING),
      onClick: () => router.push('/StudentCalendar'),
    },
    {
      id: 'curriculum',
      title: 'Curriculum',
      subtitle: 'Course content',
      color: ACCENT,
      icon: Icon.curriculum(ACCENT),
      onClick: () => {
        setCurriculumNotice(true);
        setTimeout(() => setCurriculumNotice(false), 2500);
      },
    },
    {
      id: 'fullReport',
      title: 'Full Report',
      subtitle: 'All tests detailed report',
      color: WARNING,
      icon: Icon.report(WARNING),
      onClick: () => router.push('/StudentPersonalReportScreen'),
    },
  ];

  return (
    <div
      className={`transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0'}`}
    >
      <h2 className="mb-3.5 font-serif text-lg font-semibold tracking-wide text-[#eef4f1]">Quick actions</h2>

      {curriculumNotice && (
        <div className="mb-3 rounded-[10px] border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2.5 text-[13px] text-emerald-100">
          Loading curriculum content&hellip;
        </div>
      )}

      <div className="flex flex-col gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            className="flex w-full items-center rounded-xl border border-white/[0.08] bg-[#101d17] p-3.5 text-left transition-all hover:-translate-y-px hover:border-emerald-400/30"
            onClick={action.onClick}
          >
            <span
              className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08]"
              style={{ background: `${action.color}15` }}
            >
              {action.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="mb-0.5 text-[15px] font-semibold text-[#eef4f1]">{action.title}</span>
              <span className="truncate text-xs text-[#8ea79c]">{action.subtitle}</span>
            </span>
            {Icon.chevron}
          </button>
        ))}
      </div>
    </div>
  );
};

export default UserProfileQuickActions;