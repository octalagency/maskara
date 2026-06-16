import { validateProductionEnv } from '../config/validate-env';

describe('validateProductionEnv', () => {
  const orig = process.env;

  beforeEach(() => {
    process.env = { ...orig };
  });

  afterAll(() => {
    process.env = orig;
  });

  it('skips validation in development', () => {
    process.env.NODE_ENV = 'development';
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('blocks weak JWT in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-jwt-secret-change-before-production-abc123xyz';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.REDIS_URL = 'redis://x';
    process.env.API_URL = 'https://api.test';
    process.env.PUBLIC_API_URL = 'https://api.test';
    process.env.FRONTEND_URL = 'https://app.test';
    process.env.VOICE_WEBHOOK_SECRET = 'voice-secret';
    process.env.WOOCOMMERCE_WEBHOOK_SECRET = 'woo-secret';
    expect(() => validateProductionEnv()).toThrow(/JWT_SECRET/);
  });
});
