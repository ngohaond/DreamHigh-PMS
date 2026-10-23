import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-surface font-body text-on-surface">
      <Sidebar />
      <Header />
      <main className="min-h-screen pb-20 pt-16 md:ml-64 md:pb-0">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:p-12">
          {children}
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
};
