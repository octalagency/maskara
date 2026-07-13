import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function findPluginZip(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'downloads', 'maskara-woocommerce.zip'),
    path.join(process.cwd(), '..', 'public', 'downloads', 'maskara-woocommerce.zip'),
    path.join(process.cwd(), '..', '..', 'frontend', 'public', 'downloads', 'maskara-woocommerce.zip'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

export async function GET() {
  const filePath = findPluginZip();
  if (!filePath) {
    return NextResponse.json({ error: 'Plugin file not found. Run scripts/build-woo-plugin.sh' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="maskara-woocommerce.zip"',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
