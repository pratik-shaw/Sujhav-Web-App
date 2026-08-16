// Shared API configuration for the SUJHAV Next.js web app.
// Mirrors the Expo app's config/api.ts so both clients talk to the same backend.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

// Some screens in the Expo app import `API_BASE` rather than `API_BASE_URL` -
// keep both names available so ported screens don't need edits.
export const API_BASE = API_BASE_URL;

export const API_TIMEOUT = 15000;