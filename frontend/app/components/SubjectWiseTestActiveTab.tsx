/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../config/api';
import type { UserData } from '../StudentPersonalReportScreen/page';

// ---------------------------------------------------------------------------
// Web rewrite of SubjectWiseTestActiveTab.tsx (Expo). Same endpoints:
// GET /student-evaluation/available-subjects
// GET /student-evaluation/subject-tests/:subject
// Chart library swapped from react-native-chart-kit to recharts; same dark
// SUJHAV design language as the rest of the web dashboard.
// ---------------------------------------------------------------------------

interface SubjectWiseTestActiveTabProps {
  userData: UserData;
}

interface Test {
  testId: string;
  testTitle: string;
  className: string;
  fullMarks: number;
  marksScored: number | null;
  percentage: number | null;
  createdAt: string;
  evaluatedAt: string | null;
  status: string;
  testNumber: number;
}

interface ProgressData {
  testNumber: number;
  testTitle: string;
  percentage: number;
  date: string;
  marksScored: number;
  fullMarks: number;
}

interface Statistics {
  totalTests: number;
  evaluatedTests: number;
  pendingTests: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number | null;
  totalMarksScored: number;
  totalFullMarks: number;
  trend: string;
  grade: string;
}

interface SubjectData {
  subjectName: string;
  tests: Test[];
  progressData: ProgressData[];
  statistics: Statistics;
}

const getScoreColor = (percentage: number) => {
  if (percentage >= 90) return '#34d399';
  if (percentage >= 80) return '#10b981';
  if (percentage >= 70) return '#f0b429';
  if (percentage >= 60) return '#fb923c';
  if (percentage >= 50) return '#f2685a';
  return '#ef4444';
};

const TrendIcon: React.FC<{ trend: string }> = ({ trend }) => {
  if (trend === 'improving') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 6h6v6" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (trend === 'declining') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M23 18l-9.5-9.5-5 5L1 6" stroke="#f2685a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 18h6v-6" stroke="#f2685a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M2 12h20" stroke="#f0b429" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as ProgressData;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-[#0a120f] px-3 py-2 text-[12px] shadow-lg">
      <p className="font-semibold text-[#eef4f1]">{d.testTitle}</p>
      <p className="mt-0.5 text-[#8ea79c]">
        {d.marksScored}/{d.fullMarks} &middot; <span className="text-emerald-400">{d.percentage.toFixed(1)}%</span>
      </p>
    </div>
  );
};

const SubjectWiseTestActiveTab: React.FC<SubjectWiseTestActiveTabProps> = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [subjectData, setSubjectData] = useState<SubjectData | null>(null);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchSubjectTests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject]);

  const fetchAvailableSubjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/student-evaluation/available-subjects`, {
        headers: { Authorization: `Bearer ${userData.token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned a non-JSON response');
      }

      const data = await response.json();

      if (data.success && data.data.subjects.length > 0) {
        setSubjects(data.data.subjects);
        setSelectedSubject(data.data.subjects[0]);
      } else {
        setError('You are not enrolled in any subjects yet.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError('Failed to load subjects. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const fetchSubjectTests = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE}/student-evaluation/subject-tests/${encodeURIComponent(selectedSubject)}`,
        { headers: { Authorization: `Bearer ${userData.token}`, 'Content-Type': 'application/json' } },
      );

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned a non-JSON response');
      }

      const data = await response.json();

      if (data.success) {
        setSubjectData(data.data);
      } else {
        setError(data.message || 'Failed to load subject tests.');
      }
    } catch (err) {
      console.error('Error fetching subject tests:', err);
      setError('Failed to load tests. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !subjectData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading subject data&hellip;</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* subject selector */}
      <div className="relative">
        <label className="mb-2 block text-[13px] font-semibold text-[#eef4f1]">Select subject</label>
        <button
          type="button"
          onClick={() => setShowSubjectDropdown((v) => !v)}
          className="flex w-full max-w-xs items-center justify-between rounded-[10px] border border-white/[0.08] bg-[#101d17] px-4 py-3 text-left transition-colors hover:border-emerald-400/30 sm:w-64"
        >
          <span className="text-[15px] font-medium text-[#eef4f1]">{selectedSubject || 'Choose subject'}</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="#8ea79c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showSubjectDropdown && (
          <div className="absolute z-20 mt-1.5 w-full max-w-xs overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#101d17] shadow-xl sm:w-64">
            {subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => {
                  setSelectedSubject(subject);
                  setShowSubjectDropdown(false);
                }}
                className={`block w-full border-b border-white/[0.06] px-4 py-2.5 text-left text-[14px] last:border-b-0 ${
                  selectedSubject === subject ? 'bg-emerald-400 font-semibold text-[#06140f]' : 'text-[#eef4f1] hover:bg-white/[0.05]'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/35 bg-red-400/10 px-4 py-3 text-[13px] text-red-200">{error}</div>
      )}

      {subjectData && (
        <>
          {/* statistics */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-[#eef4f1]">Subject statistics</h3>
              <TrendIcon trend={subjectData.statistics.trend} />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBlock label="Total tests" value={String(subjectData.statistics.totalTests)} icon="assignment" />
              <StatBlock label="Evaluated" value={String(subjectData.statistics.evaluatedTests)} icon="check" accent="#34d399" />
              <StatBlock label="Pending" value={String(subjectData.statistics.pendingTests)} icon="pending" accent="#f0b429" />
              <StatBlock label="Average" value={`${subjectData.statistics.averagePercentage.toFixed(1)}%`} icon="trend" accent="#34d399" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-4">
              <div className="text-center">
                <p className="text-[11.5px] text-[#8ea79c]">Highest</p>
                <p className="mt-1 font-mono text-base font-semibold text-[#eef4f1]">{subjectData.statistics.highestScore.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[11.5px] text-[#8ea79c]">Lowest</p>
                <p className="mt-1 font-mono text-base font-semibold text-[#eef4f1]">
                  {subjectData.statistics.lowestScore !== null ? subjectData.statistics.lowestScore.toFixed(1) : 'N/A'}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11.5px] text-[#8ea79c]">Grade</p>
                <p className="mt-1 font-mono text-base font-semibold text-emerald-400">{subjectData.statistics.grade}</p>
              </div>
            </div>
          </div>

          {/* progress chart */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
            <h3 className="mb-4 font-serif text-lg font-semibold text-[#eef4f1]">Progress over time</h3>
            {subjectData.progressData.length === 0 ? (
              <EmptyBlock title="No progress data available" subtitle="Complete tests to see your progress chart" />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={subjectData.progressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="testNumber"
                      tickFormatter={(v) => `T${v}`}
                      tick={{ fill: '#8ea79c', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#8ea79c', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(52,211,153,0.25)', strokeWidth: 20 }} />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="#34d399"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#34d399', stroke: '#0a120f', strokeWidth: 2 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* tests list */}
          <div>
            <h3 className="mb-3.5 font-serif text-lg font-semibold text-[#eef4f1]">All tests ({subjectData.tests.length})</h3>
            {subjectData.tests.length === 0 ? (
              <EmptyBlock title="No tests available" subtitle="Tests will appear here once assigned" />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {subjectData.tests.map((test) => (
                  <div key={test.testId} className="rounded-2xl border border-white/[0.08] bg-[#101d17] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-semibold text-[#eef4f1]">{test.testTitle}</p>
                      <span
                        className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                        style={{
                          background: test.status === 'evaluated' ? 'rgba(52,211,153,0.12)' : 'rgba(240,180,41,0.12)',
                          color: test.status === 'evaluated' ? '#34d399' : '#f0b429',
                        }}
                      >
                        {test.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#8ea79c]">Class: {test.className}</p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[#8ea79c]">
                      <span>Created {new Date(test.createdAt).toLocaleDateString()}</span>
                      {test.evaluatedAt && <span className="text-emerald-400">Evaluated {new Date(test.evaluatedAt).toLocaleDateString()}</span>}
                    </div>

                    {test.marksScored !== null ? (
                      <div className="mt-4 flex items-end justify-between border-t border-white/[0.08] pt-3.5">
                        <div>
                          <p className="font-mono text-lg font-semibold text-[#eef4f1]">
                            {test.marksScored}/{test.fullMarks}
                          </p>
                          <p className="text-[11.5px] text-[#8ea79c]">Marks</p>
                        </div>
                        <p className="font-mono text-xl font-bold" style={{ color: getScoreColor(test.percentage || 0) }}>
                          {test.percentage?.toFixed(1)}%
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-white/[0.08] pt-3.5 text-center text-[13px] text-[#8ea79c]">Not evaluated yet</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const StatBlock: React.FC<{ label: string; value: string; icon: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex flex-col items-center text-center">
    <span className="font-mono text-xl font-bold" style={{ color: accent || '#eef4f1' }}>
      {value}
    </span>
    <span className="mt-1 text-[11px] text-[#8ea79c]">{label}</span>
  </div>
);

const EmptyBlock: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18 M7 15l4-5 3 3 5-7" stroke="#8ea79c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <p className="mt-3 text-[15px] font-semibold text-[#eef4f1]">{title}</p>
    <p className="mt-1 text-[13px] text-[#8ea79c]">{subtitle}</p>
  </div>
);

export default SubjectWiseTestActiveTab;