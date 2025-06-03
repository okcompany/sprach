
"use client";

import { useEffect, use } from 'react'; // Import use
import { MainLayout } from '@/components/main-layout';
import { LevelTopicsPage } from '@/components/pages/level-topics-page';
import type { LanguageLevel } from '@/types/german-learning';
import { ALL_LEVELS } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface LevelTopicsRouteProps {
  params: Promise<{ // params prop is a Promise
    levelId: string;
  }>;
}

export default function LevelTopicsRoute({ params: paramsPromise }: LevelTopicsRouteProps) {
  const params = use(paramsPromise); // Resolve the promise

  const router = useRouter();
  const { toast } = useToast();
  const { userData, isLoading, isLevelAccessible } = useUserData();
  
  // Now `params` is the resolved object: { levelId: string }
  // We can derive levelIdParam from the resolved params if needed, or use params.levelId directly.
  const levelIdFromParams = params.levelId.toUpperCase();

  useEffect(() => {
    if (isLoading) return; 

    // Use resolved `params.levelId` here
    if (!ALL_LEVELS.includes(levelIdFromParams as LanguageLevel)) {
      toast({
        title: "Неверный уровень",
        description: `Уровень "${params.levelId}" не существует.`, // Accessing params.levelId for the message
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
  }, [isLoading, userData, levelIdFromParams, params.levelId, isLevelAccessible, router, toast]); // Use levelIdFromParams or params.levelId

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
      <LevelTopicsPage levelId={finalLevelId} />
    </MainLayout>
  );
}
