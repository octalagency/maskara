const OFFLINE_KEY = 'maskara_offline_mode';
const MERCHANTS_KEY = 'maskara_demo_merchants';

const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_PRODUCTION === 'true' ||
  process.env.NODE_ENV === 'production';

export function isOfflineMode(): boolean {
  if (IS_PRODUCTION) return false;
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OFFLINE_KEY) === 'true';
}

export function enableOfflineMode() {
  if (IS_PRODUCTION) return;
  localStorage.setItem(OFFLINE_KEY, 'true');
  localStorage.setItem('token', 'offline-demo-token');
  localStorage.setItem('userRole', 'SUPER_ADMIN');
}

export function disableOfflineMode() {
  localStorage.removeItem(OFFLINE_KEY);
  localStorage.removeItem(MERCHANTS_KEY);
}

export function getDemoMerchants() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(MERCHANTS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveDemoMerchants(merchants: unknown[]) {
  localStorage.setItem(MERCHANTS_KEY, JSON.stringify(merchants));
}
