
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useUserData } from '@/context/user-data-context';
import type { AIRecommendedLesson, LanguageLevel, ModuleType, TopicProgress } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS } from '@/types/german-learning';
import { Sparkles, BookOpen, ArrowRight, AlertTriangle, CheckCircle, PartyPopper, Brain, Mic, Pencil, Headphones, BookOpenText, RefreshCw } from 'lucide-react';

interface ActionableAIReco {
  topicId?: string; 
  topicName: string;
  link: string;
  reasoning: string;
  modules: ModuleType[];
  buttonText: string;
}

interface NextStepDetails {
  topicId?: string;
  topicName?: string;
  link: string;
  cardIcon: React.ElementType;
  cardTitle: string;
  cardDescription: string;
  buttonText: string;
  cardBorderClass?: string;
}

const moduleIcons: Record<ModuleType, React.ElementType> = {
  vocabulary: BookOpen,
  grammar: Pencil,
  listening: Headphones,
  reading: BookOpenText,
  writing: Brain,
  wordTest: Mic,
};


export function DashboardPage() {
  const { userData, isLoading, getAIRecommendedLesson, isLevelCompleted, isTopicCompleted, updateUserData } = useUserData();
  const [recommendedLesson, setRecommendedLesson] = useState<AIRecommendedLesson | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false); // Not loading by default
  const [aiRecommendationFetched, setAiRecommendationFetched] = useState(false);
  
  const [actionableAIReco, setActionableAIReco] = useState<ActionableAIReco | null>(null);
  const [nextStepDetails, setNextStepDetails] = useState<NextStepDetails | null>(null);
  
  const currentLevelSlug = userData?.currentLevel.toLowerCase();

  const nextTopicId = useMemo(() => {
    if (!userData || !currentLevelSlug) return null;

    const currentLevelData = userData.progress[userData.currentLevel];
    if (!currentLevelData) return null;

    const defaultTopicsForLevel = DEFAULT_TOPICS[userData.currentLevel] || [];
    const customTopicsForLevel = userData.customTopics
      .filter(topic => topic.id.startsWith(userData.currentLevel + "_custom_"))
      .map(ct => ({ id: ct.id, name: ct.name }));

    const allTopicsOrder = [
      ...defaultTopicsForLevel.map(t => t.id),
      ...customTopicsForLevel.map(t => t.id)
    ];

    for (const topicId of allTopicsOrder) {
      if (currentLevelData.topics[topicId] && !isTopicCompleted(userData.currentLevel, topicId)) {
        return topicId;
      }
    }
    return null;
  }, [userData, currentLevelSlug, isTopicCompleted]);


  const handleFetchRecommendation = useCallback(async () => {
    if (userData) {
      setIsRecommendationLoading(true);
      setAiRecommendationFetched(true); // Mark that a fetch has been attempted
      const lesson = await getAIRecommendedLesson();
      setRecommendedLesson(lesson);
      setIsRecommendationLoading(false);
    }
  }, [userData, getAIRecommendedLesson]);


  useEffect(() => {
    if (isLoading || !userData || !currentLevelSlug) {
      setActionableAIReco(null);
      setNextStepDetails(null);
      return;
    }

    setActionableAIReco(null);
    setNextStepDetails(null);

    if (recommendedLesson && aiRecommendationFetched) { // Only process if explicitly fetched
        const currentLvl = userData.currentLevel;
        const defaultTopics = DEFAULT_TOPICS[currentLvl] || [];
        const customTopics = userData.customTopics.filter((ct: TopicProgress) => ct.id.startsWith(currentLvl + "_custom_"));
        
        let foundAIRecoTopicId: string | undefined = undefined;
        const defaultMatch = defaultTopics.find(t => t.name.toLowerCase() === recommendedLesson.topic.toLowerCase());
        if (defaultMatch) {
            foundAIRecoTopicId = defaultMatch.id;
        } else {
            const customMatch = customTopics.find((t: TopicProgress) => t.name.toLowerCase() === recommendedLesson.topic.toLowerCase());
            if (customMatch) {
                foundAIRecoTopicId = customMatch.id;
            }
        }

        if (foundAIRecoTopicId) {
            setActionableAIReco({
                topicId: foundAIRecoTopicId,
                topicName: recommendedLesson.topic,
                link: `/levels/${currentLevelSlug}/${foundAIRecoTopicId}`,
                reasoning: recommendedLesson.reasoning,
                modules: recommendedLesson.modules as ModuleType[],
                buttonText: "Начать рекомендованный урок",
            });
            return; 
        } else {
            setActionableAIReco({
                topicName: recommendedLesson.topic,
                link: `/levels/${currentLevelSlug}`, 
                reasoning: recommendedLesson.reasoning,
                modules: recommendedLesson.modules as ModuleType[],
                buttonText: `К темам уровня (AI советует: "${recommendedLesson.topic}")`,
            });
            return; 
        }
    }
    
    if (nextTopicId) { 
      setNextStepDetails({
        topicId: nextTopicId,
        topicName: userData.progress[userData.currentLevel]?.topics[nextTopicId]?.name || "Следующая тема",
        link: `/levels/${currentLevelSlug}/${nextTopicId}`,
        cardIcon: BookOpen,
        cardTitle: "Следующий урок",
        cardDescription: "Продолжите обучение с того места, где остановились.",
        buttonText: "Продолжить обучение",
      });
    } else if (isLevelCompleted(userData.currentLevel)) { 
      setNextStepDetails({
        link: `/levels`,
        cardIcon: PartyPopper, 
        cardTitle: `Уровень ${userData.currentLevel} пройден!`,
        cardDescription: "Поздравляем! Вы успешно завершили текущий уровень.",
        buttonText: "Выбрать новый уровень",
        cardBorderClass: "border-green-500",
      });
    } else { 
      setNextStepDetails({
        link: `/levels/${currentLevelSlug}`,
        cardIcon: AlertTriangle,
        cardTitle: "Исследуйте уровень дальше",
        cardDescription: "Все стандартные темы этого уровня пройдены, или для этого уровня пока нет тем. Добавьте свою или выберите другую тему из списка.",
        buttonText: `К темам уровня ${userData.currentLevel}`,
        cardBorderClass: "border-orange-500",
      });
    }
  }, [recommendedLesson, aiRecommendationFetched, userData, isLoading, nextTopicId, currentLevelSlug, isLevelCompleted, isTopicCompleted]);


  if (isLoading) {
    return <div className="text-center p-10">Загрузка данных пользователя...</div>;
  }
  
  if (!userData) { 
    return <div className="text-center p-10">Не удалось загрузить данные. Пожалуйста, обновите страницу.</div>;
  }
  
  const calculateOverallProgress = () => {
    if (!userData) return 0;
    let totalTopics = 0;
    let completedTopics = 0;
    Object.values(userData.progress).forEach(levelData => {
      const topicsInLevel = Object.values(levelData.topics);
      totalTopics += topicsInLevel.length;
      completedTopics += topicsInLevel.filter(topic => topic.completed).length;
    });
    return totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  };
  const overallProgress = calculateOverallProgress();


  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8 shadow-lg bg-gradient-to-r from-primary to-blue-700 text-primary-foreground">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Добро пожаловать в Sprachheld!</CardTitle>
          <CardDescription className="text-primary-foreground/80">Ваш ИИ-помощник в изучении немецкого языка.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-1">Текущий уровень: <span className="font-semibold">{userData?.currentLevel}</span></p>
          <div className="w-full bg-primary-foreground/20 rounded-full h-2.5 mb-4">
            <div className="bg-accent h-2.5 rounded-full" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-primary-foreground/80">Общий прогресс: {overallProgress}%</p>
        </CardContent>
      </Card>

      <Card className="mb-8 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-accent" />
                <CardTitle className="font-headline text-2xl">Рекомендации от ИИ</CardTitle>
             </div>
             <Button onClick={handleFetchRecommendation} variant="outline" size="sm" disabled={isRecommendationLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRecommendationLoading ? 'animate-spin' : ''}`} />
                {isRecommendationLoading ? "Загрузка..." : (aiRecommendationFetched ? "Обновить" : "Получить")}
            </Button>
          </div>
          {!aiRecommendationFetched && !isRecommendationLoading && (
            <CardDescription className="mt-1">Нажмите кнопку, чтобы получить персональную рекомендацию урока.</CardDescription>
          )}
          {isRecommendationLoading && (
             <CardDescription className="mt-1">ИИ подбирает для вас лучший следующий урок...</CardDescription>
          )}
        </CardHeader>
        
        {aiRecommendationFetched && !isRecommendationLoading && actionableAIReco && (
            <CardContent>
                <CardDescription className="mb-3">{actionableAIReco.reasoning}</CardDescription>
                <h3 className="text-xl font-semibold mb-2">{actionableAIReco.topicName}</h3>
                <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-medium">Рекомендуемые модули:</span>
                {actionableAIReco.modules.map(m => {
                    const Icon = moduleIcons[m as ModuleType] || Sparkles; 
                    const moduleName = MODULE_NAMES_RU[m as ModuleType] || m;
                    return (
                    <span key={m} className="inline-flex items-center gap-1.5 text-sm">
                        <Icon className="h-4 w-4" />
                        {moduleName}
                    </span>
                    );
                })}
                </div>
                <Button 
                asChild
                onClick={() => {
                    if (actionableAIReco.topicId) { 
                    updateUserData({ currentTopicId: actionableAIReco.topicId });
                    }
                }}
                >
                    <Link href={actionableAIReco.link}>
                        {actionableAIReco.buttonText} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        )}
        {aiRecommendationFetched && !isRecommendationLoading && !actionableAIReco && (
            <CardContent>
                <p className="text-muted-foreground">Не удалось получить детальную рекомендацию от ИИ в данный момент. Попробуйте позже или выберите следующий урок самостоятельно.</p>
            </CardContent>
        )}
      </Card>
      
      {!actionableAIReco && nextStepDetails && ( // Show this only if no AI reco is displayed
         <Card className={`mb-8 shadow-md ${nextStepDetails.cardBorderClass ? `border-l-4 ${nextStepDetails.cardBorderClass}` : ''}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <nextStepDetails.cardIcon className={`h-6 w-6 ${nextStepDetails.cardBorderClass ? nextStepDetails.cardBorderClass.replace('border-','text-') : 'text-primary'}`} />
              <CardTitle className="font-headline text-2xl">{nextStepDetails.cardTitle}</CardTitle>
            </div>
            <CardDescription>{nextStepDetails.cardDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {nextStepDetails.topicName && <h3 className="text-xl font-semibold mb-2">{nextStepDetails.topicName}</h3>}
             <Button 
                asChild 
                variant={nextStepDetails.topicName ? 'default' : 'outline'}
                onClick={() => {
                  if (nextStepDetails.topicId) {
                    updateUserData({ currentTopicId: nextStepDetails.topicId });
                  }
                }}
              >
                <Link href={nextStepDetails.link}>
                    {nextStepDetails.buttonText} <ArrowRight className="ml-2 h-4 w-4" />
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

