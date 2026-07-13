import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function findUpdateJson(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'downloads', 'maskara-woocommerce-update.json'),
    path.join(process.cwd(), '..', 'public', 'downloads', 'maskara-woocommerce-update.json'),
    path.join(
      process.cwd(),
      '..',
      '..',
      'frontend',
      'public',
      'downloads',
      'maskara-woocommerce-update.json',
    ),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

export async function GET() {
  const filePath = findUpdateJson();
  if (!filePath) {
    return NextResponse.json({ error: 'Update manifest not found' }, { status: 404 });
  }

  const body = fs.readFileSync(filePath, 'utf8');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
