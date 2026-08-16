/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_BASE } from '../config/api';
import type { UserData } from '../StudentPersonalReportScreen/page';

// ---------------------------------------------------------------------------
// Web rewrite of PerformanceActiveTab.tsx (Expo). Same endpoint:
// GET /student-evaluation/overall-performance
// Chart library swapped from react-native-chart-kit to recharts; same dark
// SUJHAV design language as the rest of the web dashboard.
// ---------------------------------------------------------------------------

interface PerformanceActiveTabProps {
  userData: UserData;
}

interface SubjectPerformance {
  subjectName: string;
  totalTests: number;
  evaluatedTests: number;
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  color: string;
}

interface OverallStatistics {
  totalSubjects: number;
  totalTests: number;
  evaluatedTests: number;
  pendingTests: number;
  averagePercentage: number;
  totalMarksScored: number;
  totalFullMarks: number;
  overallGrade: string;
}

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A+':
      return '#34d399';
    case 'A':
      return '#10b981';
    case 'B+':
      return '#f0b429';
    case 'B':
      return '#fb923c';
    case 'C':
      return '#f2685a';
    case 'D':
      return '#ef4444';
    default:
      return '#dc2626';
  }
};

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as SubjectPerformance;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-[#0a120f] px-3 py-2 text-[12px] shadow-lg">
      <p className="font-semibold text-[#eef4f1]">{d.subjectName}</p>
      <p className="mt-0.5 text-[#8ea79c]">
        {d.totalMarksScored}/{d.totalFullMarks} &middot; <span style={{ color: d.color }}>{d.percentage.toFixed(1)}%</span>
      </p>
    </div>
  );
};

const PerformanceActiveTab: React.FC<PerformanceActiveTabProps> = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
  const [overallStatistics, setOverallStatistics] = useState<OverallStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverallPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOverallPerformance = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/student-evaluation/overall-performance`, {
        headers: { Authorization: `Bearer ${userData.token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned a non-JSON response');
      }

      const data = await response.json();

      if (data.success) {
        setSubjectPerformance(data.data.subjectPerformance);
        setOverallStatistics(data.data.overallStatistics);
      } else {
        setError(data.message || 'Failed to load performance data.');
      }
    } catch (err) {
      console.error('Error fetching overall performance:', err);
      setError('Failed to load performance data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading performance data&hellip;</p>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-[13px] text-red-200">{error}</div>;
  }

  if (subjectPerformance.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-16 text-center">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M3 3v18h18 M7 15l4-5 3 3 5-7" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-3.5 text-base font-bold text-[#eef4f1]">No performance data</p>
        <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[#8ea79c]">
          Complete and get your tests evaluated to see performance analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* overall statistics */}
      {overallStatistics && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
          <h3 className="mb-4 font-serif text-lg font-semibold text-[#eef4f1]">Overall statistics</h3>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBlock label="Subjects" value={String(overallStatistics.totalSubjects)} />
            <StatBlock label="Total tests" value={String(overallStatistics.totalTests)} accent="#10b981" />
            <StatBlock label="Evaluated" value={String(overallStatistics.evaluatedTests)} accent="#f0b429" />
            <StatBlock label="Pending" value={String(overallStatistics.pendingTests)} accent="#fb923c" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-[11.5px] text-[#8ea79c]">Average performance</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-400">{overallStatistics.averagePercentage.toFixed(1)}%</p>
            </div>
            <div className="text-center sm:border-x sm:border-white/[0.08]">
              <p className="text-[11.5px] text-[#8ea79c]">Overall grade</p>
              <p className="mt-1 font-mono text-lg font-bold" style={{ color: getGradeColor(overallStatistics.overallGrade) }}>
                {overallStatistics.overallGrade}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11.5px] text-[#8ea79c]">Total marks</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#eef4f1]">
                {overallStatistics.totalMarksScored}/{overallStatistics.totalFullMarks}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* bar chart */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
        <h3 className="mb-4 font-serif text-lg font-semibold text-[#eef4f1]">Subject-wise performance</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="subjectName"
                tick={{ fill: '#8ea79c', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={0}
                tickFormatter={(v: string) => (v.length > 8 ? `${v.substring(0, 8)}…` : v)}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#8ea79c', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {subjectPerformance.map((s) => (
                  <Cell key={s.subjectName} fill={s.color || '#34d399'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* subject breakdown */}
      <div>
        <h3 className="mb-3.5 font-serif text-lg font-semibold text-[#eef4f1]">Subject breakdown</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {subjectPerformance.map((subject) => (
            <div key={subject.subjectName} className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-9 w-1 flex-shrink-0 rounded-full" style={{ background: subject.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#eef4f1]">{subject.subjectName}</p>
                    <p className="text-[12px] text-[#8ea79c]">
                      {subject.evaluatedTests}/{subject.totalTests} tests evaluated
                    </p>
                  </div>
                </div>
                <span
                  className="flex-shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold"
                  style={{ background: `${getGradeColor(subject.grade)}20`, color: getGradeColor(subject.grade) }}
                >
                  {subject.grade}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-[11.5px] text-[#8ea79c]">Percentage</p>
                  <p className="mt-0.5 font-mono text-base font-bold" style={{ color: subject.color }}>
                    {subject.percentage.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] text-[#8ea79c]">Marks scored</p>
                  <p className="mt-0.5 font-mono text-base font-bold text-[#eef4f1]">
                    {subject.totalMarksScored}/{subject.totalFullMarks}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(subject.percentage, 100)}%`, background: subject.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatBlock: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex flex-col items-center text-center">
    <span className="font-mono text-xl font-bold" style={{ color: accent || '#eef4f1' }}>
      {value}
    </span>
    <span className="mt-1 text-[11px] text-[#8ea79c]">{label}</span>
  </div>
);

export default PerformanceActiveTab;