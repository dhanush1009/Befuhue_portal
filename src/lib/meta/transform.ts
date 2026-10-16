import type { MetaLevel } from '@prisma/client';
import { parseActions, type ActionMap } from './metrics';

// Turns raw Meta Insights rows into the rows we store. Pure, so it is covered by tests.

export const ACCOUNT_STATUS: Record<number, string> = {
  1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK_REVIEW', 8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD', 100: 'PENDING_CLOSURE', 101: 'CLOSED', 201: 'ANY_ACTIVE', 202: 'ANY_CLOSED',
};

export interface RawInsight {
  date_start?: string;
  account_id?: string; account_name?: string;
  campaign_id?: string; campaign_name?: string; objective?: string;
  adset_id?: string; adset_name?: string;
  ad_id?: string; ad_name?: string;
  spend?: string; impressions?: string; reach?: string; clicks?: string; inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  [k: string]: unknown;
}

export interface InsightRowInput {
  accountId: string; date: string; level: MetaLevel; objectId: string; objectName: string;
  campaignId: string | null; adsetId: string | null; objective: string | null;
  spend: number; impressions: number; reach: number; clicks: number; linkClicks: number;
  actions: ActionMap; actionValues: ActionMap;
}

/** The fields to ask Meta for at each level (ids/names differ, the metrics don't). */
export const BASE_FIELDS = 'spend,impressions,reach,clicks,inline_link_clicks,actions,action_values,date_start';
export const LEVEL_FIELDS: Record<MetaLevel, string> = {
  ACCOUNT:  `account_id,account_name,${BASE_FIELDS}`,
  CAMPAIGN: `campaign_id,campaign_name,objective,${BASE_FIELDS}`,
  ADSET:    `campaign_id,adset_id,adset_name,${BASE_FIELDS}`,
  AD:       `campaign_id,adset_id,ad_id,ad_name,${BASE_FIELDS}`,
};
export const LEVEL_PARAM: Record<MetaLevel, string> = { ACCOUNT: 'account', CAMPAIGN: 'campaign', ADSET: 'adset', AD: 'ad' };

const int = (v: unknown) => { const n = Number.parseInt(String(v ?? '0'), 10); return Number.isFinite(n) ? n : 0; };
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

export function toInsightRow(level: MetaLevel, accountId: string, accountName: string, raw: RawInsight): InsightRowInput | null {
  if (!raw.date_start) return null;
  let objectId: string | undefined;
  let objectName: string | undefined;
  switch (level) {
    case 'ACCOUNT':  objectId = accountId;     objectName = raw.account_name ?? accountName; break;
    case 'CAMPAIGN': objectId = raw.campaign_id; objectName = raw.campaign_name; break;
    case 'ADSET':    objectId = raw.adset_id;    objectName = raw.adset_name; break;
    case 'AD':       objectId = raw.ad_id;       objectName = raw.ad_name; break;
  }
  if (!objectId) return null;
  return {
    accountId,
    date:        raw.date_start,
    level,
    objectId,
    objectName:  objectName ?? objectId,
    campaignId:  level === 'ACCOUNT' ? null : raw.campaign_id ?? null,
    adsetId:     level === 'AD' || level === 'ADSET' ? raw.adset_id ?? null : null,
    objective:   level === 'CAMPAIGN' ? raw.objective ?? null : null,
    spend:       num(raw.spend),
    impressions: int(raw.impressions),
    reach:       int(raw.reach),
    clicks:      int(raw.clicks),
    linkClicks:  int(raw.inline_link_clicks),
    actions:     parseActions(raw.actions),
    actionValues: parseActions(raw.action_values),
  };
}

/** Meta can repeat a row across pages; keep one per account/day/level/object. */
export function dedupeRows(rows: InsightRowInput[]): InsightRowInput[] {
  const seen = new Map<string, InsightRowInput>();
  for (const r of rows) seen.set(`${r.date}|${r.level}|${r.objectId}`, r);
  return [...seen.values()];
}

// ── Breakdowns (age & gender, placement, device) ──────────────────────────────

export type BreakdownKind = 'age_gender' | 'placement' | 'device';
export const BREAKDOWN_FIELDS: Record<BreakdownKind, string[]> = {
  age_gender: ['age', 'gender'],
  placement:  ['publisher_platform', 'platform_position'],
  device:     ['device_platform'],
};

export function breakdownKey(kind: BreakdownKind, raw: RawInsight): string {
  return BREAKDOWN_FIELDS[kind].map((f) => String(raw[f] ?? 'unknown')).join('|');
}

export interface BreakdownRowInput {
  accountId: string; date: string; breakdown: BreakdownKind; key: string;
  spend: number; impressions: number; clicks: number; actions: ActionMap; actionValues: ActionMap;
}

export function toBreakdownRow(kind: BreakdownKind, accountId: string, raw: RawInsight): BreakdownRowInput | null {
  if (!raw.date_start) return null;
  return {
    accountId, date: raw.date_start, breakdown: kind, key: breakdownKey(kind, raw),
    spend: num(raw.spend), impressions: int(raw.impressions), clicks: int(raw.clicks),
    actions: parseActions(raw.actions), actionValues: parseActions(raw.action_values),
  };
}

export function dedupeBreakdownRows(rows: BreakdownRowInput[]): BreakdownRowInput[] {
  const seen = new Map<string, BreakdownRowInput>();
  for (const r of rows) seen.set(`${r.date}|${r.breakdown}|${r.key}`, r);
  return [...seen.values()];
}

/** "25-34|female" -> "Female 25-34", "facebook|feed" -> "Facebook · Feed", "mobile_app" -> "Mobile app" */
export function prettyBreakdownKey(kind: BreakdownKind, key: string): string {
  const cap = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const parts = key.split('|');
  if (kind === 'age_gender') return parts[1] && parts[1] !== 'unknown' ? `${cap(parts[1])} ${parts[0]}` : parts[0] === 'unknown' ? 'Unknown' : parts[0];
  if (kind === 'placement')  return parts.map(cap).join(' · ');
  return cap(parts[0]);
}
