
"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DEFAULT_TOPICS, type LanguageLevel, type TopicProgress, ALL_MODULE_TYPES, MODULE_NAMES_RU } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { useState } from 'react';
import { CheckCircle, PlusCircle } from 'lucide-react';

interface LevelTopicsPageProps {
  levelId: LanguageLevel;
}

export function LevelTopicsPage({ levelId }: LevelTopicsPageProps) {
  const router = useRouter();
  const { userData, isLoading, addCustomTopic, isTopicCompleted } = useUserData();
  const [customTopicName, setCustomTopicName] = useState('');

  if (isLoading) {
    return <div>Загрузка данных уровня...</div>;
  }

  if (!userData) {
    return <div>Не удалось загрузить данные пользователя.</div>;
  }
  
  const levelProgressData = userData.progress[levelId];
  const defaultTopicsForLevel = DEFAULT_TOPICS[levelId] || [];
  
  // Combine default topics with progress data
  const topicsWithProgress = defaultTopicsForLevel.map(defaultTopic => {
    const progress = levelProgressData?.topics[defaultTopic.id];
    return {
      ...defaultTopic,
      ...progress, // This will overwrite id and name if they exist in progress, but they should match
      modules: progress?.modules || {},
      completed: progress?.completed || isTopicCompleted(levelId, defaultTopic.id),
    };
  });

  const customTopicsForLevel = userData.customTopics
    .filter(topic => topic.id.startsWith(levelId + "_custom_")) // Assuming custom topic ID format
    .map(customTopic => {
        const progress = levelProgressData?.topics[customTopic.id];
        return {
            ...customTopic,
            modules: progress?.modules || {},
            completed: progress?.completed || isTopicCompleted(levelId, customTopic.id),
        }
    });
  
  const allTopics = [...topicsWithProgress, ...customTopicsForLevel];


  const handleAddCustomTopic = async () => {
    if (customTopicName.trim()) {
      await addCustomTopic(customTopicName.trim());
      setCustomTopicName('');
      // No need to manually refresh, context update should trigger re-render
    }
  };

  const calculateTopicProgress = (topic: TopicProgress | (typeof defaultTopicsForLevel[0] & Partial<TopicProgress>)) => {
    if (!topic.modules) return 0;
    const moduleScores = Object.values(topic.modules).map(m => m?.score ?? 0);
    if (moduleScores.length === 0) return 0;
    // A topic is complete if all modules are >= 70%
    // For progress bar, let's show average score of attempted modules or number of completed modules
    const completedModules = Object.values(topic.modules).filter(m => m?.score !== null && m.score >=70).length;
    return (completedModules / ALL_MODULE_TYPES.length) * 100;
  };

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Назад к уровням
      </Button>
      <h1 className="text-3xl font-headline font-bold mb-2 text-center">Темы уровня {levelId}</h1>
      <p className="text-muted-foreground text-center mb-8">Выберите тему для изучения или добавьте свою.</p>
      
      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Добавить свою тему</CardTitle>
          <CardDescription>ИИ создаст под неё полноценную обучающую структуру.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input 
              placeholder="Например, 'Немецкий для врачей'" 
              value={customTopicName}
              onChange={(e) => setCustomTopicName(e.target.value)}
            />
            <Button onClick={handleAddCustomTopic} disabled={!customTopicName.trim()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      {allTopics.length === 0 && <p className="text-center text-muted-foreground">Для этого уровня пока нет тем. Попробуйте добавить свою!</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allTopics.map((topic) => {
          const progressPercent = calculateTopicProgress(topic);
          const completed = topic.completed;
          return (
            <Card key={topic.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-headline text-xl">{topic.name}</CardTitle>
                  {completed && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                 {topic.custom && <CardDescription className="text-xs text-primary">Пользовательская тема</CardDescription>}
              </CardHeader>
              <CardContent className="flex-grow">
                 <div className="mb-3">
                  <Progress value={progressPercent} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(progressPercent)}% модулей пройдено</p>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  Модули: {ALL_MODULE_TYPES.map(m => MODULE_NAMES_RU[m]).join(', ')}.
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/levels/${levelId.toLowerCase()}/${topic.id}`}>
                    {completed ? "Повторить тему" : "Начать тему"}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
