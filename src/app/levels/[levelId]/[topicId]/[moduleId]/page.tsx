
"use client";

import { useEffect, use } from 'react'; // Import use
import { MainLayout } from '@/components/main-layout';
import { ModulePage } from '@/components/pages/module-page';
import type { LanguageLevel, ModuleType } from '@/types/german-learning';
import { ALL_LEVELS, ALL_MODULE_TYPES } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface SpecificModuleRouteProps {
  params: Promise<{ // params prop is a Promise
    levelId: string;
    topicId: string;
    moduleId: string;
  }>;
}

export default function SpecificModuleRoute({ params: paramsPromise }: SpecificModuleRouteProps) {
  const params = use(paramsPromise); // Resolve the promise

  const router = useRouter();
  const { toast } = useToast();
  const { userData, isLoading, isLevelAccessible } = useUserData();

  // Now `params` is the resolved object
  const levelIdFromParams = params.levelId.toUpperCase();
  const moduleIdFromParams = params.moduleId as ModuleType;
  const { topicId } = params;

  useEffect(() => {
    if (isLoading) return;

    if (!ALL_LEVELS.includes(levelIdFromParams as LanguageLevel)) {
      toast({
        title: "Неверный уровень",
        description: `Уровень "${params.levelId}" не существует.`,
        variant: "destructive",
        duration: 5000,
      });
      router.push('/levels');
      return;
    }
    
    const validLevelId = levelIdFromParams as LanguageLevel;

    if (!ALL_MODULE_TYPES.includes(moduleIdFromParams)) {
        toast({
            title: "Неверный модуль",
            description: `Тип модуля "${params.moduleId}" не существует.`,
            variant: "destructive",
            duration: 5000,
        });
        router.push(`/levels/${validLevelId.toLowerCase()}/${topicId}`); // Redirect to topic page
        return;
    }

    if (userData && !isLevelAccessible(validLevelId)) {
      toast({
        title: "Доступ запрещен",
        description: `Уровень ${validLevelId} пока недоступен. Сначала пройдите предыдущие уровни.`,
        variant: "destructive",
        duration: 5000,
      });
      router.push('/levels');
    }
  }, [isLoading, userData, levelIdFromParams, moduleIdFromParams, topicId, params.levelId, params.moduleId, isLevelAccessible, router, toast]);

  if (isLoading || !userData) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Загрузка данных модуля...</p>
        </div>
      </MainLayout>
    );
  }
  
  if (!ALL_LEVELS.includes(levelIdFromParams as LanguageLevel) || 
      !ALL_MODULE_TYPES.includes(moduleIdFromParams as ModuleType) ||
      (userData && !isLevelAccessible(levelIdFromParams as LanguageLevel))) {
     return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Проверка доступа...</p>
        </div>
      </MainLayout>
    );
  }

  const finalLevelId = levelIdFromParams as LanguageLevel;
  const finalModuleId = moduleIdFromParams as ModuleType;

  return (
    <MainLayout>
      <ModulePage 
        levelId={finalLevelId} 
        topicId={topicId} 
        moduleId={finalModuleId} 
      />
    </MainLayout>
  );
}
