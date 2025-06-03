
"use client";

import { MainLayout } from '@/components/main-layout';
import { ModulePage } from '@/components/pages/module-page';
import type { LanguageLevel, ModuleType } from '@/types/german-learning';

interface SpecificModuleRouteProps {
  params: {
    levelId: string;
    topicId: string;
    moduleId: string;
  };
}

export default function SpecificModuleRoute({ params }: SpecificModuleRouteProps) {
  const { levelId, topicId, moduleId } = params;

  return (
    <MainLayout>
      <ModulePage 
        levelId={levelId.toUpperCase() as LanguageLevel} 
        topicId={topicId} 
        moduleId={moduleId as ModuleType} 
      />
    </MainLayout>
  );
}
