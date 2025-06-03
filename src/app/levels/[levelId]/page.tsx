
"use client";

import { MainLayout } from '@/components/main-layout';
import { LevelTopicsPage } from '@/components/pages/level-topics-page';
import type { LanguageLevel } from '@/types/german-learning';

interface LevelTopicsRouteProps {
  params: {
    levelId: string;
  };
}

export default function LevelTopicsRoute({ params }: LevelTopicsRouteProps) {
  const levelId = params.levelId.toUpperCase() as LanguageLevel; // Ensure levelId is of type LanguageLevel

  return (
    <MainLayout>
      <LevelTopicsPage levelId={levelId} />
    </MainLayout>
  );
}
