
"use client";

import { MainLayout } from '@/components/main-layout';
import { DashboardPage } from '@/components/pages/dashboard-page';

export default function HomePage() {
  return (
    <MainLayout>
      <DashboardPage />
    </MainLayout>
  );
}
