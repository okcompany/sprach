
"use client";

import { MainLayout } from '@/components/main-layout';
import { TopicModulesPage } from '@/components/pages/topic-modules-page';
import type { LanguageLevel } from '@/types/german-learning';

interface TopicModulesRouteProps {
  params: {
    levelId: string;
    topicId: string;
  };
}

export default function TopicModulesRoute({ params }: TopicModulesRouteProps) {
  const { levelId, topicId } = params;

  return (
    <MainLayout>
      <TopicModulesPage levelId={levelId.toUpperCase() as LanguageLevel} topicId={topicId} />
    </MainLayout>
  );
}
