'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchPluginRelease, PLUGIN_ZIP_PATH } from '@/lib/plugin-release';

type Props = {
  className?: string;
  showVersion?: boolean;
  label?: string;
};

export function PluginDownloadLink({
  className = 'btn-secondary mt-3 inline-flex gap-2 text-sm',
  showVersion = true,
  label = 'maskara-woocommerce.zip',
}: Props) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchPluginRelease().then((info) => {
      if (info?.version) setVersion(info.version);
    });
  }, []);

  const text = showVersion
    ? `${label}${version ? ` (v${version})` : ''}`
    : label;

  return (
    <a href={PLUGIN_ZIP_PATH} className={className} download>
      <Download className="h-4 w-4" /> {text}
    </a>
  );
}
