
"use client";

import { useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { ModulePage } from '@/components/pages/module-page';
import type { LanguageLevel, ModuleType } from '@/types/german-learning';
import { ALL_LEVELS, ALL_MODULE_TYPES } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface SpecificModuleRouteProps {
  params: {
    levelId: string;
    topicId: string;
    moduleId: string;
  };
}

export default function SpecificModuleRoute({ params }: SpecificModuleRouteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { userData, isLoading, isLevelAccessible } = useUserData();

  const levelIdParam = params.levelId.toUpperCase();
  const moduleIdParam = params.moduleId as ModuleType; // Assume valid for now, could add validation
  const { topicId } = params;

  useEffect(() => {
    if (isLoading) return;

    if (!ALL_LEVELS.includes(levelIdParam as LanguageLevel)) {
      toast({
        title: "Неверный уровень",
        description: `Уровень "${params.levelId}" не существует.`,
        variant: "destructive",
        duration: 5000,
      });
      router.push('/levels');
      return;
    }
    
    const validLevelId = levelIdParam as LanguageLevel;

    if (!ALL_MODULE_TYPES.includes(moduleIdParam)) {
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
  }, [isLoading, userData, levelIdParam, params.levelId, moduleIdParam, params.moduleId, topicId, isLevelAccessible, router, toast]);

  if (isLoading || !userData) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Загрузка данных модуля...</p>
        </div>
      </MainLayout>
    );
  }
  
  if (!ALL_LEVELS.includes(levelIdParam as LanguageLevel) || 
      !ALL_MODULE_TYPES.includes(moduleIdParam as ModuleType) ||
      (userData && !isLevelAccessible(levelIdParam as LanguageLevel))) {
     return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Проверка доступа...</p>
        </div>
      </MainLayout>
    );
  }

  const finalLevelId = levelIdParam as LanguageLevel;
  const finalModuleId = moduleIdParam as ModuleType;

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
