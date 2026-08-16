/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../config/api';
import { saveSession, routeForRole } from '../lib/auth';

const BRAND = {
  name: 'SUJHAV',
  subtitle:
    'Synchronize your Understanding, do Justice to your Hardwork and let others Admire your Victory!',
  primaryColor: '#00ff88',
  backgroundColor: '#0a1a0a',
};

// The brand name is literally spelled out by its own tagline — S.U.J.H.A.V.
// This ladder is real content, not decoration.
const ACRONYM = [
  { letter: 'S', phrase: 'Synchronize' },
  { letter: 'U', phrase: 'your Understanding' },
  { letter: 'J', phrase: 'do Justice' },
  { letter: 'H', phrase: 'to your Hardwork' },
  { letter: 'A', phrase: 'and let others Admire' },
  { letter: 'V', phrase: 'your Victory' },
];

const API_CONFIG = {
  baseURL: API_BASE_URL,
  endpoints: {
    register: '/auth/register',
    login: '/auth/login',
    currentUser: '/auth/current-user',
  },
};

const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Banner = { type: 'error' | 'success' | 'info'; title: string; message: string } | null;

const SignUpScreen: React.FC = () => {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [mounted, setMounted] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const updateConnection = () => setIsConnected(navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const isFormValid = () =>
    fullName &&
    email &&
    password &&
    confirmPassword &&
    password === confirmPassword &&
    agreeToTerms &&
    EMAIL_RE.test(email) &&
    password.length >= 6;

  const handleApiError = (error: any) => {
    console.error('Signup error:', error);
    if (!isConnected) {
      setBanner({ type: 'error', title: 'Network Error', message: 'You appear to be offline. Please check your internet connection and try again.' });
      return;
    }
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        setBanner({ type: 'error', title: 'Connection Timeout', message: `The server took too long to respond. Please check your API URL and try again. Make sure your server is running at ${API_CONFIG.baseURL}` });
      } else if (error.response) {
        const errorMessage = error.response.data?.message || `Server error (${error.response.status}). Please try again.`;
        if (error.response.status === 409 || errorMessage.includes('already exists')) {
          setBanner({ type: 'error', title: 'Account Exists', message: 'An account with this email already exists. Please use a different email or try signing in.' });
        } else {
          setBanner({ type: 'error', title: 'Registration Failed', message: errorMessage });
        }
      } else if (error.request) {
        setBanner({ type: 'error', title: 'Server Unreachable', message: `Could not reach the server at ${API_CONFIG.baseURL}. Please verify the API URL is correct and the server is running.` });
      } else {
        setBanner({ type: 'error', title: 'Request Error', message: 'An error occurred while setting up the request. Please try again.' });
      }
    } else {
      setBanner({ type: 'error', title: 'Unknown Error', message: 'An unexpected error occurred. Please try again later.' });
    }
  };

  const registerUserAPI = async (userData: { name: string; email: string; password: string }) => {
    const response = await apiClient.post(API_CONFIG.endpoints.register, userData);
    return response.data;
  };

  const loginUserAPI = async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post(API_CONFIG.endpoints.login, credentials);
    return response.data;
  };

  const handleSignUp = async () => {
    setBanner(null);
    if (!isFormValid()) {
      let errorMessage = 'Please fill all required fields';
      if (!EMAIL_RE.test(email)) errorMessage = 'Please enter a valid email address';
      else if (password.length < 6) errorMessage = 'Password must be at least 6 characters long';
      else if (password !== confirmPassword) errorMessage = 'Passwords do not match';
      else if (!agreeToTerms) errorMessage = 'You must accept the Terms of Service';
      setBanner({ type: 'error', title: 'Error', message: errorMessage });
      return;
    }
    if (!isConnected) {
      setBanner({ type: 'error', title: 'Network Error', message: 'You appear to be offline. Please check your internet connection and try again.' });
      return;
    }
    setIsLoading(true);
    try {
      await registerUserAPI({ name: fullName.trim(), email: email.toLowerCase().trim(), password });
      const loginResponse = await loginUserAPI({ email: email.toLowerCase().trim(), password });
      if (loginResponse && loginResponse.token) {
        try {
          saveSession(loginResponse);
          setBanner({ type: 'success', title: `Welcome to ${BRAND.name}!`, message: `Hello ${loginResponse.user.name}, your account has been created successfully. You're now signed in!` });
          setTimeout(() => router.replace(routeForRole(loginResponse.user.role)), 700);
        } catch (storageError) {
          console.error('Error saving auth data:', storageError);
          router.push(`/SignInScreen?prefillEmail=${encodeURIComponent(email)}`);
        }
      } else {
        setBanner({ type: 'success', title: 'Account Created Successfully', message: 'Your account has been created! Please sign in with your new credentials.' });
        setTimeout(() => router.push(`/SignInScreen?prefillEmail=${encodeURIComponent(email)}`), 1000);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsPress = (e: React.MouseEvent) => {
    e.preventDefault();
    setBanner({ type: 'info', title: 'Terms of Service', message: 'Terms of Service and Privacy Policy will be available soon.' });
  };

  return (
    <div className="screen">
      <div className="bg-elements" aria-hidden="true">
        <div className="grid-texture" />
        <div className="glow glow1" />
        <div className="glow glow2" />
        <div className="glow glow3" />
      </div>

      <div className="layout">
        {/* Brand panel — desktop only. Purely presentational, no functional elements. */}
        <aside className="brand-panel" aria-hidden="true">
          <div className={`brand-inner ${mounted ? 'in' : ''}`}>
            <div className="brand-mark">
              <div className="logo-glow" />
              <img src="/images/logo-sujhav.png" alt="" className="brand-logo" />
              <span className="wordmark">{BRAND.name}</span>
            </div>

            <ol className="ladder">
              {ACRONYM.map((row, i) => (
                <li className="ladder-row" style={{ transitionDelay: `${0.45 + i * 0.08}s` }} key={row.letter}>
                  <span className="ladder-letter">{row.letter}</span>
                  <span className="ladder-phrase">{row.phrase}</span>
                </li>
              ))}
            </ol>

            <p className="brand-footnote">Every letter of the name is a promise.</p>
          </div>
        </aside>

        <main className="form-panel">
          <div className="scroll-container">
            <button className="back-button" onClick={() => router.back()} aria-label="Go back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke={BRAND.primaryColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className={`logo-section ${mounted ? 'in' : ''}`}>
              <div className="logo-glow" />
              <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="logo-image" />
            </div>

            <div className={`header-section ${mounted ? 'in' : ''}`}>
              <span className="eyebrow">Get started</span>
              <h1 className="welcome-title">Create Account</h1>
              <p className="welcome-subtitle">Join {BRAND.name} and start your learning journey</p>
            </div>

            {banner && (
              <div className={`banner banner-${banner.type}`} role="alert">
                <strong>{banner.title}</strong>
                <span>{banner.message}</span>
              </div>
            )}

            <form
              className={`form-section ${mounted ? 'in' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                handleSignUp();
              }}
            >
              <div className="input-container">
                <label className="input-label" htmlFor="fullName">Full Name</label>
                <div className={`input-wrapper ${focusedInput === 'fullName' ? 'focused' : ''}`}>
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="#6b8578" strokeWidth="1.5" />
                    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    id="fullName"
                    type="text"
                    className="text-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoCapitalize="words"
                    autoCorrect="off"
                    autoComplete="name"
                    onFocus={() => setFocusedInput('fullName')}
                    onBlur={() => setFocusedInput(null)}
                    onKeyDown={(e) => e.key === 'Enter' && emailRef.current?.focus()}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="input-container">
                <label className="input-label" htmlFor="email">Email Address</label>
                <div className={`input-wrapper ${focusedInput === 'email' ? 'focused' : ''}`}>
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16v16H4V4z" stroke="#6b8578" strokeWidth="1.5" />
                    <path d="M4 6l8 7 8-7" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="email"
                    ref={emailRef}
                    type="email"
                    className="text-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="input-container">
                <label className="input-label" htmlFor="password">Password</label>
                <div className={`input-wrapper ${focusedInput === 'password' ? 'focused' : ''}`}>
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="10" width="14" height="10" rx="2" stroke="#6b8578" strokeWidth="1.5" />
                    <path d="M8 10V7a4 4 0 118 0v3" stroke="#6b8578" strokeWidth="1.5" />
                  </svg>
                  <input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    className="text-input password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (min. 6 characters)"
                    autoComplete="off"
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmPasswordRef.current?.focus()}
                    disabled={isLoading}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} disabled={isLoading} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="#6b8578" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="#6b8578" strokeWidth="1.5" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" /><path d="M9.9 5.1A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a13.2 13.2 0 01-3.2 4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="input-container">
                <label className="input-label" htmlFor="confirmPassword">Confirm Password</label>
                <div className={`input-wrapper ${focusedInput === 'confirmPassword' ? 'focused' : ''}`}>
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="10" width="14" height="10" rx="2" stroke="#6b8578" strokeWidth="1.5" />
                    <path d="M8 10V7a4 4 0 118 0v3" stroke="#6b8578" strokeWidth="1.5" />
                  </svg>
                  <input
                    id="confirmPassword"
                    ref={confirmPasswordRef}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="text-input password-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="off"
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                    disabled={isLoading}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((v) => !v)} disabled={isLoading} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="#6b8578" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="#6b8578" strokeWidth="1.5" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" /><path d="M9.9 5.1A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a13.2 13.2 0 01-3.2 4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" stroke="#6b8578" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="button" className="terms-container" onClick={() => setAgreeToTerms((v) => !v)} disabled={isLoading}>
                <span className={`checkbox ${agreeToTerms ? 'checked' : ''}`}>
                  {agreeToTerms && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke={BRAND.backgroundColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="terms-text">
                  I agree to the <a className="terms-link" onClick={handleTermsPress} href="#">Terms of Service</a> and{' '}
                  <a className="terms-link" onClick={handleTermsPress} href="#">Privacy Policy</a>
                </span>
              </button>

              <div className="signup-button-container">
                <button type="submit" className="signup-button" disabled={!isFormValid() || isLoading}>
                  {isLoading ? <span className="btn-spinner" /> : 'Create Account'}
                </button>
              </div>

              <div className="signin-link-container">
                <span className="signin-link-text">Already have an account? </span>
                <button type="button" className="signin-link-button" onClick={() => router.push('/SignInScreen')} disabled={isLoading}>
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <style jsx>{`
        .screen {
          --void: #030d08;
          --panel-1: #061a10;
          --panel-2: #0c2a1a;
          --card-bg: rgba(10, 24, 17, 0.55);
          --card-border: rgba(255, 255, 255, 0.08);
          --accent: ${BRAND.primaryColor};
          --accent-soft: #7dffc4;
          --accent-dim: rgba(0, 255, 136, 0.12);
          --text-hi: #f4faf6;
          --text-mid: #a9bcb1;
          --text-low: #64796f;
          --line: rgba(255, 255, 255, 0.09);
          min-height: 100vh;
          background: var(--void);
          position: relative;
          overflow-x: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .bg-elements { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .grid-texture {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 30% 20%, black, transparent 75%);
        }
        .glow { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(0,255,136,0.16), transparent 70%); filter: blur(2px); }
        .glow1 { width: min(420px, 65vw); height: min(420px, 65vw); top: -180px; right: -120px; }
        .glow2 { width: min(280px, 45vw); height: min(280px, 45vw); bottom: 80px; left: -90px; opacity: 0.8; }
        .glow3 { width: min(200px, 35vw); height: min(200px, 35vw); top: 55%; right: -60px; opacity: 0.5; }

        .layout { position: relative; z-index: 1; display: flex; min-height: 100vh; }

        /* ---------- Brand panel (desktop) ---------- */
        .brand-panel {
          display: none;
          flex: 0 0 42%;
          max-width: 560px;
          position: relative;
          background:
            radial-gradient(ellipse 120% 80% at 15% 0%, var(--panel-2), transparent 60%),
            linear-gradient(160deg, var(--panel-1), var(--void) 85%);
          border-right: 1px solid var(--line);
          padding: 56px 56px 48px;
          flex-direction: column;
          justify-content: center;
        }
        .brand-inner { max-width: 400px; }
        .brand-mark { display: flex; align-items: center; gap: 14px; margin-bottom: 64px; position: relative; opacity: 0; transform: translateY(10px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .brand-inner.in .brand-mark { opacity: 1; transform: translateY(0); transition-delay: 0.1s; }
        .brand-mark .logo-glow { position: absolute; left: -8px; width: 56px; height: 56px; border-radius: 50%; background: rgba(0,255,136,0.3); filter: blur(10px); }
        .brand-logo { width: 40px; height: 40px; object-fit: contain; position: relative; z-index: 1; }
        .wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: 2px; color: var(--text-hi); }

        .ladder { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; border-left: 1px solid var(--line); }
        .ladder-row {
          display: flex; align-items: baseline; gap: 18px; padding: 9px 0 9px 22px;
          opacity: 0; transform: translateX(-8px); transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .brand-inner.in .ladder-row { opacity: 1; transform: translateX(0); }
        .ladder-letter {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; color: var(--accent);
          width: 22px; flex-shrink: 0; text-shadow: 0 0 14px rgba(0,255,136,0.5);
        }
        .ladder-phrase { font-size: 15px; color: var(--text-mid); line-height: 1.4; }

        .brand-footnote { margin: 40px 0 0; font-size: 13px; color: var(--text-low); letter-spacing: 0.2px; font-style: italic; }

        /* ---------- Form panel ---------- */
        .form-panel { flex: 1; display: flex; justify-content: center; min-width: 0; }
        .scroll-container { position: relative; width: 100%; max-width: 440px; margin: 0 auto; padding: 0 clamp(20px, 6vw, 30px) 40px; display: flex; flex-direction: column; }

        .back-button { margin-top: 20px; margin-bottom: 10px; width: 45px; height: 45px; border-radius: 50%; background: rgba(0,0,0,0.4); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.2s ease, border-color 0.2s ease; }
        .back-button:hover { background: rgba(0,0,0,0.6); border-color: var(--accent-dim); }

        .logo-section { display: flex; align-items: center; justify-content: center; height: 80px; margin: 15px 0; position: relative; opacity: 0; transform: scale(0.5); transition: opacity 0.5s ease, transform 0.5s ease; transition-delay: 0.3s; }
        .logo-section.in { opacity: 1; transform: scale(1); }
        .logo-glow { position: absolute; width: 90px; height: 90px; border-radius: 50%; background: rgba(0,255,136,0.3); filter: blur(6px); }
        .logo-image { width: 60px; height: 60px; object-fit: contain; position: relative; z-index: 2; }

        .header-section { text-align: center; margin-bottom: 25px; opacity: 0; transition: opacity 0.5s ease; transition-delay: 0.35s; }
        .header-section.in { opacity: 1; }
        .eyebrow { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
        .welcome-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(26px, 6vw, 34px); font-weight: 700; color: var(--text-hi); margin: 0 0 12px; letter-spacing: 0.2px; }
        .welcome-subtitle { font-size: clamp(14px, 3.5vw, 16px); color: var(--text-mid); margin: 0; padding: 0 20px; }

        .banner { border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; line-height: 1.4; }
        .banner strong { font-size: 14.5px; }
        .banner-error { background: rgba(255, 76, 76, 0.1); border: 1px solid rgba(255, 76, 76, 0.35); color: #ff9a9a; }
        .banner-error strong { color: #ff6b6b; }
        .banner-success { background: var(--accent-dim); border: 1px solid rgba(0, 255, 136, 0.35); color: #cfffe8; }
        .banner-success strong { color: var(--accent); }
        .banner-info { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line); color: #ddd; }
        .banner-info strong { color: #fff; }

        .form-section { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; transition-delay: 0.45s; margin-bottom: 20px; }
        .form-section.in { opacity: 1; transform: translateY(0); }

        .input-container { margin-bottom: 16px; }
        .input-label { display: block; font-size: 13px; color: var(--text-mid); margin-bottom: 8px; font-weight: 600; letter-spacing: 0.3px; }
        .input-wrapper { background: var(--card-bg); backdrop-filter: blur(6px); border-radius: 12px; border: 1.5px solid var(--card-border); display: flex; align-items: center; padding: 0 16px; height: 54px; transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease; }
        .input-wrapper.focused { border-color: var(--accent); background: rgba(0,255,136,0.05); box-shadow: 0 0 0 3px var(--accent-dim); }
        .input-icon { margin-right: 12px; flex-shrink: 0; }
        .text-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-hi); font-size: 15.5px; font-weight: 500; height: 100%; min-width: 0; font-family: 'Inter', sans-serif; }
        .text-input::placeholder { color: var(--text-low); }
        .password-input { padding-right: 8px; }
        .password-toggle { background: none; border: none; cursor: pointer; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0; }

        .terms-container { display: flex; align-items: flex-start; margin-bottom: 20px; padding: 4px; background: none; border: none; cursor: pointer; text-align: left; width: 100%; }
        .checkbox { width: 20px; height: 20px; border-radius: 5px; border: 2px solid rgba(255,255,255,0.25); background: transparent; display: flex; align-items: center; justify-content: center; margin-right: 12px; margin-top: 2px; flex-shrink: 0; transition: background 0.15s ease, border-color 0.15s ease; }
        .checkbox.checked { background: var(--accent); border-color: var(--accent); }
        .terms-text { color: var(--text-mid); font-size: 13.5px; line-height: 20px; }
        .terms-link { color: var(--accent-soft); font-weight: 600; text-decoration: none; }
        .terms-link:hover { text-decoration: underline; }

        .signup-button-container { margin-bottom: 20px; }
        .signup-button { width: 100%; background: var(--accent); border: none; border-radius: 14px; height: 54px; font-size: 16.5px; font-weight: 700; letter-spacing: 0.3px; color: var(--void); cursor: pointer; box-shadow: 0 8px 24px rgba(0,255,136,0.28); transition: opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; }
        .signup-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,255,136,0.36); }
        .signup-button:active:not(:disabled) { transform: translateY(0); }
        .signup-button:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
        .btn-spinner { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid rgba(10,26,10,0.35); border-top-color: var(--void); animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .signin-link-container { display: flex; justify-content: center; align-items: center; padding-bottom: 20px; flex-wrap: wrap; }
        .signin-link-text { color: var(--text-mid); font-size: 15px; }
        .signin-link-button { background: none; border: none; color: var(--accent); font-size: 15px; font-weight: 700; cursor: pointer; padding: 0; }
        .signin-link-button:hover { text-decoration: underline; }

        @media (min-width: 1024px) {
          .brand-panel { display: flex; }
          .logo-section { display: none; }
          .form-panel { align-items: center; padding: 40px 0; }
          .scroll-container { padding-bottom: 0; padding-top: 64px; }
          .back-button { position: absolute; top: 0; left: -4px; }
          .header-section { text-align: left; padding: 0; }
          .welcome-subtitle { padding: 0; }
          .signin-link-container { justify-content: flex-start; }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .scroll-container { justify-content: center; padding-top: 40px; padding-bottom: 40px; }
        }
      `}</style>
    </div>
  );
};

export default SignUpScreen;