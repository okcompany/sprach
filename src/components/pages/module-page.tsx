
"use client";

import { useRouter } from 'next/navigation'; 
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { useUserData } from '@/context/user-data-context';
import type { LanguageLevel, ModuleType, AILessonContent, AIEvaluationResult, VocabularyWord, AILessonVocabularyItem, AIMatchingExercise } from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES, ALL_LEVELS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Shuffle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


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

// Helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

interface MatchItem {
  id: string;
  text: string;
  originalText: string; // To compare with AI's correct pairs
  type: 'pair' | 'distractor';
  selected: boolean;
  matchedId: string | null; // ID of the matched item in the other column
  feedback?: 'correct' | 'incorrect' | 'unmatched';
  isPairTarget?: boolean; // True if this item is part of a correct pair from AI
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
  const [currentTask, setCurrentTask] = useState<string | null>(null); // For non-interactive tasks
  const [userResponse, setUserResponse] = useState('');
  const [feedback, setFeedback] = useState<AIEvaluationResult | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(true); 
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

  // State for Matching Exercise
  const [activeMatchingExercise, setActiveMatchingExercise] = useState<AIMatchingExercise | null>(null);
  const [germanMatchItems, setGermanMatchItems] = useState<MatchItem[]>([]);
  const [russianMatchItems, setRussianMatchItems] = useState<MatchItem[]>([]);
  const [selectedGermanItemId, setSelectedGermanItemId] = useState<string | null>(null);
  const [isMatchingChecked, setIsMatchingChecked] = useState(false);


  const topicName = useMemo(() => 
    userData?.progress[levelId]?.topics[topicId]?.name || 
    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
    userData?.customTopics.find(t => t.id === topicId)?.name || 
    "Загрузка...",
  [userData, levelId, topicId]);

  const fetchLesson = useCallback(async () => {
    setIsLoadingTask(true);
    setLessonContent(null); 
    setCurrentTask(null);
    setFeedback(null);
    setCurrentQuestionIndex(0);
    setActiveMatchingExercise(null);
    setGermanMatchItems([]);
    setRussianMatchItems([]);
    setSelectedGermanItemId(null);
    setIsMatchingChecked(false);

    if (topicName === "Загрузка...") {
      setIsLoadingTask(false); 
      return;
    }

    const content = await getTopicLessonContent(levelId, topicName);
    setLessonContent(content);

    if (content) {
      if (moduleId === 'vocabulary') {
        const matchingExercise = content.interactiveVocabularyExercises?.find(ex => ex.type === 'matching') as AIMatchingExercise | undefined;

        if (matchingExercise) {
          setActiveMatchingExercise(matchingExercise);
          setTotalTasks(1); // The whole matching block is one task

          const germanPairs = matchingExercise.pairs.map((p, i) => ({ id: `gp_${i}`, text: p.german, originalText: p.german, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const germanDistractors = (matchingExercise.germanDistractors || []).map((d, i) => ({ id: `gd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setGermanMatchItems(shuffleArray([...germanPairs, ...germanDistractors]));

          const russianPairs = matchingExercise.pairs.map((p, i) => ({ id: `rp_${i}`, text: p.russian, originalText: p.russian, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const russianDistractors = (matchingExercise.russianDistractors || []).map((d, i) => ({ id: `rd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setRussianMatchItems(shuffleArray([...russianPairs, ...russianDistractors]));
          
          setCurrentTask(null); // No standard vocab task if matching exercise is active
        } else {
          // Fallback to standard vocabulary if no matching exercise
          let wordsToUse = getWordsForTopic(topicId); 
          if (content.vocabulary && content.vocabulary.length > 0) {
              content.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                  const existingWordInBankForTopic = wordsToUse.find(w => w.german.toLowerCase() === vocabItem.german.toLowerCase());
                  if(!existingWordInBankForTopic) { addWordToBank({ german: vocabItem.german, russian: vocabItem.russian, exampleSentence: vocabItem.exampleSentence, topic: topicId, level: levelId }); }
              });
              wordsToUse = getWordsForTopic(topicId); 
          }
          setCurrentVocabulary(wordsToUse); 
          const effectiveVocabularyList = wordsToUse.length > 0 ? wordsToUse : content.vocabulary.map(v => ({...v, id: v.german, consecutiveCorrectAnswers: 0, errorCount: 0}));
          const availableWordsCount = effectiveVocabularyList.length;
          if (availableWordsCount === 0) {
            // ... (handling for no words remains the same)
            updateModuleProgress(levelId, topicId, moduleId, 0);
            setFinalModuleScore(0);
            setIsModuleFinished(true);
            toast({ title: "Модуль завершен", description: "Слов для этого модуля не найдено. Модуль завершен с результатом 0%.", variant: "default", duration: 5000 });
            setIsLoadingTask(false);
            return;
          }
          setTotalTasks(availableWordsCount);
          setCurrentTask(effectiveVocabularyList[0].german);
        }
      } else if (moduleId === 'grammar') { /* ... grammar logic ... */ setCurrentTask(content.grammarExplanation); setTotalTasks(1); }
      else if (moduleId === 'listening') { /* ... listening logic ... */  if (content.listeningExercise && content.listeningExercise.questions && content.listeningExercise.questions.length > 0) { setTotalTasks(content.listeningExercise.questions.length); setCurrentTask(content.listeningExercise.questions[0]); } else { setCurrentTask("Нет вопросов для аудирования."); setTotalTasks(1);  } }
      else if (moduleId === 'reading') { /* ... reading logic ... */ if (content.readingPassage && content.readingQuestions && content.readingQuestions.length > 0) { setTotalTasks(content.readingQuestions.length); setCurrentTask(content.readingQuestions[0]);  } else if (content.readingPassage) { setCurrentTask("Какова главная идея этого текста?");  setTotalTasks(1); } else { setCurrentTask("Нет данных для модуля чтения."); setTotalTasks(1); } }
      else if (moduleId === 'writing') { /* ... writing logic ... */ setCurrentTask(content.writingPrompt); setTotalTasks(1); }
    } else {  // AI content failed to load
      if (moduleId === 'vocabulary') { // Specific fallback for vocabulary
        const wordsFromBank = getWordsForTopic(topicId);
        setCurrentVocabulary(wordsFromBank);
        const availableWordsCount = wordsFromBank.length;
        if (availableWordsCount > 0) {
          toast({ title: "Загрузка AI-контента не удалась", description: "Модуль будет использовать слова из вашего словаря для этой темы.", variant: "default", duration: 6000 });
          setTotalTasks(availableWordsCount);
          setCurrentTask(wordsFromBank[0].german);
        } else { /* ... handling for no words ... */ updateModuleProgress(levelId, topicId, moduleId, 0); setFinalModuleScore(0); setIsModuleFinished(true); toast({ title: "Модуль завершен", description: "Не удалось загрузить новый контент, и слов в банке для этой темы нет.", variant: "default", duration: 7000 }); setIsLoadingTask(false); return; }
      } else { /* ... generic error handling ... */ toast({ title: "Ошибка загрузки урока", description: `Не удалось получить материалы для модуля "${MODULE_NAMES_RU[moduleId]}".`, variant: "destructive", duration: 7000 }); setTotalTasks(1); setCurrentTask(null);  }
    }
    setIsLoadingTask(false);
  }, [levelId, topicName, moduleId, getTopicLessonContent, getWordsForTopic, addWordToBank, topicId, toast, updateModuleProgress]);

  useEffect(() => {
    if (topicName !== "Загрузка...") {
         fetchLesson();
    }
  }, [fetchLesson, topicName]); 
  
 useEffect(() => { // For navigation after module completion
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
            if (!moduleProg || moduleProg.score === null || moduleProg.score < 70) { setNextSequentialUncompletedModule(potentialNextModuleType); foundNextUncompletedModuleInTopic = true; break; }
          }
        }
        if (!foundNextUncompletedModuleInTopic) {
          const topicIsNowFullyCompleted = isTopicCompleted(levelId, topicId);
          if (topicIsNowFullyCompleted) {
            const levelIsNowFullyCompleted = isLevelCompleted(levelId);
            if (levelIsNowFullyCompleted) {
              const originalLvlIdx = ALL_LEVELS.indexOf(levelId);
              if (levelId === ALL_LEVELS[ALL_LEVELS.length - 1]) { setTopicContinuationLink(`/levels`); setTopicContinuationText("Все уровни пройдены!"); }
              else { const nextDesignatedLevel = (userData.currentLevel !== levelId && ALL_LEVELS.includes(userData.currentLevel)) ? userData.currentLevel : ALL_LEVELS[originalLvlIdx + 1]; setTopicContinuationLink(`/levels/${nextDesignatedLevel.toLowerCase()}`); setTopicContinuationText(`Перейти к уровню ${nextDesignatedLevel}`); }
            } else { 
              const currentLvlData = userData.progress[levelId];
              const defaultTopics = DEFAULT_TOPICS[levelId] || [];
              const customLevelTopics = userData.customTopics?.filter(ct => ct.id.startsWith(levelId + "_")) || [];
              const allConfiguredTopicsForLevel = [ ...defaultTopics.map(t => ({ id: t.id, name: t.name })), ...customLevelTopics.map(t => ({ id: t.id, name: t.name })) ];
              const currentTopicOrderIndex = allConfiguredTopicsForLevel.findIndex(t => t.id === topicId);
              let nextIncompleteTopicFoundId: string | null = null;
              if (currentTopicOrderIndex !== -1) {
                for (let i = currentTopicOrderIndex + 1; i < allConfiguredTopicsForLevel.length; i++) {
                  const potentialNextTopic = allConfiguredTopicsForLevel[i];
                  if (currentLvlData?.topics[potentialNextTopic.id] && !isTopicCompleted(levelId, potentialNextTopic.id)) { nextIncompleteTopicFoundId = potentialNextTopic.id; break; }
                }
              }
              if (nextIncompleteTopicFoundId) { setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${nextIncompleteTopicFoundId}`); setTopicContinuationText("Следующая тема"); }
              else { setTopicContinuationLink(`/levels/${levelId.toLowerCase()}`); setTopicContinuationText("К темам уровня");  }
            }
          } else { setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${topicId}`); setTopicContinuationText("К модулям темы"); }
        }
      }
    }
  }, [isModuleFinished, finalModuleScore, userData, levelId, topicId, moduleId, isTopicCompleted, isLevelCompleted, router]);


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
    setActiveMatchingExercise(null); // Reset matching exercise state
    setIsMatchingChecked(false);
    setSelectedGermanItemId(null);
    fetchLesson(); 
  };

  const handleGermanItemSelect = (itemId: string) => {
    if (isMatchingChecked) return;
    setSelectedGermanItemId(itemId);
    setGermanMatchItems(prevItems => prevItems.map(item => ({ ...item, selected: item.id === itemId })));
    setRussianMatchItems(prevItems => prevItems.map(item => ({ ...item, selected: false }))); // Deselect any Russian item
  };

  const handleRussianItemSelect = (russianItemId: string) => {
    if (isMatchingChecked || !selectedGermanItemId) return;

    // Check if this Russian item is already matched
    const isRussianItemAlreadyMatched = russianMatchItems.find(r => r.id === russianItemId)?.matchedId !== null;
    if(isRussianItemAlreadyMatched) return;

    setGermanMatchItems(prevItems => prevItems.map(item => 
        item.id === selectedGermanItemId ? { ...item, matchedId: russianItemId, selected: false } : item
    ));
    setRussianMatchItems(prevItems => prevItems.map(item => 
        item.id === russianItemId ? { ...item, matchedId: selectedGermanItemId, selected: false } : item
    ));
    setSelectedGermanItemId(null);
  };
  
  const handleUnmatchPair = (germanItemIdToUnmatch: string) => {
    if (isMatchingChecked) return;
    
    const germanItem = germanMatchItems.find(gi => gi.id === germanItemIdToUnmatch);
    if (!germanItem || !germanItem.matchedId) return;

    const russianItemIdToUnmatch = germanItem.matchedId;

    setGermanMatchItems(prevItems => prevItems.map(item => 
        item.id === germanItemIdToUnmatch ? { ...item, matchedId: null, selected: false, feedback: undefined } : item
    ));
    setRussianMatchItems(prevItems => prevItems.map(item => 
        item.id === russianItemIdToUnmatch ? { ...item, matchedId: null, selected: false, feedback: undefined } : item
    ));
    setSelectedGermanItemId(null);
  }


  const handleMatchingCheck = () => {
    if (!activeMatchingExercise) return;
    setIsMatchingChecked(true);
    let correctMatchesCount = 0;

    const updatedGermanItems = germanMatchItems.map(gerItem => {
      if (gerItem.matchedId) {
        const rusItemOriginalText = russianMatchItems.find(rusItem => rusItem.id === gerItem.matchedId)?.originalText;
        const isCorrectPair = activeMatchingExercise.pairs.some(
          p => p.german === gerItem.originalText && p.russian === rusItemOriginalText
        );
        if (isCorrectPair) {
          correctMatchesCount++;
          return { ...gerItem, feedback: 'correct' as const };
        } else {
          return { ...gerItem, feedback: 'incorrect' as const };
        }
      } else if (gerItem.isPairTarget) { // Part of a correct pair but not matched by user
         return { ...gerItem, feedback: 'unmatched' as const };
      }
      return gerItem; // Distractor or correctly unmatched
    });
    setGermanMatchItems(updatedGermanItems);

    // Also mark feedback on Russian items that were part of correct pairs but incorrectly matched or unmatched
    const updatedRussianItems = russianMatchItems.map(rusItem => {
        if (rusItem.isPairTarget && !rusItem.matchedId) { // Was a target but user didn't match it
            return { ...rusItem, feedback: 'unmatched' as const };
        }
        // If it was matched, its German partner already got feedback.
        // If it was a distractor and not matched, it's fine.
        return rusItem;
    });
    setRussianMatchItems(updatedRussianItems);


    const finalScore = activeMatchingExercise.pairs.length > 0 
      ? Math.round((correctMatchesCount / activeMatchingExercise.pairs.length) * 100)
      : 0;
    
    updateModuleProgress(levelId, topicId, moduleId, finalScore);
    setFinalModuleScore(finalScore);
    setIsModuleFinished(true);
    setTasksCompleted(1); // Whole matching exercise is one task
    
    if (finalScore >= 70) {
      toast({ title: "Упражнение завершено успешно!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
    } else {
      toast({ title: "Упражнение завершено", description: `Ваш результат: ${finalScore}%. Попробуйте еще раз для улучшения.`, variant: "destructive", duration: 5000 });
    }
  };


  const handleSubmit = async () => { // For non-interactive tasks
    if (!currentTask || isModuleFinished || activeMatchingExercise) return;
    setIsLoadingTask(true);
    setFeedback(null);

    let questionContext = '';
    let expectedAnswerForAI = ''; 
    let grammarRulesForAI: string | undefined = undefined;

    // ... (existing logic for building questionContext, expectedAnswerForAI for non-matching tasks)
    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordFromBankOrLesson = currentVocabulary.find(v => v.german === currentTask) || lessonContent?.vocabulary.find(v => v.german === currentTask);
        if (!wordFromBankOrLesson) { toast({ title: "Ошибка данных слова", description: `Не удалось получить данные для оценки слова "${currentTask}".`, variant: "destructive" }); setIsLoadingTask(false); return; }
        const wordData = wordFromBankOrLesson;
        questionContext = `Слово: "${currentTask}"${wordData.exampleSentence ? ` (Пример: ${wordData.exampleSentence})` : ''}`;
        if (moduleId === 'vocabulary') { questionContext += `. Ожидаемый перевод: ${wordData.russian || 'не указан'}`; }
        expectedAnswerForAI = wordData.russian || '';
    } else if (moduleId === 'grammar') {
        if (!lessonContent?.grammarExplanation) { toast({ title: "Ошибка данных урока", description: "Нет объяснения грамматики для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
        questionContext = `Задание по грамматике (на основе объяснения): ${lessonContent.grammarExplanation}. Задание: ${lessonContent.writingPrompt || "Напишите предложение, используя это правило."}`;
        grammarRulesForAI = lessonContent.grammarExplanation;
    } else if (moduleId === 'listening') { 
        if (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[currentQuestionIndex]) { questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[currentQuestionIndex]}"`; }
        else { toast({ title: "Ошибка данных урока", description: "Нет данных для аудирования для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
    } else if (moduleId === 'reading') { 
        if (lessonContent?.readingPassage && lessonContent.readingQuestions && lessonContent.readingQuestions[currentQuestionIndex]) { questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${lessonContent.readingQuestions[currentQuestionIndex]}"`; }
        else if (lessonContent?.readingPassage) { questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${currentTask}"`; }
        else { toast({ title: "Ошибка данных урока", description: "Нет данных для чтения для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
    } else if (moduleId === 'writing') { 
        if (!lessonContent?.writingPrompt) { toast({ title: "Ошибка данных урока", description: "Нет задания для письма для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
        questionContext = `Напишите текст на тему: ${lessonContent.writingPrompt}`;
    }
    
    const evaluation = await evaluateUserResponse(levelId, topicId, moduleId, userResponse, questionContext, expectedAnswerForAI, grammarRulesForAI);
    
    if (!evaluation) { toast({ title: "Ошибка оценки ответа", description: "Не удалось получить оценку от AI.", variant: "destructive", duration: 7000 }); setIsLoadingTask(false); return;  }
    setFeedback(evaluation);
    setIsLoadingTask(false);
    
    let scoreIncrement = 0;
    if (evaluation?.isCorrect) {
      scoreIncrement = (100 / (totalTasks || 1)); 
      setModuleScore(prev => prev + scoreIncrement);
      toast({ title: "Правильно!", description: "Отличная работа!", variant: "default" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) { updateWordInBank({...wordData, consecutiveCorrectAnswers: (wordData.consecutiveCorrectAnswers || 0) + 1, lastTestedDate: new Date().toISOString() }); }
      }
    } else {
      toast({ title: "Есть ошибка", description: evaluation?.evaluation || "Попробуйте еще раз.", variant: "destructive" });
      if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        const wordData = currentVocabulary.find(v => v.german === currentTask);
        if (wordData) { updateWordInBank({...wordData, errorCount: (wordData.errorCount || 0) + 1, consecutiveCorrectAnswers: 0, lastTestedDate: new Date().toISOString() }); }
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
      if (finalScore >= 70) { toast({ title: "Модуль завершен успешно!", description: `Ваш результат: ${finalScore}%`, duration: 5000 }); }
      else { toast({ title: "Модуль завершен", description: `Ваш результат: ${finalScore}%. Попробуйте еще раз для улучшения.`, variant: "destructive", duration: 5000 }); }
    } else { // Logic for moving to next standard task
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest')) {
          const effectiveVocabularyList = currentVocabulary; 
          if (effectiveVocabularyList.length > newTasksCompleted) { setCurrentTask(effectiveVocabularyList[newTasksCompleted].german); }
          else { setIsModuleFinished(true); const finalScoreFallback = Math.round(moduleScore); updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback); setFinalModuleScore(finalScoreFallback); toast({title: "Неожиданное завершение модуля", description: "Задания закончились раньше."}); }
      } else if (moduleId === 'listening' || moduleId === 'reading') {
        const questionsList = moduleId === 'listening' ? lessonContent?.listeningExercise?.questions : lessonContent?.readingQuestions; 
        if (questionsList && questionsList.length > newTasksCompleted) { setCurrentQuestionIndex(newTasksCompleted); setCurrentTask(questionsList[newTasksCompleted]); }
        else { setIsModuleFinished(true); const finalScoreFallback = Math.round(moduleScore); updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback); setFinalModuleScore(finalScoreFallback); toast({title: `Неожиданное завершение модуля (${MODULE_NAMES_RU[moduleId]})`, description: "Вопросы закончились раньше."}); }
      }
    }
  };

  const renderModuleContent = () => {
    if (moduleId === 'vocabulary' && activeMatchingExercise) {
      return (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-center">Сопоставьте немецкие слова с их русскими переводами</h3>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center">
            {/* German Column */}
            <div className="flex flex-col gap-2 w-full md:w-1/2">
              <p className="font-medium text-center text-muted-foreground">Немецкий</p>
              {germanMatchItems.map(item => (
                <Button
                  key={item.id}
                  variant={selectedGermanItemId === item.id ? 'default' : 'outline'}
                  onClick={() => item.matchedId ? handleUnmatchPair(item.id) : handleGermanItemSelect(item.id)}
                  disabled={isMatchingChecked && item.matchedId !== null}
                  className={cn(
                    "w-full justify-start p-3 h-auto text-base",
                    isMatchingChecked && item.matchedId && item.feedback === 'correct' && 'bg-green-100 hover:bg-green-200 border-green-400 text-green-800',
                    isMatchingChecked && item.matchedId && item.feedback === 'incorrect' && 'bg-red-100 hover:bg-red-200 border-red-400 text-red-800',
                    isMatchingChecked && !item.matchedId && item.feedback === 'unmatched' && 'bg-yellow-100 hover:bg-yellow-200 border-yellow-400 text-yellow-800 opacity-70',
                    item.matchedId && !isMatchingChecked && 'bg-blue-100 hover:bg-blue-200 border-blue-300 dark:bg-blue-800/30 dark:border-blue-700 dark:hover:bg-blue-700/40'
                  )}
                >
                  {item.text}
                  {item.matchedId && !isMatchingChecked && <span className="ml-auto text-xs">(Сопоставлено)</span>}
                </Button>
              ))}
            </div>
            {/* Russian Column */}
            <div className="flex flex-col gap-2 w-full md:w-1/2">
              <p className="font-medium text-center text-muted-foreground">Русский</p>
              {russianMatchItems.map(item => (
                <Button
                  key={item.id}
                  variant={item.matchedId ? 'secondary' : 'outline'}
                  onClick={() => handleRussianItemSelect(item.id)}
                  disabled={isMatchingChecked || item.matchedId !== null || !selectedGermanItemId}
                  className={cn(
                    "w-full justify-start p-3 h-auto text-base",
                     isMatchingChecked && item.matchedId && germanMatchItems.find(g => g.id === item.matchedId)?.feedback === 'correct' && 'bg-green-100 hover:bg-green-200 border-green-400 text-green-800',
                     isMatchingChecked && item.matchedId && germanMatchItems.find(g => g.id === item.matchedId)?.feedback === 'incorrect' && 'bg-red-100 hover:bg-red-200 border-red-400 text-red-800',
                     isMatchingChecked && !item.matchedId && item.feedback === 'unmatched' && 'bg-yellow-100 hover:bg-yellow-200 border-yellow-400 text-yellow-800 opacity-70',
                     item.matchedId && !isMatchingChecked && 'bg-blue-100 hover:bg-blue-200 border-blue-300 dark:bg-blue-800/30 dark:border-blue-700 dark:hover:bg-blue-700/40'
                  )}
                >
                  {item.text}
                </Button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Fallback to existing rendering logic for other modules or standard vocabulary
    if (!lessonContent && ( (moduleId !== 'vocabulary' && moduleId !== 'wordTest') || ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary.length === 0) ) ) {
      if (topicName === "Загрузка...") { return <p className="text-center p-4 text-muted-foreground">Загрузка данных темы...</p>; }
      if ( (moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary.length === 0) { return <p className="text-center p-4 text-muted-foreground">Слов для этого модуля не найдено.</p>; }
      return <p className="text-center p-4 text-muted-foreground">Не удалось загрузить содержание модуля. Попробуйте обновить страницу или вернуться назад.</p>;
    }

    switch (moduleId) {
      case 'vocabulary': // Standard vocabulary, if no matching exercise
      case 'wordTest':
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка слова...</p>;
        const wordFromBankOrLesson = currentVocabulary.find(v => v.german === currentTask) || lessonContent?.vocabulary.find(v => v.german === currentTask);
        if (!wordFromBankOrLesson) { toast({ title: "Ошибка отображения слова", description: `Не удалось найти данные для слова "${currentTask}".`, variant: "destructive", duration: 7000 }); return <p className="text-center p-4 text-muted-foreground">Ошибка: не удалось загрузить данные для слова "{currentTask}".</p>; }
        const currentWordData = wordFromBankOrLesson;
        const displayExpectedAnswer = moduleId === 'vocabulary' ? (currentWordData.russian || '...') : '???';
        return (
          <div>
            <p className="text-lg mb-1">{moduleId === 'vocabulary' ? "Слово для изучения:" : "Слово для тестирования:"}</p>
            <div className="flex items-center gap-2 mb-1"><h2 className="text-3xl font-bold font-headline">{currentTask}</h2><Button variant="ghost" size="icon" onClick={() => speak(currentTask, 'de-DE')}><Speaker className="h-6 w-6" /></Button></div>
            {currentWordData.exampleSentence && <p className="text-sm italic text-muted-foreground mb-2">Пример: {currentWordData.exampleSentence}</p>}
            <p className="text-md text-muted-foreground mt-1">Введите перевод на русский {moduleId === 'vocabulary' ? ` (ожидается: ${displayExpectedAnswer})` : ':'}</p>
          </div>);
      case 'grammar': /* ... (existing grammar rendering) ... */  if (!lessonContent?.grammarExplanation) return <p className="text-center p-4 text-muted-foreground">Загрузка грамматики...</p>; return (<div> <h3 className="text-xl font-semibold mb-2">Грамматическое правило:</h3> <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.grammarExplanation.replace(/\n/g, '<br />') }} /> <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt || "Напишите предложение, используя это правило."}</p> </div>);
      case 'listening': /* ... (existing listening rendering) ... */ if (!lessonContent?.listeningExercise || !lessonContent.listeningExercise.script) return <p className="text-center p-4 text-muted-foreground">Загрузка аудирования...</p>; const currentListeningQuestion = lessonContent.listeningExercise.questions?.[currentQuestionIndex]; return (<div> <h3 className="text-xl font-semibold mb-2">Аудирование:</h3> <p className="mb-1">Прослушайте текст:</p> <div className="prose dark:prose-invert max-w-none mb-2 p-3 border rounded-md bg-card-foreground/5 text-sm">{lessonContent.listeningExercise.script}</div> <Button onClick={() => speak(lessonContent.listeningExercise.script, 'de-DE')} className="mb-4"><Speaker className="mr-2 h-4 w-4" /> Прослушать текст</Button> {currentListeningQuestion && ( <p className="text-lg mb-2">Вопрос {currentQuestionIndex + 1}: {currentTask}</p> )} {!currentTask && tasksCompleted < totalTasks && <p className="text-muted-foreground">Загрузка вопроса...</p>} {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы прослушаны.</p>} </div>);
      case 'reading': /* ... (existing reading rendering) ... */ if (!lessonContent?.readingPassage) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>; return (<div> <h3 className="text-xl font-semibold mb-2">Чтение:</h3> <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} /> {currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && ( <p className="text-lg mb-2">Вопрос {currentQuestionIndex + 1}: {currentTask}</p> )} {!currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>} {(!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && tasksCompleted < totalTasks && ( <p className="text-lg mb-2">Вопрос: {currentTask}</p>  )} {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы пройдены.</p>} </div>);
      case 'writing': /* ... (existing writing rendering) ... */ if (!lessonContent?.writingPrompt) return <p className="text-center p-4 text-muted-foreground">Загрузка задания для письма...</p>; return (<div> <h3 className="text-xl font-semibold mb-2">Письмо:</h3> <p className="text-lg mb-2">Задание: {lessonContent.writingPrompt}</p> </div>);
      default: return <p>Тип модуля неизвестен.</p>;
    }
  };

  const moduleTitle = MODULE_NAMES_RU[moduleId] || "Модуль";
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;
  const placeholderText = moduleId === 'wordTest' ? "Введите перевод на русский..." : "Ваш ответ...";

  if (isLoadingTask && topicName === "Загрузка...") { /* ... Skeleton for initial load ... */ return ( <div className="container mx-auto py-8"> <Skeleton className="h-9 w-32 mb-6" />  <Card className="shadow-xl"><CardHeader><Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-4 w-1/2 mb-2" /> </CardHeader><CardContent><Skeleton className="h-24 w-full mb-4" /> </CardContent></Card> </div> ); }
  if (isLoadingTask) { /* ... Skeleton for content load ... */ return ( <div className="container mx-auto py-8"> <Skeleton className="h-9 w-32 mb-6" /> <Card className="shadow-xl"> <CardHeader> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-4 w-1/2 mb-2" />  <Skeleton className="h-2 w-full" />  </CardHeader> <CardContent> <div className="mb-6 min-h-[100px] space-y-3"> <Skeleton className="h-6 w-1/3" /> <Skeleton className="h-10 w-1/2" /> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-3/4" /> </div> <Skeleton className="h-24 w-full mb-4" />  </CardContent> <CardFooter> <Skeleton className="h-12 w-full" />  </CardFooter> </Card> </Skeleton> </div> ); }


  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        Назад к модулям
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{moduleTitle}: {topicName}</CardTitle>
          {!isModuleFinished ? (
            <CardDescription>Уровень {levelId}. 
            {activeMatchingExercise ? " Упражнение на сопоставление." : `Задание ${tasksCompleted + 1} из ${totalTasks}.`}
            </CardDescription>
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
              {moduleId !== 'vocabulary' || !activeMatchingExercise ? ( // Show textarea only for non-matching or other modules
                <Textarea
                  placeholder={placeholderText}
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  className="mb-4 min-h-[100px]"
                  disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                />
              ) : null}
            </>
          ) : ( // Module Finished UI
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
                  <p className="text-muted-foreground mb-4">Ваш результат: {finalModuleScore ?? 0}%. Вы можете попробовать пройти модуль снова.</p>
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
          {feedback && !isModuleFinished && !activeMatchingExercise && ( // Feedback for non-matching exercises
            <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
              <CardContent className="p-4">
                <p className={`font-semibold ${feedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {feedback.isCorrect ? "Верно!" : "Ошибка."}
                </p>
                <p className="text-sm">{feedback.evaluation}</p>
                {feedback.suggestedCorrection && ( <p className="text-sm mt-1">Предлагаемая коррекция: <span className="italic">{feedback.suggestedCorrection}</span></p> )}
                 {feedback.grammarErrorTags && feedback.grammarErrorTags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium">Области грамматики для внимания:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {feedback.grammarErrorTags.map(tag => ( <span key={tag} className="px-2 py-0.5 text-xs bg-rose-200 text-rose-700 dark:bg-rose-700 dark:text-rose-200 rounded-full">{tag}</span> ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
        {!isModuleFinished && (
          <CardFooter>
            {activeMatchingExercise && moduleId === 'vocabulary' && !isMatchingChecked && (
              <Button onClick={handleMatchingCheck} className="w-full" size="lg">
                Проверить сопоставления
              </Button>
            )}
            {(!activeMatchingExercise || moduleId !== 'vocabulary') && (
              <Button 
                onClick={handleSubmit} 
                disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                className="w-full"
                size="lg"
              >
                {isLoadingTask ? "Проверка..." : "Ответить"}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    