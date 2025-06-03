
"use client";

import { MainLayout } from '@/components/main-layout';
import { SettingsPage } from '@/components/pages/settings-page';

export default function SettingsRoute() {
  return (
    <MainLayout>
      <SettingsPage />
    </MainLayout>
  );
}
