
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ALL_MODULE_TYPES, MODULE_NAMES_RU, type LanguageLevel, type ModuleType, DEFAULT_TOPICS } from '@/types/german-learning';
import { useUserData } from '@/context/user-data-context';
import { CheckCircle, BookOpen, Mic, Pencil, Headphones, Brain } from 'lucide-react';

interface TopicModulesPageProps {
  levelId: LanguageLevel;
  topicId: string;
}

const moduleIcons: Record<ModuleType, React.ElementType> = {
  vocabulary: BookOpen,
  grammar: Pencil,
  listening: Headphones,
  reading: BookOpenText,
  writing: Brain, // Using Brain as placeholder, consider specific icon
  wordTest: Mic, // Using Mic as placeholder
};

export function TopicModulesPage({ levelId, topicId }: TopicModulesPageProps) {
  const router = useRouter();
  const { userData, isLoading } = useUserData();

  if (isLoading) {
    return <div>Загрузка данных темы...</div>;
  }

  if (!userData) {
    return <div>Не удалось загрузить данные пользователя.</div>;
  }

  const topicProgress = userData.progress[levelId]?.topics[topicId];
  const defaultTopicInfo = DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId);
  const customTopicInfo = userData.customTopics.find(t => t.id === topicId);
  const topicName = topicProgress?.name || defaultTopicInfo?.name || customTopicInfo?.name || "Неизвестная тема";

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Назад к темам
      </Button>
      <h1 className="text-3xl font-headline font-bold mb-2 text-center">Модули темы: {topicName}</h1>
      <p className="text-lg text-muted-foreground text-center mb-8">Уровень: {levelId}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_MODULE_TYPES.map((moduleType) => {
          const moduleData = topicProgress?.modules[moduleType];
          const score = moduleData?.score ?? 0;
          const isCompleted = moduleData?.completed ?? false;
          const Icon = moduleIcons[moduleType];

          return (
            <Card key={moduleType} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle className="font-headline text-xl">{MODULE_NAMES_RU[moduleType]}</CardTitle>
                  </div>
                  {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <CardDescription>
                  {isCompleted ? `Пройдено с результатом ${score}%` : (moduleData?.attempts && moduleData.attempts > 0 ? `Последняя попытка: ${score}%` : "Еще не начато")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-3">
                  <Progress value={score} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{score}%</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {moduleType === 'vocabulary' && "Изучение новых слов и фраз."}
                  {moduleType === 'grammar' && "Объяснение грамматических правил и упражнения."}
                  {moduleType === 'listening' && "Развитие навыков понимания на слух."}
                  {moduleType === 'reading' && "Чтение текстов и проверка понимания."}
                  {moduleType === 'writing' && "Практика письменной речи."}
                  {moduleType === 'wordTest' && "Тестирование выученных слов."}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/levels/${levelId.toLowerCase()}/${topicId}/${moduleType}`}>
                    {isCompleted ? "Повторить модуль" : "Начать модуль"}
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

// Placeholder for BookOpenText icon if not available in lucide-react directly, or use BookOpen
const BookOpenText = BookOpen;
