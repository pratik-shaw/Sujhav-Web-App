/* eslint-disable react-hooks/immutability */
'use client';

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import type { UserData } from '../StudentPersonalReportScreen/page';

// ---------------------------------------------------------------------------
// Web rewrite of MonthlyReportSubjectWiseActiveTab.tsx (Expo). Same endpoint:
// GET /student-evaluation/monthly-report[?year=]
// Same dark SUJHAV design language as the rest of the web dashboard.
// ---------------------------------------------------------------------------

interface MonthlyReportSubjectWiseActiveTabProps {
  userData: UserData;
}

interface SubjectTest {
  testId: string;
  testTitle: string;
  marksScored: number;
  fullMarks: number;
  percentage: number;
}

interface SubjectData {
  subjectName: string;
  tests: SubjectTest[];
  totalTests: number;
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: number;
  normalizedScore: number;
}

interface MonthlyReport {
  year: number;
  month: number;
  monthName: string;
  subjects: SubjectData[];
  totalTests: number;
  totalMarksScored: number;
  totalFullMarks: number;
  overallPercentage: number;
}

const getGradeColor = (percentage: number) => {
  if (percentage >= 90) return '#34d399';
  if (percentage >= 80) return '#10b981';
  if (percentage >= 70) return '#f0b429';
  if (percentage >= 60) return '#fb923c';
  if (percentage >= 50) return '#f2685a';
  return '#ef4444';
};

const MonthlyReportSubjectWiseActiveTab: React.FC<MonthlyReportSubjectWiseActiveTabProps> = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonthlyReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const fetchMonthlyReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = selectedYear
        ? `${API_BASE}/student-evaluation/monthly-report?year=${selectedYear}`
        : `${API_BASE}/student-evaluation/monthly-report`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${userData.token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned a non-JSON response');
      }

      const data = await response.json();

      if (data.success) {
        setMonthlyReports(data.data.monthlyReports);
        setAvailableYears(data.data.availableYears);

        if (!initialized && !selectedYear && data.data.availableYears.length > 0) {
          setInitialized(true);
          setSelectedYear(data.data.availableYears[0]);
          return; // effect will refire with the year set
        }
        setInitialized(true);
      } else {
        setError(data.message || 'Failed to load monthly report.');
      }
    } catch (err) {
      console.error('Error fetching monthly report:', err);
      setError('Failed to load monthly report. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && monthlyReports.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading monthly reports&hellip;</p>
      </div>
    );
  }

  if (!loading && monthlyReports.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No monthly reports available</p>
        <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[#8ea79c]">
          Complete tests to generate monthly performance reports.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-[13px] text-red-200">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#101d17] px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 9h16M8 3v3M16 3v3M4 7a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13.5px] font-medium text-[#eef4f1]">
            Showing {monthlyReports.length} month{monthlyReports.length !== 1 ? 's' : ''} of reports
          </span>
        </div>

        {availableYears.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowYearDropdown((v) => !v)}
              className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#101d17] px-4 py-3 text-left transition-colors hover:border-emerald-400/30"
            >
              <span className="text-[14px] font-medium text-[#eef4f1]">{selectedYear ?? 'All years'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition-transform ${showYearDropdown ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showYearDropdown && (
              <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#101d17] shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear(null);
                    setShowYearDropdown(false);
                  }}
                  className={`block w-full border-b border-white/[0.06] px-4 py-2.5 text-left text-[14px] ${
                    selectedYear === null ? 'bg-emerald-400 font-semibold text-[#06140f]' : 'text-[#eef4f1] hover:bg-white/[0.05]'
                  }`}
                >
                  All years
                </button>
                {availableYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setSelectedYear(year);
                      setShowYearDropdown(false);
                    }}
                    className={`block w-full border-b border-white/[0.06] px-4 py-2.5 text-left text-[14px] last:border-b-0 ${
                      selectedYear === year ? 'bg-emerald-400 font-semibold text-[#06140f]' : 'text-[#eef4f1] hover:bg-white/[0.05]'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {monthlyReports.map((monthData) => (
          <div key={`${monthData.year}-${monthData.month}`} className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
            <div className="mb-4 flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <p className="font-serif text-xl font-semibold text-[#eef4f1]">{monthData.monthName}</p>
                <p className="mt-0.5 text-[13px] text-[#8ea79c]">{monthData.year}</p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] text-[#8ea79c]">Overall</p>
                <p className="font-mono text-xl font-bold" style={{ color: getGradeColor(monthData.overallPercentage) }}>
                  {monthData.overallPercentage.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[#8ea79c]">
              <span className="flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {monthData.totalTests} tests
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {monthData.subjects.length} subjects
              </span>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.05]">
              {monthData.subjects.map((subject) => (
                <div key={subject.subjectName} className="flex items-center gap-3 py-3">
                  <span className="h-9 w-1 flex-shrink-0 rounded-full" style={{ background: getGradeColor(subject.percentage) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#eef4f1]">{subject.subjectName}</p>
                    <p className="text-[11.5px] text-[#8ea79c]">{subject.totalTests} tests</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[12px] text-[#8ea79c]">
                      {subject.totalMarksScored}/{subject.totalFullMarks}
                    </p>
                    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(subject.percentage, 100)}%`, background: getGradeColor(subject.percentage) }}
                      />
                    </div>
                    <p className="mt-1 text-[13px] font-bold" style={{ color: getGradeColor(subject.percentage) }}>
                      {subject.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3.5">
              <span className="text-[13px] text-[#8ea79c]">Total marks scored</span>
              <span className="font-mono text-[15px] font-bold text-emerald-400">
                {monthData.totalMarksScored}/{monthData.totalFullMarks}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyReportSubjectWiseActiveTab;