
"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { useUserData } from '@/context/user-data-context';
import type { LanguageLevel, ModuleType, AILessonContent, AIEvaluationResult, VocabularyWord, MODULE_NAMES_RU as ModuleNamesRuType } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS } from '@/types/german-learning';
import { Speaker } from 'lucide-react';

interface ModulePageProps {
  levelId: LanguageLevel;
  topicId: string;
  moduleId: ModuleType;
}

// Dummy TTS function - replace with actual implementation
const speak = (text: string, lang: 'ru-RU' | 'de-DE') => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    // Split text for longer passages and handle mixed languages if needed
    // This is a simplified version
    speechSynthesis.speak(utterance);
  } else {
    console.warn("TTS not available.");
  }
};


export function ModulePage({ levelId, topicId, moduleId }: ModulePageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { userData, getTopicLessonContent, evaluateUserResponse, updateModuleProgress, addWordToBank, updateWordInBank, getWordsForTopic } = useUserData();
  
  const [lessonContent, setLessonContent] = useState<AILessonContent | null>(null);
  const [currentTask, setCurrentTask] = useState<string | null>(null); // E.g., a specific vocabulary word, grammar question
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState<AIEvaluationResult | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [moduleScore, setModuleScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(5); // Example: 5 tasks per module
  const [currentVocabulary, setCurrentVocabulary] = useState<VocabularyWord[]>([]);


  const topicName = userData?.progress[levelId]?.topics[topicId]?.name || 
                    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
                    userData?.customTopics.find(t => t.id === topicId)?.name || 
                    "Загрузка...";

  useEffect(() => {
    const fetchLesson = async () => {
      setIsLoadingTask(true);
      const content = await getTopicLessonContent(levelId, topicName); // Use actual topic name for AI
      setLessonContent(content);
      if (content) {
        if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
            const topicWords = getWordsForTopic(topicId);
            if (topicWords.length === 0 && content.vocabulary.length > 0) {
                // Add AI generated words to bank if not present
                content.vocabulary.forEach(germanWord => {
                    // This is simplified; actual translation might need AI or be part of lesson content
                    const russianTranslation = `Перевод ${germanWord}`; 
                    addWordToBank({ german: germanWord, russian: russianTranslation, topic: topicId, level: levelId });
                });
                setCurrentVocabulary(getWordsForTopic(topicId)); // Re-fetch after adding
            } else {
                setCurrentVocabulary(topicWords);
            }
            setTotalTasks(content.vocabulary.length > 0 ? content.vocabulary.length : 5); // Number of words to test
            // Pick a first word or task
            if (content.vocabulary.length > 0) {
                setCurrentTask(content.vocabulary[0]);
            }
        } else if (moduleId === 'grammar') {
            setCurrentTask(content.grammarExplanation); // The task is to understand and then respond to a prompt based on this
        } else if (moduleId === 'listening') {
            setCurrentTask(content.listeningExercise);
        } else if (moduleId === 'reading') {
            setCurrentTask(content.readingPassage);
        } else if (moduleId === 'writing') {
            setCurrentTask(content.writingPrompt);
        }
      }
      setIsLoadingTask(false);
    };

    if (topicName !== "Загрузка...") {
         fetchLesson();
    }
  }, [levelId, topicId, topicName, moduleId, getTopicLessonContent, getWordsForTopic, addWordToBank]);

  const handleSubmit = async () => {
    if (!currentTask || !lessonContent) return;
    setIsLoadingTask(true);
    setFeedback(null);

    let questionContext = '';
    let expectedAnswer = ''; // Optional

    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        questionContext = `Переведите слово: "${currentTask}"`;
        // Find the current word in vocabulary to get its Russian translation as expected answer
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        expectedAnswer = wordData?.russian || '';
    } else if (moduleId === 'grammar') {
        questionContext = `Задание по грамматике (на основе объяснения): ${lessonContent.grammarExplanation}. Напишите предложение, используя правило.`;
    } else if (moduleId === 'listening') {
        questionContext = `Прослушайте и ответьте на вопросы (текст для прослушивания: ${lessonContent.listeningExercise}). Вопрос: (Нужно добавить конкретный вопрос из AI-контента)`;
    } else if (moduleId === 'reading') {
        questionContext = `Прочитайте текст и ответьте на вопросы (текст: ${lessonContent.readingPassage}). Вопрос: (Нужно добавить конкретный вопрос из AI-контента)`;
    } else if (moduleId === 'writing') {
        questionContext = `Напишите текст на тему: ${lessonContent.writingPrompt}`;
    }
    
    const evaluation = await evaluateUserResponse(moduleId, userResponse, questionContext, expectedAnswer);
    setFeedback(evaluation);
    setIsLoadingTask(false);
    setUserResponse('');

    if (evaluation?.isCorrect) {
      setModuleScore(prev => prev + (100 / totalTasks));
      toast({ title: "Правильно!", description: "Отличная работа!", variant: "default" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) {
            updateWordInBank({...wordData, consecutiveCorrectAnswers: wordData.consecutiveCorrectAnswers + 1, lastTestedDate: new Date().toISOString() });
        }
      }
    } else {
      toast({ title: "Есть ошибка", description: evaluation?.evaluation || "Попробуйте еще раз.", variant: "destructive" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) {
            updateWordInBank({...wordData, errorCount: wordData.errorCount + 1, consecutiveCorrectAnswers: 0, lastTestedDate: new Date().toISOString() });
        }
      }
    }

    setTasksCompleted(prev => prev + 1);
    if (tasksCompleted + 1 >= totalTasks) {
      // Module finished
      const finalScore = Math.round(moduleScore + (evaluation?.isCorrect ? (100/totalTasks) : 0));
      updateModuleProgress(levelId, topicId, moduleId, finalScore);
      toast({ title: "Модуль завершен!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
      router.push(`/levels/${levelId.toLowerCase()}/${topicId}`);
    } else {
      // Next task logic
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && lessonContent.vocabulary.length > tasksCompleted + 1) {
        setCurrentTask(lessonContent.vocabulary[tasksCompleted + 1]);
      } else {
        // For other modules, it might be one large task or AI needs to generate sub-tasks
        // This part needs more complex logic based on AI content structure
      }
    }
  };

  const renderModuleContent = () => {
    if (isLoadingTask && !lessonContent) return <p>Загрузка урока...</p>;
    if (!lessonContent || !currentTask) return <p>Не удалось загрузить содержание модуля. Попробуйте обновить страницу.</p>;

    switch (moduleId) {
      case 'vocabulary':
      case 'wordTest':
        return (
          <div>
            <p className="text-lg mb-2">Слово для изучения/тестирования:</p>
            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold font-headline">{currentTask}</h2>
                <Button variant="ghost" size="icon" onClick={() => speak(currentTask, 'de-DE')}>
                    <Speaker className="h-5 w-5" />
                </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Введите перевод на русский:</p>
          </div>
        );
      case 'grammar':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Грамматическое правило:</h3>
            <div className="prose max-w-none mb-4" dangerouslySetInnerHTML={{ __html: lessonContent.grammarExplanation.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt || "Напишите предложение, используя это правило."}</p> {/* AI prompt might be better */}
          </div>
        );
      case 'listening':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Аудирование:</h3>
            <p className="mb-2">Прослушайте текст:</p>
            <Button onClick={() => speak(lessonContent.listeningExercise, 'de-DE')} className="mb-4">
              <Speaker className="mr-2 h-4 w-4" /> Прослушать
            </Button>
            <p className="text-lg mb-2">Ответьте на вопрос по прослушанному (вопрос должен быть частью listeningExercise или генерироваться ИИ):</p>
            {/* Placeholder for actual question based on listening content */}
            <p className="italic text-muted-foreground">"Какой основной смысл прослушанного текста?" (Пример вопроса)</p>
          </div>
        );
      case 'reading':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Чтение:</h3>
            <div className="prose max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Ответьте на вопрос по тексту (вопрос должен быть частью readingPassage или генерироваться ИИ):</p>
             {/* Placeholder for actual question based on reading content */}
            <p className="italic text-muted-foreground">"О чем этот текст?" (Пример вопроса)</p>
          </div>
        );
      case 'writing':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Письмо:</h3>
            <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt}</p>
          </div>
        );
      default:
        return <p>Тип модуля неизвестен.</p>;
    }
  };

  const moduleTitle = MODULE_NAMES_RU[moduleId as keyof typeof ModuleNamesRuType] || "Модуль";

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Назад к модулям
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{moduleTitle}: {topicName}</CardTitle>
          <CardDescription>Уровень {levelId}. Задание {tasksCompleted + 1} из {totalTasks}.</CardDescription>
          <Progress value={(tasksCompleted / totalTasks) * 100} className="mt-2 h-2" />
        </CardHeader>
        <CardContent>
          <div className="mb-6 min-h-[100px]">
            {renderModuleContent()}
          </div>
          <Textarea
            placeholder="Ваш ответ..."
            value={userResponse}
            onChange={(e) => setUserResponse(e.target.value)}
            className="mb-4 min-h-[100px]"
            disabled={isLoadingTask || tasksCompleted >= totalTasks}
          />
          {feedback && (
            <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500' : 'border-red-500'}`}>
              <CardContent className="p-4">
                <p className={`font-semibold ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {feedback.isCorrect ? "Верно!" : "Ошибка."}
                </p>
                <p className="text-sm">{feedback.evaluation}</p>
                {feedback.suggestedCorrection && (
                  <p className="text-sm mt-1">Предлагаемая коррекция: <span className="italic">{feedback.suggestedCorrection}</span></p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks} className="w-full">
            {isLoadingTask ? "Проверка..." : (tasksCompleted >= totalTasks ? "Модуль завершен" : "Ответить")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
