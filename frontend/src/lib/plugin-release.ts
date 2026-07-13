export type PluginReleaseInfo = {
  name?: string;
  slug?: string;
  version: string;
  download_url?: string;
  homepage?: string;
  requires?: string;
  tested?: string;
  requires_php?: string;
  description?: string;
  changelog?: string;
};

export const PLUGIN_UPDATE_JSON = '/downloads/maskara-woocommerce-update.json';
export const PLUGIN_ZIP_PATH = '/downloads/maskara-woocommerce.zip';

export async function fetchPluginRelease(): Promise<PluginReleaseInfo | null> {
  try {
    const res = await fetch(`${PLUGIN_UPDATE_JSON}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PluginReleaseInfo;
    if (!data?.version) return null;
    return data;
  } catch {
    return null;
  }
}
