
"use client";

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ALL_LEVELS, DEFAULT_TOPICS } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Lock } from 'lucide-react';

export function LevelsPage() {
  const { userData, isLoading, isLevelCompleted } = useUserData();

  if (isLoading) {
    return <div>Загрузка данных пользователя...</div>;
  }

  const calculateLevelProgress = (level: typeof ALL_LEVELS[0]) => {
    const levelData = userData?.progress?.[level];
    if (!levelData) return 0;

    const defaultTopicsInLevel = DEFAULT_TOPICS[level];
    // Consider custom topics for progress if they are added to the specific level structure
    // For now, only default topics
    if (!defaultTopicsInLevel || defaultTopicsInLevel.length === 0) return 0;

    const completedTopicsCount = defaultTopicsInLevel.filter(topic => 
      levelData.topics[topic.id]?.completed
    ).length;
    
    return (completedTopicsCount / defaultTopicsInLevel.length) * 100;
  };

  const currentLevelIndex = userData ? ALL_LEVELS.indexOf(userData.currentLevel) : 0;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">Уровни изучения немецкого</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_LEVELS.map((level, index) => {
          const progress = calculateLevelProgress(level);
          const isCurrent = userData?.currentLevel === level;
          const isLocked = index > currentLevelIndex && !isLevelCompleted(ALL_LEVELS[index -1]);
          const completed = isLevelCompleted(level);

          return (
            <Card key={level} className={`shadow-lg hover:shadow-xl transition-shadow duration-300 ${isLocked ? 'opacity-60 bg-muted' : ''}`}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-headline text-2xl">{level}</CardTitle>
                  {isLocked && <Lock className="h-6 w-6 text-muted-foreground" />}
                  {completed && <CheckCircle className="h-6 w-6 text-green-500" />}
                </div>
                <CardDescription>
                  {isCurrent ? "Текущий уровень" : (completed ? "Уровень пройден" : "Предстоящий уровень")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Основные темы: {DEFAULT_TOPICS[level].slice(0, 2).map(t => t.name).join(', ')}...
                </p>
                <div className="mb-4">
                  <Progress value={progress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}% пройдено</p>
                </div>
                <Button asChild className="w-full" disabled={isLocked}>
                  <Link href={`/levels/${level.toLowerCase()}`}>
                    {completed ? "Повторить уровень" : "Начать уровень"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
