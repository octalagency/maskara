/**
 * Validates required environment variables in production.
 * Throws on startup if critical secrets are missing or weak.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'API_URL',
    'PUBLIC_API_URL',
    'FRONTEND_URL',
    'VOICE_WEBHOOK_SECRET',
    'WOOCOMMERCE_WEBHOOK_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked — missing env: ${missing.join(', ')}`,
    );
  }

  const weakJwt = [
    'your-super-secret-jwt-key-change-in-production',
    'dev-jwt-secret-change-before-production-abc123xyz',
    'maskara-standalone-dev-secret',
  ];
  if (weakJwt.includes(process.env.JWT_SECRET!)) {
    throw new Error('Production startup blocked — JWT_SECRET is a default/dev value');
  }

  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('Production startup blocked — JWT_SECRET must be at least 32 characters');
  }

  const publicUrl = process.env.PUBLIC_API_URL!;
  if (!publicUrl.startsWith('https://')) {
    throw new Error(
      'Production startup blocked — PUBLIC_API_URL must be HTTPS (ePBX voice callbacks)',
    );
  }

  if (process.env.RUN_SEED === 'true') {
    console.warn('WARNING: RUN_SEED=true in production — demo data may be recreated');
  }

  console.log('✓ Production environment validated');
}
