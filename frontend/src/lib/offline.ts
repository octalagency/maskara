const OFFLINE_KEY = 'maskara_offline';
const MERCHANTS_KEY = 'maskara_demo_merchants';

function isProductionBuild() {
  return process.env.NEXT_PUBLIC_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
}

export function isOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (isProductionBuild()) return false;
  return localStorage.getItem(OFFLINE_KEY) === '1';
}

export function enableOfflineMode() {
  if (typeof window === 'undefined') return;
  if (isProductionBuild()) return;
  localStorage.setItem(OFFLINE_KEY, '1');
}

export function disableOfflineMode() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OFFLINE_KEY);
  localStorage.removeItem(MERCHANTS_KEY);
}

export function getDemoMerchants() {
  if (typeof window === 'undefined') return null;
  if (isProductionBuild()) return null;
  const raw = localStorage.getItem(MERCHANTS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDemoMerchants(merchants: unknown) {
  if (typeof window === 'undefined') return;
  if (isProductionBuild()) return;
  localStorage.setItem(MERCHANTS_KEY, JSON.stringify(merchants));
}
