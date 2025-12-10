
"use client";

import { useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { TopicModulesPage } from '@/components/pages/topic-modules-page';
import type { LanguageLevel } from '@/types/german-learning';
import { ALL_LEVELS } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface TopicModulesRouteProps {
  params: {
    levelId: string;
    topicId: string;
  };
}

export default function TopicModulesRoute({ params }: TopicModulesRouteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { userData, isLoading, isLevelAccessible } = useUserData();
  
  const levelIdFromParams = params.levelId.toUpperCase();
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

    if (userData && !isLevelAccessible(validLevelId)) {
      toast({
        title: "Доступ запрещен",
        description: `Уровень ${validLevelId} пока недоступен. Сначала пройдите предыдущие уровни.`,
        variant: "destructive",
        duration: 5000,
      });
      router.push('/levels');
    }
  }, [isLoading, userData, levelIdFromParams, params.levelId, isLevelAccessible, router, toast]);

  if (isLoading || !userData) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Загрузка данных темы...</p>
        </div>
      </MainLayout>
    );
  }

  if (!ALL_LEVELS.includes(levelIdFromParams as LanguageLevel) || (userData && !isLevelAccessible(levelIdFromParams as LanguageLevel))) {
     return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <p>Проверка доступа...</p>
        </div>
      </MainLayout>
    );
  }

  const finalLevelId = levelIdFromParams as LanguageLevel;

  return (
    <MainLayout>
      <TopicModulesPage levelId={finalLevelId} topicId={topicId} />
    </MainLayout>
  );
}
