// Web equivalent of the Expo app's AsyncStorage-based session handling.
// Uses localStorage since this runs in the browser (Next.js client components).

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'user' | string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

const KEYS = {
  token: 'userToken',
  role: 'userRole',
  id: 'userId',
  name: 'userName',
  userData: 'userData',
} as const;

export const saveSession = (data: LoginResponse) => {
  localStorage.setItem(KEYS.token, data.token);
  localStorage.setItem(KEYS.role, data.user.role);
  localStorage.setItem(KEYS.id, data.user.id);
  localStorage.setItem(KEYS.name, data.user.name);
  localStorage.setItem(KEYS.userData, JSON.stringify(data.user));
};

export const clearSession = () => {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.role);
  localStorage.removeItem(KEYS.id);
  localStorage.removeItem(KEYS.name);
  localStorage.removeItem(KEYS.userData);
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.token);
};

export const getRole = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.role);
};

export const getStoredUserData = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEYS.userData);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Same role -> route mapping used on the Expo side (AdminDashboard / TeacherDashboard / Home),
// pointed at the matching Next.js screens.
export const routeForRole = (role: string | null | undefined) => {
  switch (role) {
    case 'admin':
      return '/AdminDashboardScreen';
    case 'teacher':
      return '/TeacherDashboardScreen';
    case 'user':
      return '/UserReportsScreen';
    default:
      return '/UserReportsScreen';
  }
};