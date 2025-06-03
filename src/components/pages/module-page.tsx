
"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { useUserData } from '@/context/user-data-context';
import type { LanguageLevel, ModuleType, AILessonContent, AIEvaluationResult, VocabularyWord, MODULE_NAMES_RU as ModuleNamesRuType } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

// Dummy TTS function - replace with actual implementation
const speak = (text: string, lang: 'ru-RU' | 'de-DE') => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
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
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState<AIEvaluationResult | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [moduleScore, setModuleScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(5); 
  const [currentVocabulary, setCurrentVocabulary] = useState<VocabularyWord[]>([]);
  const [isModuleFinished, setIsModuleFinished] = useState(false);
  const [finalModuleScore, setFinalModuleScore] = useState<number | null>(null);

  const topicName = userData?.progress[levelId]?.topics[topicId]?.name || 
                    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
                    userData?.customTopics.find(t => t.id === topicId)?.name || 
                    "Загрузка...";

  const fetchLesson = useCallback(async () => {
    setIsLoadingTask(true);
    setLessonContent(null); // Reset lesson content to ensure fresh load
    setCurrentTask(null);
    setFeedback(null);

    const content = await getTopicLessonContent(levelId, topicName);
    setLessonContent(content);
    if (content) {
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
          const topicWords = getWordsForTopic(topicId);
          let wordsToUse = topicWords;
          if (topicWords.length === 0 && content.vocabulary.length > 0) {
              content.vocabulary.forEach(germanWord => {
                  const russianTranslation = `Перевод ${germanWord}`; 
                  addWordToBank({ german: germanWord, russian: russianTranslation, topic: topicId, level: levelId });
              });
              wordsToUse = getWordsForTopic(topicId); // Re-fetch after adding
          }
          setCurrentVocabulary(wordsToUse);
          setTotalTasks(wordsToUse.length > 0 ? wordsToUse.length : (content.vocabulary.length > 0 ? content.vocabulary.length : 1)); // Avoid 0 total tasks
          if (wordsToUse.length > 0) setCurrentTask(wordsToUse[0].german);
          else if (content.vocabulary.length > 0) setCurrentTask(content.vocabulary[0]);

      } else if (moduleId === 'grammar') {
          setCurrentTask(content.grammarExplanation); 
          setTotalTasks(1); // Typically grammar is one large task or a few focused ones
      } else if (moduleId === 'listening') {
          setCurrentTask(content.listeningExercise);
          setTotalTasks(1);
      } else if (moduleId === 'reading') {
          setCurrentTask(content.readingPassage);
          setTotalTasks(1);
      } else if (moduleId === 'writing') {
          setCurrentTask(content.writingPrompt);
          setTotalTasks(1);
      }
    } else {
        setTotalTasks(1); // Fallback if content is null
    }
    setIsLoadingTask(false);
  }, [levelId, topicName, moduleId, getTopicLessonContent, getWordsForTopic, addWordToBank, topicId]);

  useEffect(() => {
    if (topicName !== "Загрузка...") {
         fetchLesson();
    }
  }, [fetchLesson, topicName]);

  const handleRetryModule = () => {
    setIsModuleFinished(false);
    setFinalModuleScore(null);
    setTasksCompleted(0);
    setModuleScore(0);
    setUserResponse('');
    fetchLesson(); // This will re-fetch content
  };

  const handleSubmit = async () => {
    if (!currentTask || !lessonContent || isModuleFinished) return;
    setIsLoadingTask(true);
    setFeedback(null);

    let questionContext = '';
    let expectedAnswer = ''; 

    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        questionContext = `Переведите слово: "${currentTask}"${wordData?.exampleSentence ? ` (Пример: ${wordData.exampleSentence})` : ''}`;
        expectedAnswer = wordData?.russian || '';
    } else if (moduleId === 'grammar') {
        questionContext = `Задание по грамматике (на основе объяснения): ${lessonContent.grammarExplanation}. Задание: ${lessonContent.writingPrompt || "Напишите предложение, используя это правило."}`;
    } else if (moduleId === 'listening') {
        questionContext = `Прослушайте и ответьте на вопросы (текст для прослушивания: ${lessonContent.listeningExercise}). Вопрос: (Вам нужно сформулировать вопрос на основе прослушанного текста или дать задание, например, кратко изложить суть).`;
    } else if (moduleId === 'reading') {
        questionContext = `Прочитайте текст и ответьте на вопросы (текст: ${lessonContent.readingPassage}). Вопрос: (Вам нужно сформулировать вопрос на основе прочитанного текста или дать задание).`;
    } else if (moduleId === 'writing') {
        questionContext = `Напишите текст на тему: ${lessonContent.writingPrompt}`;
    }
    
    const evaluation = await evaluateUserResponse(moduleId, userResponse, questionContext, expectedAnswer);
    setFeedback(evaluation);
    setIsLoadingTask(false);
    

    let scoreIncrement = 0;
    if (evaluation?.isCorrect) {
      scoreIncrement = (100 / (totalTasks || 1)); // Avoid division by zero
      setModuleScore(prev => prev + scoreIncrement);
      toast({ title: "Правильно!", description: "Отличная работа!", variant: "default" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) {
            updateWordInBank({...wordData, consecutiveCorrectAnswers: (wordData.consecutiveCorrectAnswers || 0) + 1, lastTestedDate: new Date().toISOString() });
        }
      }
    } else {
      toast({ title: "Есть ошибка", description: evaluation?.evaluation || "Попробуйте еще раз.", variant: "destructive" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) {
            updateWordInBank({...wordData, errorCount: (wordData.errorCount || 0) + 1, consecutiveCorrectAnswers: 0, lastTestedDate: new Date().toISOString() });
        }
      }
    }
    setUserResponse(''); // Clear input after submission

    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) {
      const finalScore = Math.round(moduleScore + (evaluation?.isCorrect ? scoreIncrement : 0));
      updateModuleProgress(levelId, topicId, moduleId, finalScore);
      setFinalModuleScore(finalScore);
      setIsModuleFinished(true);
      if (finalScore >= 70) {
        toast({ title: "Модуль завершен успешно!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
      } else {
        toast({ title: "Модуль завершен", description: `Ваш результат: ${finalScore}%. Попробуйте еще раз для улучшения.`, variant: "destructive", duration: 5000 });
      }
    } else {
      // Next task logic
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest')) {
          if (currentVocabulary.length > newTasksCompleted) {
            setCurrentTask(currentVocabulary[newTasksCompleted].german);
          } else if (lessonContent.vocabulary.length > newTasksCompleted) {
             setCurrentTask(lessonContent.vocabulary[newTasksCompleted]);
          } else {
             // Should not happen if totalTasks is set correctly
             setIsModuleFinished(true); // No more tasks
             setFinalModuleScore(Math.round(moduleScore));
             updateModuleProgress(levelId, topicId, moduleId, Math.round(moduleScore));
             toast({title: "Неожиданное завершение модуля", description: "Кажется, задания закончились раньше."});
          }
      } else {
        // For other modules, usually one big task, so this branch might not be hit often if totalTasks is 1.
        // If it's multi-task, AI needs to provide sub-tasks. For now, we assume totalTasks handles this.
      }
    }
  };

  const renderModuleContent = () => {
    if (isLoadingTask && !lessonContent) return <div className="text-center p-4"><Progress value={50} className="w-1/2 mx-auto" /> <p className="mt-2">Загрузка урока...</p></div>;
    if (!lessonContent || !currentTask) return <p className="text-center p-4 text-muted-foreground">Не удалось загрузить содержание модуля. Попробуйте обновить страницу или вернуться назад.</p>;

    switch (moduleId) {
      case 'vocabulary':
      case 'wordTest':
        const currentWordData = currentVocabulary.find(v => v.german === currentTask);
        return (
          <div>
            <p className="text-lg mb-1">Слово для изучения/тестирования:</p>
            <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold font-headline">{currentTask}</h2>
                <Button variant="ghost" size="icon" onClick={() => speak(currentTask, 'de-DE')}>
                    <Speaker className="h-6 w-6" />
                </Button>
            </div>
            {currentWordData?.exampleSentence && <p className="text-sm italic text-muted-foreground mb-2">Пример: {currentWordData.exampleSentence}</p>}
            <p className="text-md text-muted-foreground mt-1">Введите перевод на русский:</p>
          </div>
        );
      case 'grammar':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Грамматическое правило:</h3>
            <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.grammarExplanation.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt || "Напишите предложение, используя это правило."}</p>
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
            <p className="italic text-muted-foreground">"Сформулируйте основной смысл услышанного." (Пример задания)</p>
          </div>
        );
      case 'reading':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Чтение:</h3>
            <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Ответьте на вопрос по тексту (вопрос должен быть частью readingPassage или генерироваться ИИ):</p>
            <p className="italic text-muted-foreground">"Какова главная идея этого текста?" (Пример задания)</p>
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
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Назад к модулям
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{moduleTitle}: {topicName}</CardTitle>
          {!isModuleFinished ? (
            <CardDescription>Уровень {levelId}. Задание {tasksCompleted + 1} из {totalTasks}.</CardDescription>
          ) : (
            <CardDescription>Уровень {levelId}. Модуль завершен. Ваш результат: {finalModuleScore}%</CardDescription>
          )}
          <Progress value={isModuleFinished ? (finalModuleScore ?? 0) : progressPercent} className="mt-2 h-2" />
        </CardHeader>
        <CardContent>
          {!isModuleFinished ? (
            <>
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
            </>
          ) : (
            <div className="text-center p-6">
              {finalModuleScore !== null && finalModuleScore >= 70 ? (
                <>
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Модуль пройден успешно!</h3>
                  <p className="text-muted-foreground">Ваш результат: {finalModuleScore}%</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Нужно еще немного постараться!</h3>
                  <p className="text-muted-foreground mb-4">Ваш результат: {finalModuleScore}%. Вы можете попробовать пройти модуль снова.</p>
                  <Button onClick={handleRetryModule} size="lg">
                    <RotateCcw className="mr-2 h-5 w-5" /> Попробовать модуль снова
                  </Button>
                </>
              )}
            </div>
          )}
          {feedback && !isModuleFinished && (
            <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
              <CardContent className="p-4">
                <p className={`font-semibold ${feedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
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
        {!isModuleFinished && (
          <CardFooter>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks} 
              className="w-full"
              size="lg"
            >
              {isLoadingTask ? "Проверка..." : "Ответить"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
