
"use client";

import { useRouter } from 'next/navigation'; 
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { useUserData } from '@/context/user-data-context';
import type { LanguageLevel, ModuleType, AILessonContent, AIEvaluationResult, VocabularyWord, AILessonVocabularyItem } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES, ALL_LEVELS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';


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

interface ModulePageProps {
  levelId: LanguageLevel;
  topicId: string;
  moduleId: ModuleType;
}

export function ModulePage({ levelId, topicId, moduleId }: ModulePageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { 
    userData, 
    getTopicLessonContent, 
    evaluateUserResponse, 
    updateModuleProgress, 
    addWordToBank, 
    updateWordInBank, 
    getWordsForTopic, 
    isTopicCompleted,
    isLevelCompleted,
  } = useUserData();
  
  const [lessonContent, setLessonContent] = useState<AILessonContent | null>(null);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState<AIEvaluationResult | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(true); // Start true for initial load
  const [moduleScore, setModuleScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(5); 
  const [currentVocabulary, setCurrentVocabulary] = useState<VocabularyWord[]>([]);
  const [isModuleFinished, setIsModuleFinished] = useState(false);
  const [finalModuleScore, setFinalModuleScore] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [nextSequentialUncompletedModule, setNextSequentialUncompletedModule] = useState<ModuleType | null>(null);
  const [topicContinuationLink, setTopicContinuationLink] = useState<string | null>(null);
  const [topicContinuationText, setTopicContinuationText] = useState<string>('');

  const topicName = userData?.progress[levelId]?.topics[topicId]?.name || 
                    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
                    userData?.customTopics.find(t => t.id === topicId)?.name || 
                    "Загрузка...";

  const fetchLesson = useCallback(async () => {
    setIsLoadingTask(true);
    setLessonContent(null); 
    setCurrentTask(null);
    setFeedback(null);
    setCurrentQuestionIndex(0);

    const content = await getTopicLessonContent(levelId, topicName);
    setLessonContent(content);

    if (content) {
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
          let wordsToUse = getWordsForTopic(topicId);
          
          if (content.vocabulary && content.vocabulary.length > 0) {
              content.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                  const existingWordInBankForTopic = wordsToUse.find(w => 
                    w.german.toLowerCase() === vocabItem.german.toLowerCase()
                  );
                  if(!existingWordInBankForTopic) {
                       addWordToBank({ 
                        german: vocabItem.german, 
                        russian: vocabItem.russian, 
                        exampleSentence: vocabItem.exampleSentence, 
                        topic: topicId, 
                        level: levelId 
                    });
                  }
              });
              wordsToUse = getWordsForTopic(topicId); 
          }

          setCurrentVocabulary(wordsToUse); 
          const effectiveVocabularyList = wordsToUse.length > 0 ? wordsToUse : content.vocabulary.map(v => ({...v, id: v.german, consecutiveCorrectAnswers: 0, errorCount: 0}));
          const availableWordsCount = effectiveVocabularyList.length;
          setTotalTasks(availableWordsCount > 0 ? availableWordsCount : 1);

          if (availableWordsCount > 0) {
            setCurrentTask(effectiveVocabularyList[0].german);
          }

      } else if (moduleId === 'grammar') {
          setCurrentTask(content.grammarExplanation); 
          setTotalTasks(1); 
      } else if (moduleId === 'listening') {
          if (content.listeningExercise && content.listeningExercise.questions && content.listeningExercise.questions.length > 0) {
            setTotalTasks(content.listeningExercise.questions.length);
            setCurrentTask(content.listeningExercise.questions[0]);
          } else {
            setCurrentTask("Нет вопросов для аудирования.");
            setTotalTasks(1); 
          }
      } else if (moduleId === 'reading') {
          if (content.readingPassage && content.readingQuestions && content.readingQuestions.length > 0) {
            setTotalTasks(content.readingQuestions.length);
            setCurrentTask(content.readingQuestions[0]); 
          } else if (content.readingPassage) {
            setCurrentTask("Какова главная идея этого текста?"); 
            setTotalTasks(1);
          } else {
            setCurrentTask("Нет данных для модуля чтения.");
            setTotalTasks(1);
          }
      } else if (moduleId === 'writing') {
          setCurrentTask(content.writingPrompt);
          setTotalTasks(1);
      }
    } else {
        setTotalTasks(1); 
    }
    setIsLoadingTask(false);
  }, [levelId, topicName, moduleId, getTopicLessonContent, getWordsForTopic, addWordToBank, topicId]);

  useEffect(() => {
    if (topicName !== "Загрузка...") {
         fetchLesson();
    }
  }, [fetchLesson, topicName]);
  
 useEffect(() => {
    setNextSequentialUncompletedModule(null);
    setTopicContinuationLink(null);
    setTopicContinuationText('');

    if (isModuleFinished && finalModuleScore !== null && userData) {
      if (finalModuleScore >= 70) { 
        let foundNextUncompletedModuleInTopic = false;
        const currentModuleIndex = ALL_MODULE_TYPES.indexOf(moduleId);

        if (currentModuleIndex < ALL_MODULE_TYPES.length - 1) {
          for (let i = currentModuleIndex + 1; i < ALL_MODULE_TYPES.length; i++) {
            const potentialNextModuleType = ALL_MODULE_TYPES[i];
            const moduleProg = userData.progress[levelId]?.topics[topicId]?.modules[potentialNextModuleType];
            if (!moduleProg || moduleProg.score === null || moduleProg.score < 70) {
              setNextSequentialUncompletedModule(potentialNextModuleType);
              foundNextUncompletedModuleInTopic = true;
              break;
            }
          }
        }

        if (!foundNextUncompletedModuleInTopic) {
          const topicIsNowFullyCompleted = isTopicCompleted(levelId, topicId);

          if (topicIsNowFullyCompleted) {
             // Check if level was advanced due to this topic completion
            if (userData.currentLevel !== levelId && ALL_LEVELS.indexOf(userData.currentLevel) > ALL_LEVELS.indexOf(levelId)) {
                setTopicContinuationLink(`/levels/${userData.currentLevel.toLowerCase()}`);
                setTopicContinuationText("К следующему уровню");
            } else if (isLevelCompleted(levelId)) { // Level is complete, but currentLevel might not have changed (e.g. C2)
                const originalLvlIdx = ALL_LEVELS.indexOf(levelId);
                if (levelId === ALL_LEVELS[ALL_LEVELS.length - 1]) { // Max level completed
                    setTopicContinuationLink(`/levels`);
                    setTopicContinuationText("Все уровни пройдены!");
                } else { // Not max level, offer next level
                    setTopicContinuationLink(`/levels/${ALL_LEVELS[originalLvlIdx + 1].toLowerCase()}`);
                    setTopicContinuationText("Перейти к следующему уровню");
                }
            } else { // Topic complete, but level not yet complete (other topics remain)
              const currentLvlData = userData.progress[levelId];
              const defaultTopics = DEFAULT_TOPICS[levelId] || [];
              const customLevelTopics = userData.customTopics?.filter(ct => ct.id.startsWith(levelId + "_")) || [];
              const allConfiguredTopicsForLevel = [
                ...defaultTopics.map(t => ({ id: t.id, name: t.name })),
                ...customLevelTopics.map(t => ({ id: t.id, name: t.name }))
              ];
              const currentTopicOrderIndex = allConfiguredTopicsForLevel.findIndex(t => t.id === topicId);
              let nextIncompleteTopicFoundId: string | null = null;

              if (currentTopicOrderIndex !== -1) {
                for (let i = currentTopicOrderIndex + 1; i < allConfiguredTopicsForLevel.length; i++) {
                  const potentialNextTopic = allConfiguredTopicsForLevel[i];
                  if (currentLvlData?.topics[potentialNextTopic.id] && !isTopicCompleted(levelId, potentialNextTopic.id)) {
                    nextIncompleteTopicFoundId = potentialNextTopic.id;
                    break;
                  }
                }
              }
              if (nextIncompleteTopicFoundId) {
                setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${nextIncompleteTopicFoundId}`);
                setTopicContinuationText("Следующая тема");
              } else {
                setTopicContinuationLink(`/levels/${levelId.toLowerCase()}`);
                setTopicContinuationText("К темам уровня (все пройдено)"); // Fallback if level complete logic is complex
              }
            }
          } else { // Topic not fully complete (implies logic error or this module was not the last uncompleted one)
            setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${topicId}`);
            setTopicContinuationText("К модулям темы");
          }
        }
      }
    }
  }, [isModuleFinished, finalModuleScore, userData, levelId, topicId, moduleId, isTopicCompleted, isLevelCompleted]);


  const handleRetryModule = () => {
    setIsModuleFinished(false);
    setFinalModuleScore(null);
    setTasksCompleted(0);
    setModuleScore(0);
    setUserResponse('');
    setCurrentQuestionIndex(0);
    setNextSequentialUncompletedModule(null);
    setTopicContinuationLink(null); 
    setTopicContinuationText('');
    fetchLesson(); 
  };

  const handleSubmit = async () => {
    if (!currentTask || !lessonContent || isModuleFinished) return;
    setIsLoadingTask(true);
    setFeedback(null);

    let questionContext = '';
    let expectedAnswerForAI = ''; 
    let grammarRulesForAI: string | undefined = undefined;

    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordFromBank = currentVocabulary.find(v => v.german === currentTask);
        const wordFromLesson = lessonContent.vocabulary.find(v => v.german === currentTask);
        const wordData = wordFromBank || wordFromLesson;

        questionContext = `Слово: "${currentTask}"${wordData?.exampleSentence ? ` (Пример: ${wordData.exampleSentence})` : ''}`;
        if (moduleId === 'vocabulary') { 
            questionContext += `. Ожидаемый перевод: ${wordData?.russian || 'не указан'}`;
        }
        expectedAnswerForAI = wordData?.russian || '';
    } else if (moduleId === 'grammar') {
        questionContext = `Задание по грамматике (на основе объяснения): ${lessonContent.grammarExplanation}. Задание: ${lessonContent.writingPrompt || "Напишите предложение, используя это правило."}`;
        grammarRulesForAI = lessonContent.grammarExplanation;
    } else if (moduleId === 'listening') {
        if (lessonContent.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[currentQuestionIndex]) {
            questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[currentQuestionIndex]}"`;
        } else {
            questionContext = "Ошибка: нет данных для упражнения по аудированию.";
        }
    } else if (moduleId === 'reading') {
        if (lessonContent.readingPassage && lessonContent.readingQuestions && lessonContent.readingQuestions[currentQuestionIndex]) {
            questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${lessonContent.readingQuestions[currentQuestionIndex]}"`;
        } else if (lessonContent.readingPassage) { 
             questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${currentTask}"`;
        } else {
            questionContext = "Ошибка: нет данных для упражнения по чтению.";
        }
    } else if (moduleId === 'writing') {
        questionContext = `Напишите текст на тему: ${lessonContent.writingPrompt}`;
    }
    
    const evaluation = await evaluateUserResponse(moduleId, userResponse, questionContext, expectedAnswerForAI, grammarRulesForAI);
    setFeedback(evaluation);
    setIsLoadingTask(false);
    
    let scoreIncrement = 0;
    if (evaluation?.isCorrect) {
      scoreIncrement = (100 / (totalTasks || 1)); 
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
    setUserResponse(''); 

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
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest')) {
          const effectiveVocabularyList = currentVocabulary.length > 0 ? currentVocabulary : lessonContent.vocabulary.map(v => ({...v, id: v.german, consecutiveCorrectAnswers: 0, errorCount: 0}));
          if (effectiveVocabularyList.length > newTasksCompleted) {
            setCurrentTask(effectiveVocabularyList[newTasksCompleted].german);
          } else {
             setIsModuleFinished(true); 
             const finalScoreFallback = Math.round(moduleScore);
             updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback);
             setFinalModuleScore(finalScoreFallback);
             toast({title: "Неожиданное завершение модуля", description: "Кажется, задания закончились раньше."});
          }
      } else if (moduleId === 'listening' || moduleId === 'reading') {
        const questionsList = moduleId === 'listening'
            ? lessonContent.listeningExercise?.questions
            : lessonContent.readingQuestions;
        
        if (questionsList && questionsList.length > newTasksCompleted) {
            setCurrentQuestionIndex(newTasksCompleted);
            setCurrentTask(questionsList[newTasksCompleted]);
        } else {
            setIsModuleFinished(true); 
            const finalScoreFallback = Math.round(moduleScore);
            updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback);
            setFinalModuleScore(finalScoreFallback);
            toast({title: `Неожиданное завершение модуля (${moduleId})`, description: "Кажется, вопросы закончились раньше."});
        }
      }
    }
  };

  const renderModuleContent = () => {
    // Skeleton loading is handled above this function call if isLoadingTask && !lessonContent
    if (!lessonContent) return <p className="text-center p-4 text-muted-foreground">Не удалось загрузить содержание модуля. Попробуйте обновить страницу или вернуться назад.</p>;


    switch (moduleId) {
      case 'vocabulary':
      case 'wordTest':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка слова...</p>;
        const wordFromBank = currentVocabulary.find(v => v.german === currentTask);
        const wordFromLesson = lessonContent.vocabulary.find(v => v.german === currentTask);
        const currentWordData = wordFromBank || wordFromLesson;
        const displayExpectedAnswer = moduleId === 'vocabulary' ? (currentWordData?.russian || '...') : '???';

        return (
          <div>
            <p className="text-lg mb-1">{moduleId === 'vocabulary' ? "Слово для изучения:" : "Слово для тестирования:"}</p>
            <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold font-headline">{currentTask}</h2>
                <Button variant="ghost" size="icon" onClick={() => speak(currentTask, 'de-DE')}>
                    <Speaker className="h-6 w-6" />
                </Button>
            </div>
            {currentWordData?.exampleSentence && <p className="text-sm italic text-muted-foreground mb-2">Пример: {currentWordData.exampleSentence}</p>}
            <p className="text-md text-muted-foreground mt-1">
              Введите перевод на русский 
              {moduleId === 'vocabulary' ? ` (ожидается: ${displayExpectedAnswer})` : ':'}
            </p>
          </div>
        );
      case 'grammar':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка грамматики...</p>;
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Грамматическое правило:</h3>
            <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.grammarExplanation.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt || "Напишите предложение, используя это правило."}</p>
          </div>
        );
      case 'listening':
        if (!lessonContent.listeningExercise || !lessonContent.listeningExercise.script) return <p className="text-center p-4 text-muted-foreground">Загрузка аудирования...</p>;
        const currentListeningQuestion = lessonContent.listeningExercise.questions?.[currentQuestionIndex];
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Аудирование:</h3>
            <p className="mb-1">Прослушайте текст:</p>
            <div className="prose dark:prose-invert max-w-none mb-2 p-3 border rounded-md bg-card-foreground/5 text-sm">
              {lessonContent.listeningExercise.script}
            </div>
            <Button onClick={() => speak(lessonContent.listeningExercise.script, 'de-DE')} className="mb-4">
              <Speaker className="mr-2 h-4 w-4" /> Прослушать текст
            </Button>
            {currentListeningQuestion && ( 
                 <p className="text-lg mb-2">Вопрос {currentQuestionIndex + 1}: {currentTask}</p>
            )}
            {!currentTask && tasksCompleted < totalTasks && <p className="text-muted-foreground">Загрузка вопроса...</p>}
            {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы прослушаны.</p>}
          </div>
        );
      case 'reading':
        if (!lessonContent.readingPassage) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>;
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Чтение:</h3>
            <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} />
            {currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && (
                 <p className="text-lg mb-2">Вопрос {currentQuestionIndex + 1}: {currentTask}</p>
            )}
            {!currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>}
            {(!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && tasksCompleted < totalTasks && (
                 <p className="text-lg mb-2">Вопрос: {currentTask}</p> 
            )}
            {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы пройдены.</p>}
          </div>
        );
      case 'writing':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка задания для письма...</p>;
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

  const moduleTitle = MODULE_NAMES_RU[moduleId] || "Модуль";
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;
  const placeholderText = moduleId === 'wordTest' ? "Введите перевод на русский..." : "Ваш ответ...";

  if (isLoadingTask && !lessonContent) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-9 w-32 mb-6" /> {/* Back button skeleton */}
        <Card className="shadow-xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" /> {/* Title skeleton */}
            <Skeleton className="h-4 w-1/2 mb-2" /> {/* Description skeleton */}
            <Skeleton className="h-2 w-full" /> {/* Progress bar skeleton */}
          </CardHeader>
          <CardContent>
            <div className="mb-6 min-h-[100px] space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-24 w-full mb-4" /> {/* Textarea skeleton */}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-12 w-full" /> {/* Button skeleton */}
          </CardFooter>
        </Card>
      </div>
    );
  }

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
                placeholder={placeholderText}
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                className="mb-4 min-h-[100px]"
                disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
              />
            </>
          ) : (
            <div className="text-center p-6">
              {finalModuleScore !== null && finalModuleScore >= 70 ? (
                <>
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Модуль пройден успешно!</h3>
                  <p className="text-muted-foreground mb-4">Ваш результат: {finalModuleScore}%</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    {nextSequentialUncompletedModule ? (
                        <Button asChild size="lg">
                        <Link href={`/levels/${levelId.toLowerCase()}/${topicId}/${nextSequentialUncompletedModule}`}>
                            Следующий модуль ({MODULE_NAMES_RU[nextSequentialUncompletedModule]}) <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                        </Button>
                    ) : topicContinuationLink && topicContinuationText ? (
                        <Button asChild size="lg">
                        <Link href={topicContinuationLink}>
                            {topicContinuationText} <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                        </Button>
                    ) : (
                        <Button size="lg" onClick={() => router.push(`/levels/${levelId.toLowerCase()}/${topicId}`)}>
                            К модулям темы <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    )}
                    <Button variant="outline" size="lg" onClick={() => router.push(`/levels/${levelId.toLowerCase()}/${topicId}`)}>
                        К списку модулей
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">Нужно еще немного постараться!</h3>
                  <p className="text-muted-foreground mb-4">Ваш результат: {finalModuleScore}%. Вы можете попробовать пройти модуль снова.</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={handleRetryModule} size="lg">
                        <RotateCcw className="mr-2 h-5 w-5" /> Попробовать модуль снова
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => router.push(`/levels/${levelId.toLowerCase()}/${topicId}`)}>
                        К списку модулей
                    </Button>
                  </div>
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
              disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
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
    
