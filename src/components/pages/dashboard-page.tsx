
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUserData } from '@/context/user-data-context';
import type { AIRecommendedLesson, LanguageLevel, ModuleType } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS } from '@/types/german-learning';
import { Sparkles, BookOpen, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';

export function DashboardPage() {
  const { userData, isLoading, getAIRecommendedLesson, isLevelCompleted, isTopicCompleted } = useUserData();
  const [recommendedLesson, setRecommendedLesson] = useState<AIRecommendedLesson | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(true);
  const [recommendedTopicActionLink, setRecommendedTopicActionLink] = useState<string>('');


  useEffect(() => {
    const fetchRecommendation = async () => {
      if (userData) {
        setIsRecommendationLoading(true);
        const lesson = await getAIRecommendedLesson();
        setRecommendedLesson(lesson);
        setIsRecommendationLoading(false);
      }
    };
    if (!isLoading) {
        fetchRecommendation();
    }
  }, [userData, isLoading, getAIRecommendedLesson]);

  if (isLoading) {
    return <div className="text-center p-10">Загрузка данных пользователя...</div>;
  }

  if (!userData) {
    return <div className="text-center p-10">Не удалось загрузить данные. Пожалуйста, обновите страницу.</div>;
  }

  // Calculate overall progress
  const calculateOverallProgress = () => {
    let totalTopics = 0;
    let completedTopics = 0;
    Object.values(userData.progress).forEach(levelData => {
      const topicsInLevel = Object.values(levelData.topics);
      totalTopics += topicsInLevel.length;
      completedTopics += topicsInLevel.filter(topic => topic.completed).length;
    });
    return totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
  };
  const overallProgress = calculateOverallProgress();

  const currentLevelSlug = userData.currentLevel.toLowerCase();
  
  // Find the first non-completed topic in the current level
  let nextTopicId: string | null = null;
  const currentLevelData = userData.progress[userData.currentLevel];
  if (currentLevelData) {
    // Combine default and custom topics for the current level to find the next one
    const defaultTopicsForLevel = DEFAULT_TOPICS[userData.currentLevel] || [];
    const customTopicsForLevel = userData.customTopics.filter(ct => ct.id.startsWith(userData.currentLevel + "_custom_"));
    // Assuming a certain order or just taking them as they are stored
    const allTopicsOrder = [
        ...defaultTopicsForLevel.map(t => t.id),
        ...customTopicsForLevel.map(t => t.id)
    ];

    for (const topicId of allTopicsOrder) {
      if (currentLevelData.topics[topicId] && !isTopicCompleted(userData.currentLevel, topicId)) {
        nextTopicId = topicId;
        break;
      }
    }
  }
  
  useEffect(() => {
    if (recommendedLesson && userData) {
        const currentLevelKey = userData.currentLevel;
        const levelTopics = DEFAULT_TOPICS[currentLevelKey] || [];
        const customLevelTopics = userData.customTopics.filter(ct => ct.id.startsWith(currentLevelKey + "_custom_"));

        let foundTopicId: string | null = null;

        // Check default topics
        const defaultMatch = levelTopics.find(t => t.name === recommendedLesson.topic);
        if (defaultMatch) {
            foundTopicId = defaultMatch.id;
        }

        // If not found in default, check custom topics
        if (!foundTopicId) {
            const customMatch = customLevelTopics.find(t => t.name === recommendedLesson.topic);
            if (customMatch) {
                foundTopicId = customMatch.id;
            }
        }

        if (foundTopicId) {
            setRecommendedTopicActionLink(`/levels/${currentLevelSlug}/${foundTopicId}`);
        } else if (nextTopicId) {
            setRecommendedTopicActionLink(`/levels/${currentLevelSlug}/${nextTopicId}`);
        } else {
            setRecommendedTopicActionLink(`/levels/${currentLevelSlug}`);
        }
    } else if (nextTopicId) {
         setRecommendedTopicActionLink(`/levels/${currentLevelSlug}/${nextTopicId}`);
    } else {
         setRecommendedTopicActionLink(`/levels/${currentLevelSlug}`);
    }
  }, [recommendedLesson, userData, nextTopicId, currentLevelSlug]);


  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8 shadow-lg bg-gradient-to-r from-primary to-blue-700 text-primary-foreground">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Добро пожаловать в Sprachheld!</CardTitle>
          <CardDescription className="text-blue-100">Ваш ИИ-помощник в изучении немецкого языка.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-1">Текущий уровень: <span className="font-semibold">{userData.currentLevel}</span></p>
          <div className="w-full bg-blue-200/30 rounded-full h-2.5 mb-4">
            <div className="bg-accent h-2.5 rounded-full" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-blue-100">Общий прогресс: {Math.round(overallProgress)}%</p>
        </CardContent>
      </Card>

      {isRecommendationLoading && (
        <Card className="mb-8 animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-muted rounded w-full mb-2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </CardContent>
          <CardFooter>
            <div className="h-10 bg-muted rounded w-1/3"></div>
          </CardFooter>
        </Card>
      )}

      {!isRecommendationLoading && recommendedLesson && (
        <Card className="mb-8 shadow-md border-l-4 border-accent">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent" />
              <CardTitle className="font-headline text-2xl">Рекомендованный урок от ИИ</CardTitle>
            </div>
            <CardDescription>{recommendedLesson.reasoning}</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-semibold mb-2">{recommendedLesson.topic}</h3>
            <p className="text-muted-foreground mb-3">
              Рекомендуемые модули: {recommendedLesson.modules.map(m => MODULE_NAMES_RU[m as ModuleType] || m).join(', ')}
            </p>
            <Button asChild disabled={!recommendedTopicActionLink}>
                <Link href={recommendedTopicActionLink || '#'}>
                    Начать рекомендованный урок <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      
      {!isRecommendationLoading && !recommendedLesson && nextTopicId && (
         <Card className="mb-8 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-2xl">Следующий урок</CardTitle>
            </div>
            <CardDescription>Продолжите обучение с того места, где остановились.</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-semibold mb-2">{userData.progress[userData.currentLevel]?.topics[nextTopicId]?.name || "Следующая тема"}</h3>
            <p className="text-muted-foreground mb-3">
              Продолжайте улучшать свои навыки немецкого языка.
            </p>
             <Button asChild disabled={!recommendedTopicActionLink}>
                <Link href={recommendedTopicActionLink || '#'}>
                    Продолжить обучение <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      
      {!isRecommendationLoading && !recommendedLesson && !nextTopicId && isLevelCompleted(userData.currentLevel) && (
        <Card className="mb-8 shadow-md border-l-4 border-green-500">
            <CardHeader>
                 <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <CardTitle className="font-headline text-2xl">Уровень {userData.currentLevel} пройден!</CardTitle>
                </div>
                <CardDescription>Поздравляем! Вы успешно завершили текущий уровень.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-3">
                    Готовы к новым вызовам? Переходите на следующий уровень или повторите пройденный материал.
                </p>
                 <Button asChild>
                    <Link href={`/levels`}>
                        Выбрать новый уровень <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
      )}
      
      {!isRecommendationLoading && !recommendedLesson && !nextTopicId && !isLevelCompleted(userData.currentLevel) && (
         <Card className="mb-8 shadow-md border-l-4 border-orange-500">
            <CardHeader>
                 <div className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                    <CardTitle className="font-headline text-2xl">Все темы уровня пройдены?</CardTitle>
                </div>
                <CardDescription>Кажется, вы прошли все стандартные темы этого уровня, или что-то пошло не так с рекомендацией.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-3">
                    Проверьте список тем или добавьте свою пользовательскую тему.
                </p>
                 <Button asChild variant="outline">
                    <Link href={`/levels/${currentLevelSlug}`}>
                        К темам уровня {userData.currentLevel}
                    </Link>
                </Button>
            </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Обзор уровней</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3">Просмотрите все доступные уровни и ваш прогресс по каждому из них.</p>
            <Button asChild variant="outline">
              <Link href="/levels">Перейти к уровням</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Мой словарь</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3">Повторяйте изученные слова и отслеживайте свой словарный запас.</p>
            <Button asChild variant="outline">
              <Link href="/vocabulary">Перейти к словарю</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    