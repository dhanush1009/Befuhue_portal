import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBaseUrl } from './baseUrl';

describe('getBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses APP_URL when configured with a production domain', () => {
    process.env.APP_URL = 'https://portal.befhue.com';
    expect(getBaseUrl()).toBe('https://portal.befhue.com');
  });

  it('ignores APP_URL if it points to localhost', () => {
    process.env.APP_URL = 'http://localhost:3000';
    process.env.NEXTAUTH_URL = 'https://portal.befhue.com';
    expect(getBaseUrl()).toBe('https://portal.befhue.com');
  });

  it('derives base URL dynamically from request x-forwarded-host and proto', () => {
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;

    const req = {
      headers: new Headers({
        'x-forwarded-host':  'company.example.com',
        'x-forwarded-proto': 'https',
      }),
    } as unknown as Request;

    expect(getBaseUrl(req)).toBe('https://company.example.com');
  });

  it('derives base URL from host header if x-forwarded-host is missing', () => {
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;

    const req = {
      headers: new Headers({
        host: 'company.example.com',
      }),
    } as unknown as Request;

    expect(getBaseUrl(req)).toBe('https://company.example.com');
  });

  it('falls back to http://localhost:3000 during local dev', () => {
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;

    const req = {
      headers: new Headers({
        host: 'localhost:3000',
      }),
    } as unknown as Request;

    expect(getBaseUrl(req)).toBe('http://localhost:3000');
  });
});
