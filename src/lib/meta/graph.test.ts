import { describe, it, expect, vi } from 'vitest';
import { createGraph, MetaApiError } from './graph';
import { toInsightRow, dedupeRows, toBreakdownRow, breakdownKey, prettyBreakdownKey, LEVEL_FIELDS, type RawInsight } from './transform';

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const fail = (status: number, error: Record<string, unknown>) => Promise.resolve(new Response(JSON.stringify({ error }), { status }));
const noSleep = () => Promise.resolve();

describe('Graph client', () => {
  it('sends the token as a header, not in the URL', async () => {
    const fetchImpl = vi.fn(() => ok({ data: [] })) as unknown as typeof fetch;
    await createGraph({ token: 'SECRET_TOKEN', fetchImpl }).get('/me/adaccounts', { limit: 5 });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('SECRET_TOKEN');
    expect(url).toContain('/v23.0/me/adaccounts?limit=5');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET_TOKEN');
  });

  it('adds an appsecret_proof when an app secret is configured', async () => {
    const fetchImpl = vi.fn(() => ok({})) as unknown as typeof fetch;
    await createGraph({ token: 't', appSecret: 's', fetchImpl }).get('/x');
    expect(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0]).toMatch(/appsecret_proof=[0-9a-f]{64}/);
  });

  it('refuses to start without a token', () => {
    const saved = process.env.META_ACCESS_TOKEN;
    delete process.env.META_ACCESS_TOKEN;
    expect(() => createGraph()).toThrow(/not connected/);
    if (saved) process.env.META_ACCESS_TOKEN = saved;
  });

  it('follows paging cursors until the last page', async () => {
    const pages = [
      { data: [1, 2], paging: { cursors: { after: 'A' }, next: 'https://x' } },
      { data: [3], paging: { cursors: { after: 'B' } } },
    ];
    let i = 0;
    const fetchImpl = vi.fn(() => ok(pages[i++])) as unknown as typeof fetch;
    expect(await createGraph({ token: 't', fetchImpl }).all<number>('/p')).toEqual([1, 2, 3]);
    expect(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1] as [string])[0]).toContain('after=A');
  });

  it('retries rate limits then succeeds', async () => {
    let n = 0;
    const fetchImpl = vi.fn(() => (n++ < 2 ? fail(400, { code: 17, message: 'limit' }) : ok({ data: ['fine'] }))) as unknown as typeof fetch;
    const r = await createGraph({ token: 't', fetchImpl, sleep: noSleep }).get<{ data: string[] }>('/x');
    expect(r.data).toEqual(['fine']);
    expect(n).toBe(3);
  });

  it('gives up after the retries and says why', async () => {
    const fetchImpl = vi.fn(() => fail(400, { code: 17, message: 'limit' })) as unknown as typeof fetch;
    await expect(createGraph({ token: 't', fetchImpl, sleep: noSleep }).get('/x')).rejects.toThrow(/rate-limiting/);
  });

  it('does not retry a bad token, and flags it as an auth problem', async () => {
    const fetchImpl = vi.fn(() => fail(401, { code: 190, message: 'expired' })) as unknown as typeof fetch;
    const err = await createGraph({ token: 't', fetchImpl, sleep: noSleep }).get('/x').catch((e) => e) as MetaApiError;
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.isAuthError).toBe(true);
    expect(err.message).toMatch(/invalid or has expired/);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('explains permission problems in plain words', async () => {
    const fetchImpl = vi.fn(() => fail(403, { code: 200, message: 'Permissions error' })) as unknown as typeof fetch;
    await expect(createGraph({ token: 't', fetchImpl, sleep: noSleep }).get('/x')).rejects.toThrow(/ads_read/);
  });
});

describe('insight rows', () => {
  const raw: RawInsight = {
    date_start: '2026-10-08', campaign_id: 'c1', campaign_name: 'Diwali Sale', objective: 'OUTCOME_SALES',
    adset_id: 'as1', adset_name: 'Chennai 25-45', ad_id: 'a1', ad_name: 'Reel 1',
    spend: '123.45', impressions: '10000', reach: '7000', clicks: '250', inline_link_clicks: '200',
    actions: [{ action_type: 'omni_purchase', value: '4' }, { action_type: 'link_click', value: '200' }],
    action_values: [{ action_type: 'omni_purchase', value: '9800.5' }],
  };

  it('maps a campaign row, parsing numbers and actions', () => {
    const r = toInsightRow('CAMPAIGN', '555', 'Acct', raw)!;
    expect(r).toMatchObject({ accountId: '555', date: '2026-10-08', level: 'CAMPAIGN', objectId: 'c1', objectName: 'Diwali Sale', campaignId: 'c1', objective: 'OUTCOME_SALES', adsetId: null });
    expect(r.spend).toBeCloseTo(123.45);
    expect(r.impressions).toBe(10000);
    expect(r.linkClicks).toBe(200);
    expect(r.actions).toEqual({ omni_purchase: 4, link_click: 200 });
    expect(r.actionValues).toEqual({ omni_purchase: 9800.5 });
  });

  it('maps ad-set, ad and account rows with the right ids', () => {
    expect(toInsightRow('ADSET', '555', 'Acct', raw)).toMatchObject({ objectId: 'as1', adsetId: 'as1', campaignId: 'c1' });
    expect(toInsightRow('AD', '555', 'Acct', raw)).toMatchObject({ objectId: 'a1', adsetId: 'as1', objectName: 'Reel 1' });
    expect(toInsightRow('ACCOUNT', '555', 'Acct', { date_start: '2026-10-08', spend: '1' })).toMatchObject({ objectId: '555', objectName: 'Acct', campaignId: null });
  });

  it('skips rows with no date or no object id, and tolerates missing numbers', () => {
    expect(toInsightRow('CAMPAIGN', '555', 'A', { ...raw, date_start: undefined })).toBeNull();
    expect(toInsightRow('CAMPAIGN', '555', 'A', { date_start: '2026-10-08' })).toBeNull();
    const sparse = toInsightRow('CAMPAIGN', '555', 'A', { date_start: '2026-10-08', campaign_id: 'c' })!;
    expect(sparse.spend).toBe(0);
    expect(sparse.impressions).toBe(0);
  });

  it('keeps one row per day/level/object when Meta repeats one', () => {
    const a = toInsightRow('CAMPAIGN', '555', 'A', raw)!;
    const b = { ...a, spend: 999 };
    expect(dedupeRows([a, b])).toHaveLength(1);
    expect(dedupeRows([a, b])[0].spend).toBe(999);
  });

  it('asks Meta for the right fields at each level', () => {
    expect(LEVEL_FIELDS.CAMPAIGN).toContain('objective');
    expect(LEVEL_FIELDS.AD).toContain('ad_name');
    expect(LEVEL_FIELDS.ACCOUNT).toContain('action_values');
  });
});

describe('breakdowns', () => {
  it('builds keys and readable labels', () => {
    expect(breakdownKey('age_gender', { age: '25-34', gender: 'female' })).toBe('25-34|female');
    expect(breakdownKey('placement', { publisher_platform: 'instagram', platform_position: 'feed' })).toBe('instagram|feed');
    expect(prettyBreakdownKey('age_gender', '25-34|female')).toBe('Female 25-34');
    expect(prettyBreakdownKey('placement', 'instagram|feed')).toBe('Instagram · Feed');
    expect(prettyBreakdownKey('device', 'mobile_app')).toBe('Mobile app');
    expect(prettyBreakdownKey('age_gender', 'unknown|unknown')).toBe('Unknown');
  });

  it('maps a breakdown row', () => {
    const r = toBreakdownRow('device', '555', { date_start: '2026-10-08', device_platform: 'mobile_app', spend: '10', impressions: '100', clicks: '3' })!;
    expect(r).toMatchObject({ breakdown: 'device', key: 'mobile_app', spend: 10, impressions: 100, clicks: 3 });
  });
});
