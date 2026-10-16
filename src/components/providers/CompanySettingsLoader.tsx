'use client';

import { useCompanySettings } from '@/hooks/useCompanySettings';

/**
 * Renders nothing — just triggers the company settings fetch on mount
 * so companyName and companyLogoUrl are available in UIStore immediately.
 * Must be rendered inside QueryProvider and SessionProvider.
 */
export function CompanySettingsLoader() {
  useCompanySettings();
  return null;
}
