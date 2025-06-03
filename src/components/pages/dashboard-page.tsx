
"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useUserData } from '@/context/user-data-context';
import type { AIRecommendedLesson, LanguageLevel, ModuleType } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS } from '@/types/german-learning';
import { Sparkles, BookOpen, ArrowRight, AlertTriangle, CheckCircle, PartyPopper } from 'lucide-react';

interface ActionableAIReco {
  topicId: string;
  topicName: string;
  link: string;
  reasoning: string;
  modules: ModuleType[];
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


export function DashboardPage() {
  const { userData, isLoading, getAIRecommendedLesson, isLevelCompleted, isTopicCompleted } = useUserData();
  const [recommendedLesson, setRecommendedLesson] = useState<AIRecommendedLesson | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(true);
  
  const [actionableAIReco, setActionableAIReco] = useState<ActionableAIReco | null>(null);
  const [nextStepDetails, setNextStepDetails] = useState<NextStepDetails | null>(null);
  
  const currentLevelSlug = userData?.currentLevel.toLowerCase();

  // Calculate nextTopicId
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

  useEffect(() => {
    if (isLoading || !userData || !currentLevelSlug) {
      setActionableAIReco(null);
      setNextStepDetails(null);
      return;
    }

    // Process AI Recommendation
    if (recommendedLesson) {
      const currentLevelKey = userData.currentLevel;
      const levelTopics = DEFAULT_TOPICS[currentLevelKey] || [];
      const customLevelTopics = userData.customTopics.filter(ct => ct.id.startsWith(currentLevelKey + "_custom_"));
      let foundAIRecoTopicId: string | null = null;

      const defaultMatch = levelTopics.find(t => t.name === recommendedLesson.topic);
      if (defaultMatch) {
        foundAIRecoTopicId = defaultMatch.id;
      } else {
        const customMatch = customLevelTopics.find(t => t.name === recommendedLesson.topic);
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
        });
        setNextStepDetails(null); // AI reco takes precedence
        return; 
      }
    }

    // If no actionable AI recommendation, or recommendedLesson is null
    setActionableAIReco(null); // Ensure it's reset

    // Determine next step based on user progress
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
        cardIcon: PartyPopper, // Or CheckCircle
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
  }, [recommendedLesson, userData, isLoading, nextTopicId, currentLevelSlug, isLevelCompleted]);


  if (isLoading || (!actionableAIReco && !nextStepDetails && !isRecommendationLoading) ) { // Added !isRecommendationLoading to prevent premature loader
    return <div className="text-center p-10">Загрузка данных пользователя...</div>;
  }
  
  if (!userData && !isLoading) {
    return <div className="text-center p-10">Не удалось загрузить данные. Пожалуйста, обновите страницу.</div>;
  }
  
  // Calculate overall progress
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
          <CardDescription className="text-blue-100">Ваш ИИ-помощник в изучении немецкого языка.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-1">Текущий уровень: <span className="font-semibold">{userData?.currentLevel}</span></p>
          <div className="w-full bg-blue-200/30 rounded-full h-2.5 mb-4">
            <div className="bg-accent h-2.5 rounded-full" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-blue-100">Общий прогресс: {overallProgress}%</p>
        </CardContent>
      </Card>

      {isRecommendationLoading && !actionableAIReco && !nextStepDetails && (
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

      {!isRecommendationLoading && actionableAIReco && (
        <Card className={`mb-8 shadow-md border-l-4 border-accent`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent" />
              <CardTitle className="font-headline text-2xl">Рекомендованный урок от ИИ</CardTitle>
            </div>
            <CardDescription>{actionableAIReco.reasoning}</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-semibold mb-2">{actionableAIReco.topicName}</h3>
            <p className="text-muted-foreground mb-3">
              Рекомендуемые модули: {actionableAIReco.modules.map(m => MODULE_NAMES_RU[m] || m).join(', ')}
            </p>
            <Button asChild>
                <Link href={actionableAIReco.link}>
                    Начать рекомендованный урок <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      
      {!isRecommendationLoading && !actionableAIReco && nextStepDetails && (
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
             <Button asChild variant={nextStepDetails.topicName ? 'default' : 'outline'}>
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

