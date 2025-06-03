
"use client";

import { useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { LevelTopicsPage } from '@/components/pages/level-topics-page';
import type { LanguageLevel } from '@/types/german-learning';
import { ALL_LEVELS } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface LevelTopicsRouteProps {
  params: {
    levelId: string;
  };
}

export default function LevelTopicsRoute({ params }: LevelTopicsRouteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { userData, isLoading, isLevelAccessible } = useUserData();
  
  const levelIdParam = params.levelId.toUpperCase();

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

    if (userData && !isLevelAccessible(validLevelId)) {
      toast({
        title: "Доступ запрещен",
        description: `Уровень ${validLevelId} пока недоступен. Сначала пройдите предыдущие уровни.`,
        variant: "destructive",
        duration: 5000,
      });
      router.push('/levels');
    }
  }, [isLoading, userData, levelIdParam, params.levelId, isLevelAccessible, router, toast]);

  if (isLoading || !userData) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Загрузка данных уровня...</p>
        </div>
      </MainLayout>
    );
  }

  // Further check to prevent rendering if redirection is imminent or level is invalid/inaccessible
  if (!ALL_LEVELS.includes(levelIdParam as LanguageLevel) || (userData && !isLevelAccessible(levelIdParam as LanguageLevel))) {
     return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Проверка доступа...</p>
        </div>
      </MainLayout>
    );
  }
  
  const finalLevelId = levelIdParam as LanguageLevel;

  return (
    <MainLayout>
      <LevelTopicsPage levelId={finalLevelId} />
    </MainLayout>
  );
}
