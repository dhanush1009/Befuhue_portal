import { SessionProvider }         from '@/components/providers/SessionProvider';
import { QueryProvider }           from '@/components/providers/QueryProvider';
import { ThemeInitializer }        from '@/components/providers/ThemeInitializer';
import { CompanySettingsLoader }   from '@/components/providers/CompanySettingsLoader';
import { Sidebar }                 from '@/components/layout/Sidebar';
import { TopHeader }               from '@/components/layout/TopHeader';
import { MobileTabBar }            from '@/components/layout/MobileTabBar';
import { PageTransition }          from '@/components/shared/PageTransition';
import { ViewAsBanner, ViewAsInitializer, ViewAsPicker } from '@/components/layout/ViewAsBanner';
import { ExcelDownloadPopup }     from '@/components/shared/ExcelDownloadPopup';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <ThemeInitializer />
        <CompanySettingsLoader />
        <ViewAsInitializer />
        <ViewAsPicker />
        <ExcelDownloadPopup />
        <div className="flex h-screen overflow-hidden bg-[#0D0D10] dark:bg-canvas-dark">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:py-2 lg:pr-2 bg-[#0D0D10] dark:bg-canvas-dark">
            <ViewAsBanner />
            {/* The page lives in a rounded panel beside the sidebar (the "inset" layout) */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F8F9FA] dark:bg-surface-dark lg:rounded-2xl lg:border lg:border-black/15 lg:shadow-md dark:lg:border-white/10">
              <TopHeader />
              <main className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 pb-20 sm:px-6 lg:px-8 lg:py-7 lg:pb-8">
                <PageTransition>
                  {children}
                </PageTransition>
              </main>
            </div>
          </div>
        </div>
        <MobileTabBar />
      </QueryProvider>
    </SessionProvider>
  );
}
