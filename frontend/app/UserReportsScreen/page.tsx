/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../config/api';
import { getToken, getRole, getStoredUserData, clearSession } from '../lib/auth';
import BottomNavigation from '../components/BottomNavigation';
import SignupLoginBanner from '../components/SignupLoginBanner';
import UserProfileQuickActions from '../components/UserProfileQuickActions';

// ---------------------------------------------------------------------------
// This is a Tailwind CSS rewrite of the reports dashboard. No styled-jsx.
//
// Fonts: headings use Tailwind's built-in `font-serif` stack and scores use
// `font-mono` so it works out of the box with zero config. For the exact
// editorial look (Fraunces / Inter / IBM Plex Mono) load them with
// next/font in your root layout and swap `font-serif` -> `font-display`
// and `font-mono` -> `font-plexmono` once you've added those to
// tailwind.config as custom font families. Everything else here is plain
// Tailwind utilities, so no config changes are required to use this file.
// ---------------------------------------------------------------------------

interface UserData {
  id: string;
  email: string;
  name: string;
  token: string;
  role?: string;
}

interface Batch {
  _id: string;
  batchName: string;
  category: string;
  classes: string[];
  subjects: Array<{ name?: string; teacher?: { _id?: string; name?: string; email?: string } }>;
  userAssignment?: { assignedClasses: string[]; assignedSubjects: Array<{ subjectName?: string }> };
}

interface TestReport {
  testId: string;
  testTitle: string;
  fullMarks: number;
  marksScored: number | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  dueDate: string | null;
  className: string;
  subjectName: string;
  batch: { _id: string; batchName?: string; category?: string };
  createdBy: { _id: string; name?: string; email?: string };
  instructions: string;
  percentage: string | null;
  status: 'pending' | 'submitted' | 'evaluated';
  hasQuestionPdf?: boolean;
  hasAnswerPdf?: boolean;
}

interface UserReportsData {
  batches: Batch[];
  tests: TestReport[];
  userAssignments: Array<{ batchId: string; batchName: string; category: string; subjectName: string; classes: string[] }>;
  statistics: {
    totalTests: number;
    evaluatedTests: number;
    pendingTests: number;
    averagePercentage: number;
    totalMarksScored: number;
    totalFullMarks: number;
  };
}

type Notice = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const safeGetTeacherName = (teacher: any): string => teacher?.name || 'Unknown Teacher';
const safeGetBatchName = (batch: any): string => batch?.batchName || 'Unknown Batch';
const safeGetCreatorName = (creator: any): string => creator?.name || 'Unknown Creator';

// Dynamic per-row colors — kept as real hex since Tailwind can't generate
// class names at runtime from a variable. Everything static uses classes.
const STATUS_HEX: Record<string, string> = {
  evaluated: '#34d399',
  submitted: '#f0b429',
  pending: '#f2685a',
};
const getStatusColor = (status: string) => STATUS_HEX[status] || '#8ea79c';

const getGrade = (percentage: number) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  return 'F';
};

const UserReportsScreen: React.FC = () => {
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isAssignedToBatch, setIsAssignedToBatch] = useState<boolean>(false);
  const [reportsData, setReportsData] = useState<UserReportsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'evaluated'>('all');
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const checkAuthStatus = (): UserData | null => {
    const token = getToken();
    const userRole = getRole();
    const stored = getStoredUserData();

    if (token && stored?.id && stored?.name) {
      const userDataObj: UserData = {
        id: stored.id,
        name: stored.name,
        email: stored.email || '',
        token,
        role: userRole || 'user',
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

  const handleDownloadError = (statusCode: number | null, type: 'question' | 'answer') => {
    const isQuestion = type === 'question';
    const pdfType = isQuestion ? 'Question PDF' : 'Answer PDF';

    if (statusCode === 403) {
      setNotice({
        type: 'error',
        title: 'Access Denied',
        message: isQuestion ? 'You are not authorized to download this PDF' : 'Solutions is only available after test evaluation',
      });
    } else if (statusCode === 404 || statusCode === 400) {
      setNotice({ type: 'error', title: 'No PDF Available', message: `No ${pdfType.toLowerCase()} is attached to this test` });
    } else if (statusCode === 500) {
      setNotice({ type: 'error', title: 'Server Error', message: 'Server error occurred. Please try again later.' });
    } else {
      setNotice({ type: 'error', title: 'No PDF Available', message: `No ${pdfType.toLowerCase()} is attached to this test` });
    }
  };

  const downloadPdf = async (testId: string, testTitle: string, kind: 'question' | 'answer') => {
    if (!userData) {
      setNotice({ type: 'error', title: 'Error', message: 'Please log in to download files' });
      return;
    }

    const downloadKey = kind === 'question' ? testId : `${testId}_answer`;
    setDownloadingPdf(downloadKey);

    try {
      const endpoint = kind === 'question' ? 'question-pdf' : 'answer-pdf';
      const sanitizedTitle = (testTitle || 'test').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedTitle}_${kind === 'question' ? 'Questions' : 'Answers'}.pdf`;

      const response = await fetch(`${API_BASE}/tests/student/test/${testId}/${endpoint}`, {
        headers: { Authorization: `Bearer ${userData.token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setNotice({
          type: 'success',
          title: 'Success',
          message: kind === 'question' ? 'PDF downloaded successfully' : 'Answer PDF downloaded successfully',
        });
      } else {
        handleDownloadError(response.status, kind);
      }
    } catch (error) {
      console.error('Download error:', error);
      handleDownloadError(null, kind);
    } finally {
      setDownloadingPdf(null);
    }
  };

  const fetchUserReports = async () => {
    try {
      setLoading(true);
      const currentUserData = checkAuthStatus();
      if (!currentUserData) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/tests/user/comprehensive-reports`, {
        headers: {
          Authorization: `Bearer ${currentUserData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          setIsAssignedToBatch(data.isAssigned);

          if (data.isAssigned) {
            const transformedData: UserReportsData = {
              batches: (data.data?.batches || []).map((batch: any) => ({
                ...batch,
                batchName: batch?.batchName || 'Unknown Batch',
                category: batch?.category || 'Unknown Category',
                classes: batch?.classes || [],
                subjects: (batch?.subjects || []).map((subject: any) => ({
                  name: subject?.name || 'Unknown Subject',
                  teacher: {
                    _id: subject?.teacher?._id || '',
                    name: subject?.teacher?.name || 'Unknown Teacher',
                    email: subject?.teacher?.email || '',
                  },
                })),
                userAssignment: batch?.userAssignment
                  ? {
                      assignedClasses: batch.userAssignment.assignedClasses || [],
                      assignedSubjects: (batch.userAssignment.assignedSubjects || []).map((s: any) => ({
                        subjectName: s?.subjectName || 'Unknown Subject',
                      })),
                    }
                  : undefined,
              })),
              tests: (data.data?.tests || []).map((test: any) => ({
                ...test,
                testTitle: test?.testTitle || 'Untitled Test',
                batch: {
                  _id: test?.batch?._id || '',
                  batchName: test?.batch?.batchName || 'Unknown Batch',
                  category: test?.batch?.category || 'Unknown Category',
                },
                createdBy: {
                  _id: test?.createdBy?._id || '',
                  name: test?.createdBy?.name || 'Unknown Teacher',
                  email: test?.createdBy?.email || '',
                },
                className: test?.className || 'Unknown Class',
                subjectName: test?.subjectName || 'Unknown Subject',
                percentage: test?.percentage || null,
              })),
              userAssignments: data.data?.userAssignments || [],
              statistics: {
                totalTests: data.data?.statistics?.totalTests || 0,
                evaluatedTests: data.data?.statistics?.evaluatedTests || 0,
                pendingTests: data.data?.statistics?.pendingTests || 0,
                averagePercentage: parseFloat(data.data?.statistics?.averagePercentage || '0'),
                totalMarksScored: data.data?.statistics?.totalMarksScored || 0,
                totalFullMarks: data.data?.statistics?.totalFullMarks || 0,
              },
            };
            setReportsData(transformedData);
          } else {
            setReportsData(null);
          }
        } else {
          console.error('Failed to fetch user reports:', data.message);
          setNotice({ type: 'error', title: 'Error', message: data.message || 'Failed to fetch reports' });
        }
      } else if (response.status === 401) {
        clearSession();
        setIsLoggedIn(false);
        setUserData(null);
        setShowBanner(true);
      } else {
        console.error('Failed to fetch user reports:', response.status);
        setNotice({ type: 'error', title: 'Error', message: 'Failed to fetch reports. Please try again.' });
      }
    } catch (error) {
      console.error('Error fetching user reports:', error);
      setNotice({ type: 'error', title: 'Error', message: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserReports();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUserReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getFilteredTests = () => {
    if (!reportsData) return [];
    switch (selectedFilter) {
      case 'pending':
        return reportsData.tests.filter((t) => t.status === 'pending');
      case 'evaluated':
        return reportsData.tests.filter((t) => t.status === 'evaluated');
      default:
        return reportsData.tests;
    }
  };

  if (loading && isLoggedIn === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a120f]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
        <p className="mt-3.5 text-sm text-[#8ea79c]">Loading&hellip;</p>
      </div>
    );
  }

  const filteredTests = getFilteredTests();

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
              <h1 className="mt-0.5 font-serif text-xl font-semibold text-[#eef4f1]">Reports</h1>
            </div>
          </div>
          {isLoggedIn && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh reports"
            >
              <svg
                className={refreshing ? 'animate-spin' : ''}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >
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
            <button
              className="absolute right-3 top-2.5 text-[13px] opacity-65 hover:opacity-100"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="relative z-[1] mx-auto max-w-[1180px] px-6 pt-7">
        {isLoggedIn === false ? (
          <UnauthenticatedContent router={router} mounted={mounted} />
        ) : !isAssignedToBatch ? (
          <EmptyState router={router} mounted={mounted} />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-400/20 border-t-emerald-400" />
            <p className="mt-3.5 text-sm text-[#8ea79c]">Loading reports&hellip;</p>
          </div>
        ) : (
          <div className="pt-1">
            {reportsData?.statistics && <StatisticsStrip statistics={reportsData.statistics} mounted={mounted} />}

            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[300px_1fr]">
              {/* sidebar */}
              <aside
                className={`flex flex-col gap-5 transition-all duration-500 delay-75 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <UserProfileQuickActions />

                {reportsData?.batches && reportsData.batches.length > 0 && (
                  <section>
                    <h2 className="mb-3.5 font-serif text-lg font-semibold text-[#eef4f1]">Your batches</h2>
                    <div className="flex flex-col gap-3">
                      {reportsData.batches.map((batch) => (
                        <div key={batch._id} className="rounded-[13px] border border-white/[0.08] bg-[#101d17] p-4">
                          <p className="mb-0.5 text-base font-bold text-[#eef4f1]">{batch.batchName}</p>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-400">{batch.category}</p>

                          {batch.userAssignment && (
                            <div className="mb-2.5 flex flex-col gap-0.5">
                              <span className="text-[11.5px] uppercase tracking-wide text-[#8ea79c]">Assigned classes</span>
                              <span className="text-[13.5px] font-medium text-[#eef4f1]">
                                {batch.userAssignment.assignedClasses.join(', ') || 'None'}
                              </span>
                            </div>
                          )}

                          {batch.subjects && batch.subjects.length > 0 && (
                            <div className="mt-1.5 border-t border-white/[0.08] pt-2.5">
                              <span className="mb-2 block text-[11.5px] uppercase tracking-wide text-[#8ea79c]">Subjects</span>
                              {batch.subjects.map((subject, index) => (
                                <div key={index} className="flex items-center justify-between gap-2.5 py-0.5">
                                  <span className="text-[13.5px] font-medium text-[#eef4f1]">{subject.name || 'Unknown Subject'}</span>
                                  <span className="text-right text-xs text-[#8ea79c]">{safeGetTeacherName(subject.teacher)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </aside>

              {/* main column */}
              <section
                className={`min-w-0 transition-all duration-500 delay-100 ${
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
              >
                <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter tests">
                  {(['all', 'pending', 'evaluated'] as const).map((filter) => (
                    <button
                      key={filter}
                      role="tab"
                      aria-selected={selectedFilter === filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                        selectedFilter === filter
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                          : 'border-white/[0.08] text-[#8ea79c] hover:border-emerald-400/30 hover:text-[#eef4f1]'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      {filter === 'all' && reportsData?.statistics && (
                        <span
                          className={`rounded font-mono text-[11.5px] px-1.5 py-px ${
                            selectedFilter === filter ? 'bg-emerald-400/20' : 'bg-white/[0.08]'
                          }`}
                        >
                          {reportsData.statistics.totalTests}
                        </span>
                      )}
                      {filter === 'pending' && reportsData?.statistics && (
                        <span
                          className={`rounded font-mono text-[11.5px] px-1.5 py-px ${
                            selectedFilter === filter ? 'bg-emerald-400/20' : 'bg-white/[0.08]'
                          }`}
                        >
                          {reportsData.statistics.pendingTests}
                        </span>
                      )}
                      {filter === 'evaluated' && reportsData?.statistics && (
                        <span
                          className={`rounded font-mono text-[11.5px] px-1.5 py-px ${
                            selectedFilter === filter ? 'bg-emerald-400/20' : 'bg-white/[0.08]'
                          }`}
                        >
                          {reportsData.statistics.evaluatedTests}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <section>
                  <h2 className="mb-3.5 font-serif text-lg font-semibold text-[#eef4f1]">
                    {selectedFilter === 'all' ? 'All tests' : selectedFilter === 'pending' ? 'Pending tests' : 'Evaluated tests'}
                  </h2>

                  {filteredTests.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101d17] max-[860px]:border-0 max-[860px]:bg-transparent max-[860px]:rounded-none">
                      <div
                        aria-hidden="true"
                        className="hidden grid-cols-[2.2fr_1.1fr_1.3fr_1.1fr_1.3fr] gap-4 border-b border-white/[0.08] bg-white/[0.02] px-4.5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#8ea79c] min-[860px]:grid"
                      >
                        <span>Test</span>
                        <span>Class &amp; subject</span>
                        <span>Dates</span>
                        <span>Score</span>
                        <span>Files</span>
                      </div>
                      <div className="flex flex-col max-[860px]:gap-3">
                        {filteredTests.map((item) => (
                          <TestRow
                            key={item.testId}
                            item={item}
                            downloadingPdf={downloadingPdf}
                            onDownloadQuestion={() => downloadPdf(item.testId, item.testTitle, 'question')}
                            onDownloadAnswer={() => downloadPdf(item.testId, item.testTitle, 'answer')}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#101d17] px-5 py-14 text-center">
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                        <rect x="4" y="3" width="16" height="18" rx="2" stroke="#8ea79c" strokeWidth="1.5" />
                        <path d="M8 8h8M8 12h8M8 16h5" stroke="#8ea79c" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <p className="mt-3.5 text-base font-bold text-[#eef4f1]">
                        {selectedFilter === 'pending' ? 'No pending tests' : selectedFilter === 'evaluated' ? 'No evaluated tests' : 'No tests available'}
                      </p>
                      <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[#8ea79c]">
                        {selectedFilter === 'pending'
                          ? 'All your tests have been completed or evaluated.'
                          : selectedFilter === 'evaluated'
                          ? 'No tests have been evaluated yet.'
                          : 'Your teacher will assign tests soon.'}
                      </p>
                    </div>
                  )}
                </section>
              </section>
            </div>
          </div>
        )}
      </main>

      {showBanner && isLoggedIn === false && (
        <SignupLoginBanner visible={showBanner} onClose={() => setShowBanner(false)} />
      )}

      <BottomNavigation activeTab="reports" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const HeroPanel: React.FC<{ mounted: boolean; children: React.ReactNode }> = ({ mounted, children }) => (
  <div
    className={`mx-auto my-16 flex max-w-[460px] flex-col items-center rounded-[18px] border border-white/[0.08] bg-[#101d17] px-9 py-12 text-center transition-all duration-500 ${
      mounted ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
    }`}
  >
    {children}
  </div>
);

const UnauthenticatedContent: React.FC<{ router: ReturnType<typeof useRouter>; mounted: boolean }> = ({ router, mounted }) => (
  <HeroPanel mounted={mounted}>
    <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="mb-5.5 h-[72px] w-[72px] object-contain" />
    <h2 className="mb-3 font-serif text-2xl font-semibold text-[#eef4f1]">Sign in required</h2>
    <p className="mb-2 text-[15px] leading-relaxed text-[#eef4f1]">Sign in to view your test reports and performance analytics.</p>
    <p className="mb-7 text-[13.5px] leading-relaxed text-[#8ea79c]">Join SUJHAV to track your academic progress.</p>

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
  </HeroPanel>
);

const EmptyState: React.FC<{ router: ReturnType<typeof useRouter>; mounted: boolean }> = ({ router, mounted }) => (
  <HeroPanel mounted={mounted}>
    <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="mb-5.5 h-[72px] w-[72px] object-contain" />
    <h2 className="mb-3 font-serif text-2xl font-semibold text-[#eef4f1]">Not a registered student</h2>
    <p className="mb-2 text-[15px] leading-relaxed text-[#eef4f1]">You are not registered as a student in any offline center batch.</p>
    <p className="mb-7 text-[13.5px] leading-relaxed text-[#8ea79c]">Join SUJHAV Online Center to continue your learning journey.</p>

    <div className="flex w-full flex-col gap-3">
      <button
        className="w-full rounded-[10px] bg-emerald-400 px-8 py-3.5 text-[15px] font-bold text-[#06140f] transition-all hover:brightness-110"
        onClick={() => router.push('/')}
      >
        Join offline center
      </button>
    </div>
  </HeroPanel>
);

const StatisticsStrip: React.FC<{ statistics: UserReportsData['statistics']; mounted: boolean }> = ({ statistics, mounted }) => {
  const items: Array<{ kind: 'total' | 'evaluated' | 'pending' | 'average'; value: string; label: string; accent?: boolean }> = [
    { kind: 'total', value: String(statistics.totalTests), label: 'Total tests' },
    { kind: 'evaluated', value: String(statistics.evaluatedTests), label: 'Evaluated' },
    { kind: 'pending', value: String(statistics.pendingTests), label: 'Pending' },
    { kind: 'average', value: `${statistics.averagePercentage.toFixed(1)}%`, label: 'Average score', accent: true },
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

const StatIcon: React.FC<{ kind: 'total' | 'evaluated' | 'pending' | 'average' }> = ({ kind }) => {
  const color = kind === 'evaluated' ? '#34d399' : kind === 'pending' ? '#f0b429' : '#34d399';
  return (
    <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]">
      {kind === 'total' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.8" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {kind === 'evaluated' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
          <path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'pending' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
          <path d="M12 7v5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'average' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 17l6-6 4 4 8-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7h6v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};

const TestRow: React.FC<{
  item: TestReport;
  downloadingPdf: string | null;
  onDownloadQuestion: () => void;
  onDownloadAnswer: () => void;
}> = ({ item, downloadingPdf, onDownloadQuestion, onDownloadAnswer }) => {
  const statusColor = getStatusColor(item.status);

  return (
    <div
      className="grid grid-cols-1 items-center gap-2.5 border-b border-white/[0.08] px-4.5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02]
      min-[860px]:grid-cols-[2.2fr_1.1fr_1.3fr_1.1fr_1.3fr] min-[860px]:gap-4
      max-[860px]:mb-3 max-[860px]:rounded-xl max-[860px]:border max-[860px]:border-white/[0.08] max-[860px]:bg-[#101d17] max-[860px]:px-4 max-[860px]:last:mb-0"
    >
      {/* Test */}
      <div className="flex min-w-0 flex-row items-start gap-2.5">
        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: statusColor }} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[15px] font-semibold leading-snug text-[#eef4f1]">{item.testTitle || 'Untitled Test'}</p>
          <p className="text-[12.5px] text-[#8ea79c]">
            {safeGetBatchName(item.batch)} &middot; {safeGetCreatorName(item.createdBy)}
          </p>
          <span
            className="mt-0.5 w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {item.status?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
      </div>

      {/* Class & subject */}
      <div className="flex flex-row items-center justify-between gap-2 min-[860px]:flex-col min-[860px]:items-start min-[860px]:gap-0.5 before:content-[attr(data-label)] before:text-[11px] before:font-semibold before:uppercase before:tracking-wide before:text-[#8ea79c] min-[860px]:before:hidden" data-label="Class & subject">
        <span className="text-sm font-semibold text-[#eef4f1]">
          {item.className || 'Unknown Class'} &nbsp;/&nbsp; {item.subjectName || 'Unknown Subject'}
        </span>
      </div>

      {/* Dates */}
      <div className="flex flex-col gap-0.5">
        <span className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8ea79c] min-[860px]:hidden">Dates</span>
        <span className="text-[12.5px] text-[#8ea79c]">
          Created {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
        </span>
        {item.dueDate && <span className="text-[12.5px] text-amber-400">Due {new Date(item.dueDate).toLocaleDateString()}</span>}
        {item.evaluatedAt && <span className="text-[12.5px] text-emerald-400">Evaluated {new Date(item.evaluatedAt).toLocaleDateString()}</span>}
      </div>

      {/* Score */}
      <div className="flex flex-row items-center justify-between gap-2 min-[860px]:flex-col min-[860px]:items-start min-[860px]:gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8ea79c] min-[860px]:hidden">Score</span>
        {item.marksScored !== null && item.marksScored !== undefined ? (
          <div className="flex flex-col items-end min-[860px]:items-start">
            <span className="font-mono text-sm font-semibold text-[#eef4f1]">
              {item.marksScored}/{item.fullMarks || 0}
            </span>
            <span className="text-[12.5px] text-[#8ea79c]">
              {item.percentage || '0'}% &middot; Grade {getGrade(parseFloat(item.percentage || '0'))}
            </span>
          </div>
        ) : (
          <span className="text-[12.5px] text-[#8ea79c]">Not evaluated</span>
        )}
      </div>

      {/* Files */}
      <div className="mt-1 flex flex-row flex-wrap gap-2 border-t border-white/[0.08] pt-2.5 min-[860px]:mt-0 min-[860px]:border-t-0 min-[860px]:pt-0">
        {item.hasQuestionPdf && (
          <button
            className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-[7px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] font-semibold text-[#eef4f1] transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-55 min-[860px]:flex-none"
            onClick={onDownloadQuestion}
            disabled={downloadingPdf === item.testId}
          >
            {downloadingPdf === item.testId ? (
              <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-white/25 border-t-current" />
            ) : (
              'Question paper'
            )}
          </button>
        )}
        {item.status === 'evaluated' && item.hasAnswerPdf && (
          <button
            className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-[7px] border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[12.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-55 min-[860px]:flex-none"
            onClick={onDownloadAnswer}
            disabled={downloadingPdf === `${item.testId}_answer`}
          >
            {downloadingPdf === `${item.testId}_answer` ? (
              <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-white/25 border-t-current" />
            ) : (
              'Solutions'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default UserReportsScreen;