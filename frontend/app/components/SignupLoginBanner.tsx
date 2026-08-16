/* eslint-disable react-hooks/immutability */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BRAND = {
  name: 'SUJHAV',
  subtitle:
    'Synchronize your Understanding, do Justice to your Hardwork and let others Admire your Victory!',
};

interface SignupLoginBannerProps {
  onClose: () => void;
  visible?: boolean;
}

const HIGHLIGHT_LETTERS = ['S', 'U', 'J', 'H', 'A', 'V'];

const renderSubtitle = () =>
  BRAND.subtitle.split(' ').map((word, idx) => {
    const first = word.charAt(0);
    const rest = word.slice(1);
    const isHighlight = HIGHLIGHT_LETTERS.includes(first);
    return (
      <React.Fragment key={idx}>
        {isHighlight ? (
          <span className="font-black text-emerald-400 [text-shadow:0_0_12px_#34d399]">{first}</span>
        ) : (
          first
        )}
        {rest}
        {' '}
      </React.Fragment>
    );
  });

const SignupLoginBanner: React.FC<SignupLoginBannerProps> = ({ onClose, visible = true }) => {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setEntered(false);
      onClose();
    }, 280);
  };

  const handleSignup = () => {
    setClosing(true);
    setTimeout(() => router.push('/SignUpScreen'), 280);
  };

  const handleLogin = () => {
    setClosing(true);
    setTimeout(() => router.push('/SignInScreen'), 280);
  };

  if (!visible) return null;

  const shown = entered && !closing;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/85 transition-opacity duration-[280ms] ease-out ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div
        className={`relative max-h-[92vh] min-h-[60vh] w-full max-w-[520px] overflow-y-auto rounded-t-[25px] border border-b-0 border-emerald-400/30 bg-[#0a120f] px-5 pb-10 pt-7 shadow-[0_-5px_30px_rgba(52,211,153,0.15)] transition-all duration-300 ease-out sm:px-7.5 ${
          shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-full scale-[0.96] opacity-0'
        }`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[25px]">
          <div className="absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full bg-emerald-400/[0.15]" />
          <div className="absolute -left-12 bottom-12 h-[200px] w-[200px] rounded-full bg-emerald-400/[0.10]" />
        </div>

        <button
          className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white transition-colors hover:bg-white/[0.18]"
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="relative z-[1] flex flex-col items-center pt-5">
          <div className="relative mb-4 flex h-[120px] items-center justify-center">
            <div className="absolute h-[100px] w-[100px] rounded-full bg-emerald-400/30 blur-[8px]" />
            <img src="/images/logo-sujhav.png" alt="SUJHAV logo" className="relative z-[2] h-[70px] w-[70px] object-contain" />
          </div>

          <h2 className="mb-3.5 text-center font-serif text-[clamp(24px,6vw,30px)] font-extrabold tracking-wide text-white [text-shadow:0_0_8px_#34d399]">
            Welcome to {BRAND.name}
          </h2>

          <p className="mb-3.5 max-w-[440px] text-center text-[clamp(15px,3.5vw,18px)] font-medium italic leading-snug tracking-wide text-white">
            {renderSubtitle()}
          </p>

          <p className="mb-6.5 max-w-[400px] text-center text-[clamp(13px,3vw,15px)] font-semibold leading-snug text-emerald-400">
            Join thousands of learners on their journey to excellence
          </p>

          <div className="flex w-full max-w-[400px] flex-col gap-3.5">
            <button
              className="flex flex-col items-center rounded-2xl bg-emerald-400 px-6 py-4.5 shadow-[0_3px_12px_rgba(52,211,153,0.4)] transition-transform hover:-translate-y-px"
              onClick={handleSignup}
            >
              <span className="text-xl font-bold text-[#0a120f]">Create Account</span>
              <span className="text-sm font-medium text-[#0a120f]/80">Start learning today</span>
            </button>

            <button
              className="flex flex-col items-center rounded-2xl border-2 border-emerald-400/40 bg-black/60 px-6 py-4.5 transition-colors hover:bg-black/80"
              onClick={handleLogin}
            >
              <span className="text-xl font-semibold text-white">Sign In</span>
              <span className="text-sm font-normal text-neutral-300/80">Welcome back</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupLoginBanner;