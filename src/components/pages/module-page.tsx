
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
import type { LanguageLevel, ModuleType, AILessonContent, AIEvaluationResult, VocabularyWord, MODULE_NAMES_RU as ModuleNamesRuType, AILessonVocabularyItem } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

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
  } = useUserData();
  
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

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // For listening module

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
          
          if (wordsToUse.length === 0 && content.vocabulary.length > 0) {
              content.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                  addWordToBank({ 
                      german: vocabItem.german, 
                      russian: vocabItem.russian, 
                      exampleSentence: vocabItem.exampleSentence, 
                      topic: topicId, 
                      level: levelId 
                  });
              });
              wordsToUse = getWordsForTopic(topicId); 
          } else if (wordsToUse.length > 0 && content.vocabulary.length > 0) {
            content.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                const existingWord = wordsToUse.find(w => w.german.toLowerCase() === vocabItem.german.toLowerCase());
                if(!existingWord) {
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
          const availableWordsCount = wordsToUse.length > 0 ? wordsToUse.length : content.vocabulary.length;
          setTotalTasks(availableWordsCount > 0 ? availableWordsCount : 1);

          if (wordsToUse.length > 0) {
            setCurrentTask(wordsToUse[0].german);
          } else if (content.vocabulary.length > 0) {
            setCurrentTask(content.vocabulary[0].german);
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
            setTotalTasks(1); // Fallback
          }
      } else if (moduleId === 'reading') {
          setCurrentTask(content.readingPassage);
          setTotalTasks(1);
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

  const currentModuleIndexInAll = ALL_MODULE_TYPES.indexOf(moduleId);
  const isLastModuleType = currentModuleIndexInAll === ALL_MODULE_TYPES.length - 1;
  const nextModuleType = isLastModuleType ? null : ALL_MODULE_TYPES[currentModuleIndexInAll + 1];

  useEffect(() => {
    if (isModuleFinished && finalModuleScore !== null && finalModuleScore >= 70 && isLastModuleType && userData) {
      let link = `/levels/${levelId.toLowerCase()}/${topicId}`; 
      let text = "К модулям темы";

      if (isTopicCompleted(levelId, topicId)) {
        const currentLevelDefaultTopics = DEFAULT_TOPICS[levelId] || [];
        const currentLevelCustomTopics = userData.customTopics.filter(
          (ct) => ct.id.startsWith(levelId + "_custom_")
        );
        
        const allTopicObjectsForLevel: {id: string, name: string}[] = [
          ...currentLevelDefaultTopics.map(t => ({ id: t.id, name: t.name })),
          ...customTopicObjectsForLevel.map(t => ({ id: t.id, name: t.name }))
        ];

        const currentTopicIndexInAll = allTopicObjectsForLevel.findIndex(t => t.id === topicId);
        let foundNextIncompleteTopicId: string | null = null;

        if (currentTopicIndexInAll !== -1) {
          for (let i = currentTopicIndexInAll + 1; i < allTopicObjectsForLevel.length; i++) {
            const potentialNextTopic = allTopicObjectsForLevel[i];
            if (!isTopicCompleted(levelId, potentialNextTopic.id)) {
              foundNextIncompleteTopicId = potentialNextTopic.id;
              break;
            }
          }
        }

        if (foundNextIncompleteTopicId) {
          link = `/levels/${levelId.toLowerCase()}/${foundNextIncompleteTopicId}`;
          text = "Следующая тема";
        } else {
          link = `/levels/${levelId.toLowerCase()}`;
          text = "К темам уровня";
        }
      }
      setTopicContinuationLink(link);
      setTopicContinuationText(text);
    }
  }, [
    isModuleFinished, 
    finalModuleScore, 
    isLastModuleType, 
    userData, 
    levelId, 
    topicId, 
    isTopicCompleted,
  ]);


  const handleRetryModule = () => {
    setIsModuleFinished(false);
    setFinalModuleScore(null);
    setTasksCompleted(0);
    setModuleScore(0);
    setUserResponse('');
    setCurrentQuestionIndex(0);
    setTopicContinuationLink(null); 
    setTopicContinuationText('');
    fetchLesson(); 
  };

  const handleSubmit = async () => {
    if (!currentTask || !lessonContent || isModuleFinished) return;
    setIsLoadingTask(true);
    setFeedback(null);

    let questionContext = '';
    let expectedAnswer = ''; 

    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask) || lessonContent.vocabulary.find(v => v.german === currentTask);
        questionContext = `Переведите слово: "${currentTask}"${wordData?.exampleSentence ? ` (Пример: ${wordData.exampleSentence})` : ''}`;
        expectedAnswer = wordData?.russian || '';
    } else if (moduleId === 'grammar') {
        questionContext = `Задание по грамматике (на основе объяснения): ${lessonContent.grammarExplanation}. Задание: ${lessonContent.writingPrompt || "Напишите предложение, используя это правило."}`;
    } else if (moduleId === 'listening') {
        if (lessonContent.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[currentQuestionIndex]) {
            questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[currentQuestionIndex]}"`;
        } else {
            questionContext = "Ошибка: нет данных для упражнения по аудированию.";
        }
    } else if (moduleId === 'reading') {
        questionContext = `Прочитайте текст и ответьте на вопросы (текст: ${lessonContent.readingPassage}). Вопрос: (Какова главная идея этого текста?).`;
    } else if (moduleId === 'writing') {
        questionContext = `Напишите текст на тему: ${lessonContent.writingPrompt}`;
    }
    
    const evaluation = await evaluateUserResponse(moduleId, userResponse, questionContext, expectedAnswer);
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
          if (currentVocabulary.length > newTasksCompleted) {
            setCurrentTask(currentVocabulary[newTasksCompleted].german);
          } else if (lessonContent.vocabulary.length > newTasksCompleted) {
             setCurrentTask(lessonContent.vocabulary[newTasksCompleted].german);
          } else {
             setIsModuleFinished(true); 
             setFinalModuleScore(Math.round(moduleScore));
             updateModuleProgress(levelId, topicId, moduleId, Math.round(moduleScore));
             toast({title: "Неожиданное завершение модуля", description: "Кажется, задания закончились раньше."});
          }
      } else if (moduleId === 'listening') {
        if (lessonContent.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions.length > newTasksCompleted) {
            setCurrentQuestionIndex(newTasksCompleted);
            setCurrentTask(lessonContent.listeningExercise.questions[newTasksCompleted]);
        } else {
            setIsModuleFinished(true); 
            setFinalModuleScore(Math.round(moduleScore));
            updateModuleProgress(levelId, topicId, moduleId, Math.round(moduleScore));
            toast({title: "Неожиданное завершение модуля (аудирование)", description: "Кажется, вопросы закончились раньше."});
        }
      }
    }
  };

  const renderModuleContent = () => {
    if (isLoadingTask && !lessonContent) return <div className="text-center p-4"><Progress value={50} className="w-1/2 mx-auto" /> <p className="mt-2">Загрузка урока...</p></div>;
    if (!lessonContent) return <p className="text-center p-4 text-muted-foreground">Не удалось загрузить содержание модуля. Попробуйте обновить страницу или вернуться назад.</p>;


    switch (moduleId) {
      case 'vocabulary':
      case 'wordTest':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка слова...</p>;
        const currentWordData = currentVocabulary.find(v => v.german === currentTask) || 
                                lessonContent.vocabulary.find(v => v.german === currentTask);
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
            <p className="text-md text-muted-foreground mt-1">Введите перевод на русский (ожидается: {currentWordData?.russian || '...'}):</p>
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
        const currentQuestion = lessonContent.listeningExercise.questions?.[currentQuestionIndex];
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
            {currentQuestion && (
                 <p className="text-lg mb-2">Вопрос {currentQuestionIndex + 1}: {currentQuestion}</p>
            )}
            {!currentQuestion && tasksCompleted < totalTasks && <p className="text-muted-foreground">Загрузка вопроса...</p>}
            {!currentQuestion && tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы прослушаны.</p>}
          </div>
        );
      case 'reading':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>;
        return (
          <div>
            <h3 className="text-xl font-semibold mb-2">Чтение:</h3>
            <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} />
            <p className="text-lg mb-2">Ответьте на вопрос по тексту:</p>
            <p className="italic text-muted-foreground">"Какова главная идея этого текста?" (Пример задания, реальные вопросы должны генерироваться AI)</p>
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
                disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && moduleId !== 'listening')}
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
                    {isLastModuleType ? (
                      topicContinuationLink && topicContinuationText ? (
                        <Button asChild size="lg">
                          <Link href={topicContinuationLink}>
                            {topicContinuationText} <ArrowRight className="ml-2 h-5 w-5" />
                          </Link>
                        </Button>
                      ) : ( 
                         <Button size="lg" onClick={() => router.push(`/levels/${levelId.toLowerCase()}/${topicId}`)}>
                            К модулям темы <ArrowRight className="ml-2 h-5 w-5" />
                         </Button>
                      )
                    ) : (
                      nextModuleType && (
                        <Button asChild size="lg">
                          <Link href={`/levels/${levelId.toLowerCase()}/${topicId}/${nextModuleType}`}>
                            Следующий модуль <ArrowRight className="ml-2 h-5 w-5" />
                          </Link>
                        </Button>
                      )
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
              disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && moduleId !== 'listening')}
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
    

      