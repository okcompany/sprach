
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
import type { 
  LanguageLevel, 
  ModuleType, 
  AILessonContent, 
  AIEvaluationResult, 
  VocabularyWord, 
  AILessonVocabularyItem, 
  AIMatchingExercise,
  AIAudioQuizExercise,
  AIComprehensionMultipleChoiceExercise,
  AITrueFalseExercise,
  AISequencingExercise, 
  DefaultTopicDefinition,
} from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES, ALL_LEVELS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Shuffle, ThumbsUp, ThumbsDown, ListOrdered, Trash2, Info, BookCheck, SearchX, Loader2, DownloadCloud } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


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
  originalText: string; 
  type: 'pair' | 'distractor';
  selected: boolean;
  matchedId: string | null; 
  feedback?: 'correct' | 'incorrect' | 'unmatched';
  isPairTarget?: boolean; 
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
  const [isLoadingTask, setIsLoadingTask] = useState(false); // Initially false, true when fetching
  const [moduleScore, setModuleScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(5); 
  const [currentVocabulary, setCurrentVocabulary] = useState<VocabularyWord[]>([]);
  const [isModuleFinished, setIsModuleFinished] = useState(false);
  const [finalModuleScore, setFinalModuleScore] = useState<number | null>(null);
  
  const [nextSequentialUncompletedModule, setNextSequentialUncompletedModule] = useState<ModuleType | null>(null);
  const [topicContinuationLink, setTopicContinuationLink] = useState<string | null>(null);
  const [topicContinuationText, setTopicContinuationText] = useState<string>('');

  // State for Matching Exercise (Vocabulary)
  const [activeMatchingExercise, setActiveMatchingExercise] = useState<AIMatchingExercise | null>(null);
  const [germanMatchItems, setGermanMatchItems] = useState<MatchItem[]>([]);
  const [russianMatchItems, setRussianMatchItems] = useState<MatchItem[]>([]);
  const [selectedGermanItemId, setSelectedGermanItemId] = useState<string | null>(null);
  const [isMatchingChecked, setIsMatchingChecked] = useState(false);

  // State for Audio Quiz (Vocabulary)
  const [activeAudioQuizExercise, setActiveAudioQuizExercise] = useState<AIAudioQuizExercise | null>(null);
  const [currentAudioQuizItemIndex, setCurrentAudioQuizItemIndex] = useState(0);
  const [selectedAudioQuizOption, setSelectedAudioQuizOption] = useState<string | null>(null);
  const [audioQuizItemFeedback, setAudioQuizItemFeedback] = useState<{ message: string; isCorrect: boolean; correctAnswer?: string, explanation?: string } | null>(null);

  // State for Interactive Listening/Reading/Writing Exercises
  const [activeMCQExercise, setActiveMCQExercise] = useState<AIComprehensionMultipleChoiceExercise | null>(null);
  const [activeTrueFalseExercise, setActiveTrueFalseExercise] = useState<AITrueFalseExercise | null>(null);
  const [activeSequencingExercise, setActiveSequencingExercise] = useState<AISequencingExercise | null>(null);
  // const [activeStructuredWritingExercise, setActiveStructuredWritingExercise] = useState<AIStructuredWritingExercise | null>(null); // Temporarily removed

  const [currentInteractiveQuestionIndex, setCurrentInteractiveQuestionIndex] = useState(0); // Also used for TrueFalse
  const [interactiveExerciseFeedback, setInteractiveExerciseFeedback] = useState<{ message: string; isCorrect: boolean; correctAnswerText?: string, explanation?: string, correctSequence?: string[] } | null>(null);
  
  // MCQ Specific State
  const [selectedMCQOption, setSelectedMCQOption] = useState<string | null>(null);

  // True/False Specific State
  const [selectedTrueFalseAnswer, setSelectedTrueFalseAnswer] = useState<boolean | null>(null);

  // Sequencing Specific State
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [availableSequenceItems, setAvailableSequenceItems] = useState<string[]>([]);
  
  const [noContentForModule, setNoContentForModule] = useState(false);
  const [contentManuallyRequested, setContentManuallyRequested] = useState(false);


  const topicName = useMemo(() => 
    userData?.progress[levelId]?.topics[topicId]?.name || 
    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
    userData?.customTopics.find(t => t.id === topicId)?.name || 
    "Загрузка...",
  [userData, levelId, topicId]);

  const resetInteractiveStates = useCallback(() => {
    setActiveMatchingExercise(null);
    setGermanMatchItems([]);
    setRussianMatchItems([]);
    setSelectedGermanItemId(null);
    setIsMatchingChecked(false);

    setActiveAudioQuizExercise(null);
    setCurrentAudioQuizItemIndex(0);
    setSelectedAudioQuizOption(null);
    setAudioQuizItemFeedback(null);

    setActiveMCQExercise(null);
    setActiveTrueFalseExercise(null);
    setActiveSequencingExercise(null);
    // setActiveStructuredWritingExercise(null); // Temporarily removed

    setCurrentInteractiveQuestionIndex(0);
    setInteractiveExerciseFeedback(null);
    setSelectedMCQOption(null);
    setSelectedTrueFalseAnswer(null);
    setUserSequence([]);
    setAvailableSequenceItems([]);
  }, [ 
    setActiveMatchingExercise, setGermanMatchItems, setRussianMatchItems, setSelectedGermanItemId, setIsMatchingChecked,
    setActiveAudioQuizExercise, setCurrentAudioQuizItemIndex, setSelectedAudioQuizOption, setAudioQuizItemFeedback,
    setActiveMCQExercise, setActiveTrueFalseExercise, setActiveSequencingExercise, /* setActiveStructuredWritingExercise, */
    setCurrentInteractiveQuestionIndex, setInteractiveExerciseFeedback, setSelectedMCQOption,
    setSelectedTrueFalseAnswer, setUserSequence, setAvailableSequenceItems
  ]);

  const fetchLesson = useCallback(async () => {
    if (topicName === "Загрузка...") {
      return;
    }
    
    setIsLoadingTask(true);
    setLessonContent(null); 
    setCurrentTask(null); 
    setFeedback(null); 
    resetInteractiveStates();
    setNoContentForModule(false); 

    let loadedLessonContent: AILessonContent | null = null;
    try {
      loadedLessonContent = await getTopicLessonContent(levelId, topicName);
    } catch (error) {
      console.error("[ModulePage fetchLesson] Error during getTopicLessonContent:", error);
      // loadedLessonContent will remain null, handled by subsequent logic
    }
    
    setLessonContent(loadedLessonContent); 
    let vocabularySourceUsed: 'ai_interactive' | 'ai_list' | 'fallback' | 'bank_only' | 'none' = 'none';
    let wordsToUseForModule: VocabularyWord[] = [];

    if (loadedLessonContent) {
      setNoContentForModule(false); 
      if (moduleId === 'vocabulary') {
        const matchingExercise = loadedLessonContent.interactiveMatchingExercise;
        const audioQuiz = loadedLessonContent.interactiveAudioQuizExercise;

        if (matchingExercise) {
          vocabularySourceUsed = 'ai_interactive';
          setActiveMatchingExercise(matchingExercise);
          setTotalTasks(1); 
          const germanPairs = matchingExercise.pairs.map((p, i) => ({ id: `gp_${i}`, text: p.german, originalText: p.german, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const germanDistractors = (matchingExercise.germanDistractors || []).map((d, i) => ({ id: `gd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setGermanMatchItems(shuffleArray([...germanPairs, ...germanDistractors]));
          const russianPairs = matchingExercise.pairs.map((p, i) => ({ id: `rp_${i}`, text: p.russian, originalText: p.russian, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const russianDistractors = (matchingExercise.russianDistractors || []).map((d, i) => ({ id: `rd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setRussianMatchItems(shuffleArray([...russianPairs, ...russianDistractors]));
        } else if (audioQuiz) {
          vocabularySourceUsed = 'ai_interactive';
          setActiveAudioQuizExercise(audioQuiz);
          setTotalTasks(audioQuiz.items.length);
        } else if (loadedLessonContent.vocabulary && loadedLessonContent.vocabulary.length > 0) {
            vocabularySourceUsed = 'ai_list';
            const aiWordsForCurrentSession: VocabularyWord[] = [];
            loadedLessonContent.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                const wordForBank = { german: vocabItem.german, russian: vocabItem.russian, exampleSentence: vocabItem.exampleSentence, topic: topicId, level: levelId };
                addWordToBank(wordForBank);
                aiWordsForCurrentSession.push({
                    ...wordForBank,
                    id: `${vocabItem.german}-${topicId}-ai-temp-${Date.now()}${Math.random()}`,
                    consecutiveCorrectAnswers: 0, errorCount: 0,
                });
            });
            if (aiWordsForCurrentSession.length > 0) {
                wordsToUseForModule = aiWordsForCurrentSession;
            } else { vocabularySourceUsed = 'none'; }
        } else {
            vocabularySourceUsed = 'none';
        }
      } else if (moduleId === 'wordTest') {
          if (loadedLessonContent.vocabulary && loadedLessonContent.vocabulary.length > 0) {
            vocabularySourceUsed = 'ai_list'; 
            const aiWordsForCurrentSession: VocabularyWord[] = [];
            loadedLessonContent.vocabulary.forEach((vocabItem: AILessonVocabularyItem) => {
                const wordForBank = { german: vocabItem.german, russian: vocabItem.russian, exampleSentence: vocabItem.exampleSentence, topic: topicId, level: levelId };
                addWordToBank(wordForBank);
                aiWordsForCurrentSession.push({
                    ...wordForBank,
                    id: `${vocabItem.german}-${topicId}-ai-test-temp-${Date.now()}${Math.random()}`,
                    consecutiveCorrectAnswers: 0, errorCount: 0,
                });
            });
             if (aiWordsForCurrentSession.length > 0) {
                wordsToUseForModule = aiWordsForCurrentSession;
            } else { vocabularySourceUsed = 'none'; }
          } else {
            vocabularySourceUsed = 'none';
          }
      }
      if (moduleId === 'listening' || moduleId === 'reading') {
        const mcqExercise = moduleId === 'listening' ? loadedLessonContent.interactiveListeningMCQ : loadedLessonContent.interactiveReadingMCQ;
        const trueFalseExercise = moduleId === 'listening' ? loadedLessonContent.interactiveListeningTrueFalse : loadedLessonContent.interactiveReadingTrueFalse;
        const sequencingExercise = moduleId === 'listening' ? loadedLessonContent.interactiveListeningSequencing : loadedLessonContent.interactiveReadingSequencing;

        if (mcqExercise) {
            setActiveMCQExercise(mcqExercise); setTotalTasks(mcqExercise.questions.length);
        } else if (trueFalseExercise) {
            setActiveTrueFalseExercise(trueFalseExercise); setTotalTasks(trueFalseExercise.statements.length);
        } else if (sequencingExercise) {
            setActiveSequencingExercise(sequencingExercise); setAvailableSequenceItems(shuffleArray([...sequencingExercise.shuffledItems])); setUserSequence([]); setTotalTasks(1);
        } else { 
            const questionsList = moduleId === 'listening' ? loadedLessonContent.listeningExercise?.questions : loadedLessonContent.readingQuestions;
            const baseText = moduleId === 'listening' ? loadedLessonContent.listeningExercise?.script : loadedLessonContent.readingPassage;
            if (baseText && questionsList && questionsList.length > 0) { 
                setTotalTasks(questionsList.length); setCurrentTask(questionsList[0]); 
            } else if (baseText) { 
                setCurrentTask("Какова главная идея этого текста?"); setTotalTasks(1); 
            } else { 
                 setNoContentForModule(true); 
            }
        }
      } else if (moduleId === 'writing') {
        // const structuredWritingExercise = loadedLessonContent.interactiveWritingExercise; // Temporarily removed
        // if (structuredWritingExercise) {
        //     setActiveStructuredWritingExercise(structuredWritingExercise); setCurrentTask(structuredWritingExercise.promptDetails); setTotalTasks(1);
        // } else 
        if (loadedLessonContent.writingPrompt) {
            setCurrentTask(loadedLessonContent.writingPrompt); setTotalTasks(1);
        } else {
             setNoContentForModule(true);
        }
      } else if (moduleId === 'grammar') { 
        if (loadedLessonContent.grammarExplanation) {
            setCurrentTask(loadedLessonContent.grammarExplanation); setTotalTasks(1); 
        } else {
            setNoContentForModule(true);
        }
      }
    } 

    if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && wordsToUseForModule.length === 0 && vocabularySourceUsed !== 'ai_interactive') {
        const defaultTopicDef = DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId);
        
        if (defaultTopicDef && defaultTopicDef.fallbackVocabulary && defaultTopicDef.fallbackVocabulary.length > 0) {
            vocabularySourceUsed = 'fallback';
            toast({ title: "AI не предоставил слов", description: `Используем базовый словарный запас для темы "${topicName}".`, variant: "default", duration: 6000 });
            
            const tempFallbackWordsForSession: VocabularyWord[] = [];
            defaultTopicDef.fallbackVocabulary.forEach(item => {
                const wordForBank = { german: item.german, russian: item.russian, exampleSentence: item.exampleSentence, topic: topicId, level: levelId };
                addWordToBank(wordForBank); 
                tempFallbackWordsForSession.push({ 
                    ...wordForBank, 
                    id: `${item.german}-${topicId}-fallback-temp-${Date.now()}${Math.random()}`, 
                    consecutiveCorrectAnswers: 0, errorCount: 0,
                });
            });
            wordsToUseForModule = tempFallbackWordsForSession;
        } else {
            const wordsFromBank = getWordsForTopic(topicId); 
            if (wordsFromBank.length > 0) {
                vocabularySourceUsed = 'bank_only';
                if (!loadedLessonContent) { 
                    toast({ title: "Загрузка AI-контента не удалась", description: "Модуль будет использовать слова из вашего словаря для этой темы.", variant: "default", duration: 6000 });
                }
                wordsToUseForModule = wordsFromBank;
            }
        }
    }
        
    if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && wordsToUseForModule.length > 0) {
        setCurrentVocabulary(wordsToUseForModule);
        setTotalTasks(wordsToUseForModule.length);
        if (wordsToUseForModule[0]) setCurrentTask(wordsToUseForModule[0].german);
        setNoContentForModule(false); 
    } else if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && vocabularySourceUsed !== 'ai_interactive') {
        vocabularySourceUsed = 'none'; 
        setNoContentForModule(true);
    }
    
    if (noContentForModule) { 
        if (vocabularySourceUsed !== 'fallback' && vocabularySourceUsed !== 'bank_only') { 
            if (!loadedLessonContent && (moduleId !== 'vocabulary' && moduleId !== 'wordTest')) {
                toast({ title: "Ошибка загрузки урока", description: `Не удалось получить материалы для модуля "${MODULE_NAMES_RU[moduleId]}". Попробуйте позже.`, variant: "destructive", duration: 7000 });
            } else if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && vocabularySourceUsed === 'none') {
                 toast({ title: "Нет слов для изучения", description: "AI не предоставил слова, и ваш локальный банк слов или резервный список для этой темы пусты.", variant: "default", duration: 7000 });
            } else if (loadedLessonContent) { 
                 toast({ title: `Нет контента для модуля ${MODULE_NAMES_RU[moduleId]}`, description: "AI не смог сгенерировать необходимые материалы для этого модуля.", variant: "default", duration: 7000 });
            }
        }
    }
    
    setIsLoadingTask(false);
  }, [
      levelId, topicId, moduleId, topicName, 
      getTopicLessonContent, addWordToBank, toast, resetInteractiveStates, getWordsForTopic, 
  ]);

  useEffect(() => {
    if (topicName !== "Загрузка..." && contentManuallyRequested) {
         fetchLesson();
    }
  }, [fetchLesson, topicName, contentManuallyRequested]); 
  
 useEffect(() => { 
    setNextSequentialUncompletedModule(null); setTopicContinuationLink(null); setTopicContinuationText('');
    if (isModuleFinished && finalModuleScore !== null && userData?.progress?.[levelId]?.topics?.[topicId]) {
        const topicProgress = userData.progress[levelId]!.topics[topicId]!;
        let nextMod: ModuleType | null = null;
        const currentModuleIndex = ALL_MODULE_TYPES.indexOf(moduleId);

        for (let i = 1; i < ALL_MODULE_TYPES.length; i++) {
            const nextIndex = (currentModuleIndex + i) % ALL_MODULE_TYPES.length;
            const potentialNextModule = ALL_MODULE_TYPES[nextIndex];
            if (!topicProgress.modules[potentialNextModule]?.completed) {
                nextMod = potentialNextModule;
                break;
            }
        }
        setNextSequentialUncompletedModule(nextMod);

        if (nextMod) {
            setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${topicId}/${nextMod}`);
            setTopicContinuationText(`Перейти к модулю "${MODULE_NAMES_RU[nextMod]}"`);
        } else if (isTopicCompleted(levelId, topicId)) {
            if (isLevelCompleted(levelId)) {
                 const currentLvlIdx = ALL_LEVELS.indexOf(levelId);
                 if (currentLvlIdx < ALL_LEVELS.length - 1) {
                     setTopicContinuationLink(`/levels/${ALL_LEVELS[currentLvlIdx+1].toLowerCase()}`);
                     setTopicContinuationText(`Поздравляем! Уровень ${levelId} пройден! Перейти к уровню ${ALL_LEVELS[currentLvlIdx+1]}`);
                 } else {
                     setTopicContinuationLink(`/levels`);
                     setTopicContinuationText(`Поздравляем! Вы прошли все уровни! К списку уровней`);
                 }
            } else {
                setTopicContinuationLink(`/levels/${levelId.toLowerCase()}`);
                setTopicContinuationText(`Поздравляем! Тема завершена! К другим темам уровня ${levelId}`);
            }
        } else {
             setTopicContinuationLink(`/levels/${levelId.toLowerCase()}/${topicId}`);
             setTopicContinuationText(`К другим модулям темы`);
        }
    }
  }, [isModuleFinished, finalModuleScore, userData, levelId, topicId, moduleId, isTopicCompleted, isLevelCompleted, router]);


  const handleRetryModule = () => {
    setIsModuleFinished(false); setFinalModuleScore(null); setTasksCompleted(0); setModuleScore(0); setUserResponse('');
    setNextSequentialUncompletedModule(null); setTopicContinuationLink(null); setTopicContinuationText('');
    setContentManuallyRequested(false); // Reset this so user can click "load" again
    setLessonContent(null); // Clear old content
    // fetchLesson will be called again when contentManuallyRequested is true via button
  };

  const handleRequestContent = () => {
    setContentManuallyRequested(true);
    // fetchLesson will be triggered by the useEffect watching contentManuallyRequested
  };

  // --- Matching Exercise Handlers ---
  const handleGermanItemSelect = (itemId: string) => {
    if (isMatchingChecked) return;
    setGermanMatchItems(prev => prev.map(item => item.id === itemId ? {...item, selected: !item.selected} : {...item, selected: false}));
    setSelectedGermanItemId(prevId => prevId === itemId ? null : itemId);
  };
  
  const handleRussianItemSelect = (russianItemId: string) => {
    if (isMatchingChecked || !selectedGermanItemId) return;
    
    setGermanMatchItems(prevGerman => prevGerman.map(gItem => 
      gItem.id === selectedGermanItemId ? {...gItem, matchedId: russianItemId, selected: false } : gItem
    ));
    setRussianMatchItems(prevRussian => prevRussian.map(rItem => 
      rItem.id === russianItemId ? {...rItem, matchedId: selectedGermanItemId, selected: false } : rItem
    ));
    setSelectedGermanItemId(null);
  };

  const handleUnmatchPair = (germanItemIdToUnmatch: string) => {
    if (isMatchingChecked) return;
    const germanItem = germanMatchItems.find(item => item.id === germanItemIdToUnmatch);
    if (!germanItem || !germanItem.matchedId) return;
    
    const russianItemIdToUnmatch = germanItem.matchedId;
    
    setGermanMatchItems(prev => prev.map(item => 
      item.id === germanItemIdToUnmatch ? {...item, matchedId: null, selected: false, feedback: undefined } : item
    ));
    setRussianMatchItems(prev => prev.map(item => 
      item.id === russianItemIdToUnmatch ? {...item, matchedId: null, selected: false, feedback: undefined } : item
    ));
  };

  const handleMatchingCheck = () => {
    if (!activeMatchingExercise) return;
    setIsLoadingTask(true); 
    setIsMatchingChecked(true);
    let correctMatches = 0;
    const totalPairs = activeMatchingExercise.pairs.length;

    const updatedGermanItems = germanMatchItems.map(gItem => {
        if (!gItem.matchedId) return {...gItem, feedback: gItem.isPairTarget ? 'unmatched' : undefined};
        const rItem = russianMatchItems.find(r => r.id === gItem.matchedId);
        if (!rItem) return {...gItem, feedback: 'incorrect'}; 

        const isCorrectPair = activeMatchingExercise.pairs.some(p => p.german === gItem.originalText && p.russian === rItem.originalText);
        if (isCorrectPair) {
            correctMatches++;
            return {...gItem, feedback: 'correct'};
        }
        return {...gItem, feedback: 'incorrect'};
    });

    const updatedRussianItems = russianMatchItems.map(rItem => {
        if (!rItem.matchedId) return {...rItem, feedback: rItem.isPairTarget ? 'unmatched' : undefined};
        const gItem = germanMatchItems.find(g => g.id === rItem.matchedId);
        if (!gItem) return {...rItem, feedback: 'incorrect'}; 

        const isCorrectPair = activeMatchingExercise.pairs.some(p => p.german === gItem.originalText && p.russian === rItem.originalText);
        return {...rItem, feedback: isCorrectPair ? 'correct' : 'incorrect'};
    });
    
    setGermanMatchItems(updatedGermanItems);
    setRussianMatchItems(updatedRussianItems);

    const score = totalPairs > 0 ? Math.round((correctMatches / totalPairs) * 100) : 0;
    setModuleScore(score);
    updateModuleProgress(levelId, topicId, moduleId, score);
    setFinalModuleScore(score);
    setTasksCompleted(1);
    setIsModuleFinished(true);
    toast({ title: "Сопоставление завершено!", description: `Ваш результат: ${score}%. Найдено ${correctMatches} из ${totalPairs} пар.`, duration: 7000 });
    setIsLoadingTask(false);
  };


  // --- Audio Quiz Handlers ---
  const handleSelectAudioQuizOption = (option: string) => {
    if (audioQuizItemFeedback) return; 
    setSelectedAudioQuizOption(option);
  };

  const handleSubmitAudioQuizAnswer = () => {
    if (!activeAudioQuizExercise || !selectedAudioQuizOption || audioQuizItemFeedback) return;
    setIsLoadingTask(true);
    const currentItem = activeAudioQuizExercise.items[currentAudioQuizItemIndex];
    const isCorrect = selectedAudioQuizOption === currentItem.correctAnswer;
    let scoreIncrement = 0;

    if (isCorrect) {
      scoreIncrement = (100 / totalTasks);
      setModuleScore(prev => prev + scoreIncrement);
      setAudioQuizItemFeedback({ message: "Правильно!", isCorrect: true, explanation: currentItem.explanation });
      toast({ title: "Верно!", variant: "default" });
    } else {
      setAudioQuizItemFeedback({ message: `Неверно. Правильный ответ: ${currentItem.correctAnswer}`, isCorrect: false, correctAnswer: currentItem.correctAnswer, explanation: currentItem.explanation });
      toast({ title: "Ошибка", description: `Правильный ответ: ${currentItem.correctAnswer}`, variant: "destructive" });
    }
    setIsLoadingTask(false);
  };

  const handleNextAudioQuizItem = () => {
    setAudioQuizItemFeedback(null);
    setSelectedAudioQuizOption(null);
    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) {
      const finalScore = Math.round(moduleScore);
      updateModuleProgress(levelId, topicId, moduleId, finalScore);
      setFinalModuleScore(finalScore);
      setIsModuleFinished(true);
      toast({ title: "Аудио-квиз завершен!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
    } else {
      setCurrentAudioQuizItemIndex(prev => prev + 1);
    }
  };
  
  // --- MCQ Handlers (Listening/Reading) ---
  const handleSelectMCQOption = (option: string) => {
    if (interactiveExerciseFeedback) return;
    setSelectedMCQOption(option);
  };

  const handleSubmitMCQAnswer = () => {
    if (!activeMCQExercise || !selectedMCQOption || interactiveExerciseFeedback) return;
    setIsLoadingTask(true);
    const currentQuestion = activeMCQExercise.questions[currentInteractiveQuestionIndex];
    const isCorrect = selectedMCQOption === currentQuestion.correctAnswer;
    let scoreIncrement = 0;

    if (isCorrect) {
      scoreIncrement = (100 / totalTasks);
      setModuleScore(prev => prev + scoreIncrement);
      setInteractiveExerciseFeedback({ message: "Правильно!", isCorrect: true, explanation: currentQuestion.explanation });
    } else {
      setInteractiveExerciseFeedback({ message: `Неверно. Правильный ответ: ${currentQuestion.correctAnswer}`, isCorrect: false, correctAnswerText: currentQuestion.correctAnswer, explanation: currentQuestion.explanation });
    }
    setIsLoadingTask(false);
  };

  // --- True/False Handlers (Listening/Reading) ---
  const handleSelectTrueFalseAnswer = (answer: boolean) => {
    if (interactiveExerciseFeedback) return;
    setSelectedTrueFalseAnswer(answer);
  };

  const handleSubmitTrueFalseAnswer = () => {
    if (!activeTrueFalseExercise || selectedTrueFalseAnswer === null || interactiveExerciseFeedback) return;
    setIsLoadingTask(true);
    const currentStatement = activeTrueFalseExercise.statements[currentInteractiveQuestionIndex];
    const isCorrect = selectedTrueFalseAnswer === currentStatement.isTrue;
    let scoreIncrement = 0;

    if (isCorrect) {
      scoreIncrement = (100 / totalTasks);
      setModuleScore(prev => prev + scoreIncrement);
      setInteractiveExerciseFeedback({ message: "Правильно!", isCorrect: true, explanation: currentStatement.explanation });
    } else {
      setInteractiveExerciseFeedback({ 
        message: `Неверно. ${currentStatement.isTrue ? "Это утверждение было верным." : "Это утверждение было ложным."}`, 
        isCorrect: false, 
        correctAnswerText: currentStatement.isTrue ? "Верно" : "Неверно",
        explanation: currentStatement.explanation 
      });
    }
    setIsLoadingTask(false);
  };
  
  // --- Sequencing Handlers (Listening/Reading) ---
  const handleSelectSequenceItem = (itemText: string) => {
    if (interactiveExerciseFeedback) return;
    setUserSequence(prev => [...prev, itemText]);
    setAvailableSequenceItems(prev => prev.filter(item => item !== itemText));
  };

  const handleRemoveFromSequence = (itemText: string, index: number) => {
    if (interactiveExerciseFeedback) return;
    setUserSequence(prev => prev.filter((_, i) => i !== index));
    setAvailableSequenceItems(prev => [...prev, itemText].sort(() => Math.random() - 0.5));
  };
  
  const handleResetSequence = () => {
    if (interactiveExerciseFeedback) return; 
    if (activeSequencingExercise) {
      setUserSequence([]);
      setAvailableSequenceItems(shuffleArray([...activeSequencingExercise.shuffledItems]));
    }
  };

  const handleCheckSequence = () => {
    if (!activeSequencingExercise || interactiveExerciseFeedback) return;
    setIsLoadingTask(true);
    const correctOrder = activeSequencingExercise.correctOrder;
    const isCorrect = userSequence.length === correctOrder.length && userSequence.every((item, index) => item === correctOrder[index]);
    
    let scoreIncrement = 0;
    if (isCorrect) {
      scoreIncrement = 100; 
      setModuleScore(prev => prev + scoreIncrement); 
      setInteractiveExerciseFeedback({ message: "Правильно! Последовательность верная.", isCorrect: true });
    } else {
      setInteractiveExerciseFeedback({ 
        message: "Неверно. Порядок неправильный.", 
        isCorrect: false, 
        correctSequence: correctOrder 
      });
    }
    
    const finalScore = Math.round(scoreIncrement); 
    updateModuleProgress(levelId, topicId, moduleId, finalScore);
    setFinalModuleScore(finalScore);
    setIsModuleFinished(true);
    setTasksCompleted(1); 
    toast({ title: "Упражнение на упорядочивание завершено!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
    setIsLoadingTask(false);
  };

  // --- Common Handler for Next Interactive Item (MCQ, True/False) ---
  const handleNextInteractiveItem = () => {
    setInteractiveExerciseFeedback(null);
    setSelectedMCQOption(null); 
    setSelectedTrueFalseAnswer(null); 

    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) {
      const finalScore = Math.round(moduleScore);
      updateModuleProgress(levelId, topicId, moduleId, finalScore);
      setFinalModuleScore(finalScore);
      setIsModuleFinished(true);
      toast({ title: "Упражнение завершено!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
    } else {
      setCurrentInteractiveQuestionIndex(prev => prev + 1);
    }
  };

  // --- Standard (Non-Interactive) Task Submission ---
  const handleSubmit = async () => { 
    if (!currentTask /* && !(activeStructuredWritingExercise) */ ) return; // activeStructuredWritingExercise temporarily removed
    if (isModuleFinished || activeMatchingExercise || activeAudioQuizExercise || activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise || noContentForModule) return;

    setIsLoadingTask(true); setFeedback(null);
    let questionContext = ''; let expectedAnswerForAI = ''; let grammarRulesForAI: string | undefined = undefined;
    
    if (moduleId === 'vocabulary' || moduleId === 'wordTest') { 
        const currentWord = currentVocabulary.find(v => v.german === currentTask) || lessonContent?.vocabulary.find(v => v.german === currentTask);
        if (!currentWord) { toast({ title: "Ошибка данных урока", description: "Не найдено текущее слово для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
        questionContext = `Пользователя попросили перевести слово "${currentWord.german}" на русский.`;
        expectedAnswerForAI = currentWord.russian;
    } 
    else if (moduleId === 'grammar') { 
        questionContext = `Пользователя попросили ответить на вопрос или выполнить задание, связанное с грамматическим объяснением: "${currentTask}".`;
        grammarRulesForAI = lessonContent?.grammarExplanation;
    }
    else if (moduleId === 'listening') {  
        if (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[tasksCompleted]) { 
            questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[tasksCompleted]}"`; 
        } else { 
            toast({ title: "Ошибка данных урока", description: "Нет данных для аудирования для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; 
        } 
    }
    else if (moduleId === 'reading') { 
        if (lessonContent?.readingPassage && lessonContent.readingQuestions && lessonContent.readingQuestions[tasksCompleted]) { 
            questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${lessonContent.readingQuestions[tasksCompleted]}"`; 
        } else if (lessonContent?.readingPassage) { 
            questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${currentTask}"`; 
        } else { 
            toast({ title: "Ошибка данных урока", description: "Нет данных для чтения для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; 
        } 
    }
    else if (moduleId === 'writing') { 
        // if (activeStructuredWritingExercise) { // Temporarily removed
        //     const exercise = activeStructuredWritingExercise;
        //     let detailedContext = `Task Type: Structured Writing. Instructions: ${exercise.instructions}. Prompt: ${exercise.promptDetails}.`;
        //     if (exercise.aiGeneratedStoryToDescribe) {
        //         detailedContext += ` Story to describe: "${exercise.aiGeneratedStoryToDescribe}".`;
        //     }
        //     if (exercise.templateOutline && exercise.templateOutline.length > 0) {
        //         detailedContext += ` Template/Outline: ${exercise.templateOutline.join(', ')}.`;
        //     }
        //     if (exercise.requiredVocabulary && exercise.requiredVocabulary.length > 0) {
        //         detailedContext += ` Required vocabulary: ${exercise.requiredVocabulary.join(', ')}.`;
        //     }
        //     questionContext = detailedContext;
        // } else {
            questionContext = `Пользователя попросили написать текст на тему: "${currentTask}".`;
        // }
    }
    
    const evaluation = await evaluateUserResponse(levelId, topicId, moduleId, userResponse, questionContext, expectedAnswerForAI, grammarRulesForAI);
    if (!evaluation) { 
        toast({ title: "Ошибка оценки ответа", description: "Не удалось получить оценку от AI. Попробуйте еще раз.", variant: "destructive" }); 
        setIsLoadingTask(false); 
        return;  
    }
    setFeedback(evaluation); 
    
    let scoreIncrement = 0;
    if (evaluation?.isCorrect) { 
        scoreIncrement = (100 / totalTasks);
        setModuleScore(prev => prev + scoreIncrement);
        if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
          const wordToUpdate = currentVocabulary.find(v => v.german === currentTask);
          if (wordToUpdate) { updateWordInBank({...wordToUpdate, consecutiveCorrectAnswers: (wordToUpdate.consecutiveCorrectAnswers || 0) + 1, errorCount: Math.max(0, (wordToUpdate.errorCount || 0) -1), lastTestedDate: new Date().toISOString()}); }
        }
    } else { 
        if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
          const wordToUpdate = currentVocabulary.find(v => v.german === currentTask);
          if (wordToUpdate) { updateWordInBank({...wordToUpdate, consecutiveCorrectAnswers: 0, errorCount: (wordToUpdate.errorCount || 0) + 1, lastTestedDate: new Date().toISOString()}); }
        }
    }
    setUserResponse(''); 
    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) { 
        const finalScore = Math.round(moduleScore);
        updateModuleProgress(levelId, topicId, moduleId, finalScore);
        setFinalModuleScore(finalScore);
        setIsModuleFinished(true);
        toast({title: `Модуль "${MODULE_NAMES_RU[moduleId]}" завершен!`, description: `Ваш результат: ${finalScore}%.`, duration: 5000});
    } 
    else { 
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary[newTasksCompleted]) { setCurrentTask(currentVocabulary[newTasksCompleted].german); } 
      else if (moduleId === 'listening' || moduleId === 'reading') {
        const questionsList = moduleId === 'listening' ? lessonContent?.listeningExercise?.questions : lessonContent?.readingQuestions; 
        if (questionsList && questionsList.length > newTasksCompleted) { setCurrentTask(questionsList[newTasksCompleted]); }
        else { setIsModuleFinished(true); const finalScoreFallback = Math.round(moduleScore); updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback); setFinalModuleScore(finalScoreFallback); toast({title: `Неожиданное завершение модуля (${MODULE_NAMES_RU[moduleId]})`, description: "Вопросы закончились раньше."}); }
      }
    }
    setIsLoadingTask(false);
  };

  const renderModuleContent = () => {
    if (!contentManuallyRequested && !lessonContent && !isLoadingTask && !noContentForModule) {
      return (
        <div className="text-center p-6">
          <DownloadCloud className="h-16 w-16 mx-auto mb-4 text-primary/70" />
          <h3 className="text-xl font-semibold mb-3">Материалы модуля еще не загружены</h3>
          <p className="text-muted-foreground mb-6">Нажмите кнопку ниже, чтобы ИИ сгенерировал для вас урок.</p>
          <Button onClick={handleRequestContent} size="lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ display: isLoadingTask ? 'inline-block' : 'none' }} />
            {isLoadingTask ? "Загрузка..." : "Загрузить материалы модуля"}
          </Button>
        </div>
      );
    }

    if (isLoadingTask && !lessonContent) { // Shows skeleton/loader only if content is being fetched for the first time by request
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-1/2" />
            </div>
        );
    }
    
    if (noContentForModule) {
        return (
            <div className="text-center p-6 text-muted-foreground">
                <SearchX className="h-16 w-16 mx-auto mb-4 text-primary/50" />
                <h3 className="text-xl font-semibold mb-2">Контент для модуля не найден</h3>
                <p className="text-sm mb-1">
                    К сожалению, для модуля "{MODULE_NAMES_RU[moduleId]}" по теме "{topicName}" сейчас нет доступных материалов.
                </p>
                <p className="text-sm">
                    Это могло произойти, если AI не смог сгенерировать урок, или если для этой темы еще не были добавлены слова в ваш словарь, либо произошла ошибка при загрузке.
                </p>
                 <Button onClick={handleRequestContent} variant="outline" className="mt-6" disabled={isLoadingTask}>
                    {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    {isLoadingTask ? "Загрузка..." : "Попробовать загрузить снова"}
                </Button>
            </div>
        );
    }
    // --- Vocabulary: Matching Exercise ---
    if (moduleId === 'vocabulary' && activeMatchingExercise) {
       return (
        <div>
          <h3 className="text-xl font-semibold mb-2 text-center">{activeMatchingExercise.instructions}</h3>
          <p className="text-center text-muted-foreground mb-6">Сопоставьте немецкие слова/фразы с их русскими переводами.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-lg mb-3 text-center">Немецкий</h4>
              <div className="space-y-2">
                {germanMatchItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Button
                      variant={selectedGermanItemId === item.id ? 'default' : (item.matchedId ? (item.feedback === 'correct' ? 'secondary' : (item.feedback === 'incorrect' ? 'destructive' : 'outline')) : 'outline')}
                      className={cn(
                          "w-full justify-start p-3 h-auto text-base",
                          item.feedback === 'correct' && isMatchingChecked && "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400",
                          item.feedback === 'incorrect' && isMatchingChecked && "bg-red-500/20 border-red-500 text-red-700 dark:text-red-400 line-through",
                          item.feedback === 'unmatched' && isMatchingChecked && "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400",
                          item.matchedId && !isMatchingChecked && "bg-primary/10"
                      )}
                      onClick={() => handleGermanItemSelect(item.id)}
                      disabled={isMatchingChecked || (item.matchedId !== null)}
                    >
                      {item.text}
                    </Button>
                    {item.matchedId && !isMatchingChecked && (
                      <Button variant="ghost" size="icon" onClick={() => handleUnmatchPair(item.id)} className="h-8 w-8 shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive/70" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-lg mb-3 text-center">Русский</h4>
              <div className="space-y-2">
                {russianMatchItems.map(item => (
                  <Button
                    key={item.id}
                    variant={item.matchedId ? (item.feedback === 'correct' ? 'secondary' : (item.feedback === 'incorrect' ? 'destructive' : 'outline')) : 'outline'}
                     className={cn(
                        "w-full justify-start p-3 h-auto text-base",
                        item.feedback === 'correct' && isMatchingChecked && "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400",
                        item.feedback === 'incorrect' && isMatchingChecked && "bg-red-500/20 border-red-500 text-red-700 dark:text-red-400 line-through",
                        item.feedback === 'unmatched' && isMatchingChecked && "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400",
                        item.matchedId && !isMatchingChecked && "bg-primary/10"
                    )}
                    onClick={() => handleRussianItemSelect(item.id)}
                    disabled={isMatchingChecked || item.matchedId !== null || !selectedGermanItemId}
                  >
                    {item.text}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    // --- Vocabulary: Audio Quiz ---
    if (moduleId === 'vocabulary' && activeAudioQuizExercise) {
      const currentItem = activeAudioQuizExercise.items[currentAudioQuizItemIndex];
      return (
        <div>
          <h3 className="text-xl font-semibold mb-2 text-center">{activeAudioQuizExercise.instructions}</h3>
          <p className="text-center text-muted-foreground mb-4">Задание {currentAudioQuizItemIndex + 1} из {totalTasks}</p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Button variant="outline" size="lg" onClick={() => speak(currentItem.germanPhraseToSpeak, 'de-DE')}>
              <Speaker className="mr-2 h-5 w-5" /> Прослушать фразу
            </Button>
          </div>
          <div className="space-y-3 mb-6">
            {currentItem.options.map((option, index) => (
              <Button
                key={index}
                variant={selectedAudioQuizOption === option ? "default" : "outline"}
                className="w-full justify-start p-4 h-auto text-base"
                onClick={() => handleSelectAudioQuizOption(option)}
                disabled={!!audioQuizItemFeedback || isLoadingTask}
              >
                {option}
              </Button>
            ))}
          </div>
          {audioQuizItemFeedback && (
            <Card className={`mb-4 ${audioQuizItemFeedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
              <CardContent className="p-4">
                <p className={`font-semibold ${audioQuizItemFeedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {audioQuizItemFeedback.message}
                </p>
                {audioQuizItemFeedback.explanation && <p className="text-sm mt-1 text-muted-foreground">Пояснение: {audioQuizItemFeedback.explanation}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      );
    }
    // --- Listening/Reading: Interactive Exercises ---
    const currentInteractiveExercise = activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise;
    if ((moduleId === 'listening' || moduleId === 'reading') && currentInteractiveExercise) {
        const baseText = moduleId === 'listening' ? lessonContent?.listeningExercise?.script : lessonContent?.readingPassage;
        return (
            <div>
                <h3 className="text-xl font-semibold mb-2">{currentInteractiveExercise.instructions}</h3>
                 <p className="text-center text-muted-foreground mb-4">
                    {currentInteractiveExercise.type === 'sequencing' ? `Упорядочите ${ (currentInteractiveExercise as AISequencingExercise).shuffledItems.length} элементов.` : `Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}`}
                 </p>
                
                {baseText && (
                    <Card className="mb-6 bg-muted/30">
                        <CardHeader><CardTitle className="text-base">Контекст</CardTitle></CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none text-sm max-h-48 overflow-y-auto">
                            {moduleId === 'listening' ? (
                                <>
                                 <p>{baseText}</p>
                                 <Button variant="link" onClick={() => speak(baseText, 'de-DE')} className="p-0 h-auto text-sm">
                                    <Speaker className="mr-1 h-4 w-4" /> Прослушать снова
                                </Button>
                                </>
                            ) : (
                                <p>{baseText}</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* MCQ Rendering */}
                {activeMCQExercise && activeMCQExercise.type === 'comprehensionMultipleChoice' && (() => {
                    const currentQuestion = activeMCQExercise.questions[currentInteractiveQuestionIndex];
                    if (!currentQuestion) return <p>Ошибка: вопрос не найден.</p>;
                    return (
                        <div className="space-y-3 mb-6">
                            <p className="font-medium text-lg">{currentQuestion.questionText}</p>
                            {currentQuestion.options.map((option, index) => (
                                <Button
                                    key={index}
                                    variant={selectedMCQOption === option ? "default" : "outline"}
                                    className="w-full justify-start p-4 h-auto text-base"
                                    onClick={() => handleSelectMCQOption(option)}
                                    disabled={!!interactiveExerciseFeedback || isLoadingTask}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    );
                })()}

                {/* True/False Rendering */}
                {activeTrueFalseExercise && activeTrueFalseExercise.type === 'trueFalse' && (() => {
                    const currentStatement = activeTrueFalseExercise.statements[currentInteractiveQuestionIndex];
                    if (!currentStatement) return <p>Ошибка: утверждение не найдено.</p>;
                    return (
                        <div className="space-y-3 mb-6">
                            <p className="font-medium text-lg mb-4 text-center p-3 border rounded-md bg-card-foreground/5">{currentStatement.statement}</p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    variant={selectedTrueFalseAnswer === true ? "default" : "outline"}
                                    className="p-4 h-auto text-base min-w-[120px]"
                                    onClick={() => handleSelectTrueFalseAnswer(true)}
                                    disabled={!!interactiveExerciseFeedback || isLoadingTask}
                                >
                                    <ThumbsUp className="mr-2 h-5 w-5"/> Верно
                                </Button>
                                <Button
                                    variant={selectedTrueFalseAnswer === false ? (interactiveExerciseFeedback && !interactiveExerciseFeedback.isCorrect ? "destructive" : "default") : "outline"}
                                    className="p-4 h-auto text-base min-w-[120px]"
                                    onClick={() => handleSelectTrueFalseAnswer(false)}
                                    disabled={!!interactiveExerciseFeedback || isLoadingTask}
                                >
                                     <ThumbsDown className="mr-2 h-5 w-5"/> Неверно
                                </Button>
                            </div>
                        </div>
                    );
                })()}
                
                {/* Sequencing Rendering */}
                {activeSequencingExercise && activeSequencingExercise.type === 'sequencing' && (() => {
                    return (
                        <div className="space-y-6 mb-6">
                            <div>
                                <h4 className="font-medium text-md mb-2">Доступные элементы для порядка:</h4>
                                {availableSequenceItems.length === 0 && !interactiveExerciseFeedback && <p className="text-sm text-muted-foreground">Все элементы добавлены в вашу последовательность.</p>}
                                <div className="flex flex-wrap gap-2">
                                    {availableSequenceItems.map((item, index) => (
                                        <Button 
                                            key={`avail-${index}`} 
                                            variant="outline"
                                            onClick={() => handleSelectSequenceItem(item)}
                                            disabled={!!interactiveExerciseFeedback || isLoadingTask}
                                            className="text-sm"
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-medium text-md">Ваша последовательность:</h4>
                                    <Button variant="ghost" size="sm" onClick={handleResetSequence} disabled={!!interactiveExerciseFeedback || userSequence.length === 0 || isLoadingTask}>
                                        <RotateCcw className="mr-1 h-3 w-3" /> Сбросить
                                    </Button>
                                </div>
                                {userSequence.length === 0 && <p className="text-sm text-muted-foreground">Начните выбирать элементы из списка выше.</p>}
                                <ol className="list-decimal list-inside space-y-2 pl-2">
                                    {userSequence.map((item, index) => (
                                        <li key={`user-${index}`} className="text-sm p-2 border rounded-md bg-muted/20 flex justify-between items-center">
                                            <span>{item}</span>
                                            {!interactiveExerciseFeedback && !isLoadingTask && (
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveFromSequence(item, index)} className="h-6 w-6">
                                                    <Trash2 className="h-4 w-4 text-destructive/70"/>
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    );
                })()}

                {interactiveExerciseFeedback && (
                    <Card className={`mb-4 ${interactiveExerciseFeedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                        <CardContent className="p-4">
                            <p className={`font-semibold ${interactiveExerciseFeedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {interactiveExerciseFeedback.message}
                            </p>
                            {interactiveExerciseFeedback.explanation && <p className="text-sm mt-1 text-muted-foreground">Пояснение: {interactiveExerciseFeedback.explanation}</p>}
                            {interactiveExerciseFeedback.correctSequence && !interactiveExerciseFeedback.isCorrect && (
                                <div className="mt-2">
                                    <p className="text-sm font-medium text-muted-foreground">Правильная последовательность:</p>
                                    <ol className="list-decimal list-inside text-sm text-muted-foreground">
                                        {interactiveExerciseFeedback.correctSequence.map((item, idx) => <li key={`corr-${idx}`}>{item}</li>)}
                                    </ol>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // --- Fallback to Standard Vocabulary / Other Modules (Non-interactive or not yet implemented interactive) ---
    if (!lessonContent && ( (moduleId !== 'vocabulary' && moduleId !== 'wordTest') || ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary.length === 0) ) ) { return <p className="text-center p-4 text-muted-foreground">Загрузка данных урока...</p>; }
    
    switch (moduleId) {
      case 'vocabulary': 
      case 'wordTest': { 
        if (currentVocabulary.length === 0 && !(lessonContent?.vocabulary && lessonContent.vocabulary.length > 0) && !activeMatchingExercise && !activeAudioQuizExercise) return <p className="text-center p-4 text-muted-foreground">Слов для изучения/теста не найдено.</p>;
        const word = currentVocabulary.find(v => v.german === currentTask) || lessonContent?.vocabulary.find(v => v.german === currentTask);
        if (!word) return <p className="text-center p-4 text-muted-foreground">Ошибка: Слово не найдено.</p>;
        return (
            <div>
                <h3 className="text-2xl font-semibold mb-2 text-center">
                {moduleId === 'vocabulary' ? "Изучение слова:" : "Тест по слову:"} <span className="font-mono">{word.german}</span>
                </h3>
                {word.exampleSentence && <p className="text-sm italic text-muted-foreground text-center mb-4">Пример: {word.exampleSentence}</p>}
                <p className="text-center text-muted-foreground mb-1">Введите перевод на русский:</p>
            </div>
        ); 
      }
      case 'grammar': { 
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка грамматического материала...</p>;
        return (
            <div>
                <h3 className="text-xl font-semibold mb-3">Грамматика:</h3>
                <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: currentTask.replace(/\n/g, '<br />') }} />
                <p className="text-lg mb-2">Практическое задание: Напишите пример или выполните задание, используя это правило.</p>
            </div>
        ); 
      }
      case 'listening': { 
        if (!lessonContent?.listeningExercise || !lessonContent.listeningExercise.script) return <p className="text-center p-4 text-muted-foreground">Загрузка аудирования...</p>; 
        const currentListeningQuestion = lessonContent.listeningExercise.questions?.[tasksCompleted]; 
        return (
            <div> 
                <h3 className="text-xl font-semibold mb-2">Аудирование:</h3> 
                <p className="mb-1">Прослушайте текст:</p> 
                <div className="prose dark:prose-invert max-w-none mb-2 p-3 border rounded-md bg-card-foreground/5 text-sm">{lessonContent.listeningExercise.script}</div> 
                <Button onClick={() => speak(lessonContent.listeningExercise.script, 'de-DE')} className="mb-4"><Speaker className="mr-2 h-4 w-4" /> Прослушать текст</Button> 
                {currentListeningQuestion && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )} 
                {!currentTask && tasksCompleted < totalTasks && <p className="text-muted-foreground">Загрузка вопроса...</p>} 
                {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы прослушаны.</p>} 
            </div>
        ); 
      }
      case 'reading': { 
        if (!lessonContent?.readingPassage) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>; 
        return (
            <div> 
                <h3 className="text-xl font-semibold mb-2">Чтение:</h3> 
                <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} /> 
                {currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )} 
                {!currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>} 
                {(!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && tasksCompleted < totalTasks && ( <p className="text-lg mb-2">Вопрос: {currentTask}</p>  )} 
                {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы пройдены.</p>} 
            </div>
        ); 
      }
      case 'writing': {
        // if (activeStructuredWritingExercise) { // Temporarily removed
        //     const exercise = activeStructuredWritingExercise;
        //     return (
        //         <div>
        //             <h3 className="text-xl font-semibold mb-1">{exercise.instructions || "Письменное задание"}</h3>
        //             <p className="text-muted-foreground mb-4">{exercise.promptDetails}</p>

        //             {exercise.aiGeneratedStoryToDescribe && (
        //                 <Card className="mb-4 bg-muted/40">
        //                     <CardHeader><CardTitle className="text-base font-medium">Опишите следующую историю:</CardTitle></CardHeader>
        //                     <CardContent className="text-sm prose dark:prose-invert max-w-none">
        //                         <p>{exercise.aiGeneratedStoryToDescribe}</p>
        //                     </CardContent>
        //                 </Card>
        //             )}
        //             {exercise.templateOutline && exercise.templateOutline.length > 0 && (
        //                 <div className="mb-4 p-3 border rounded-md bg-card-foreground/5">
        //                     <p className="text-sm font-medium mb-1 text-primary">План / Шаблон:</p>
        //                     <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
        //                         {exercise.templateOutline.map((item, idx) => <li key={`outline-${idx}`}>{item}</li>)}
        //                     </ul>
        //                 </div>
        //             )}
        //             {exercise.requiredVocabulary && exercise.requiredVocabulary.length > 0 && (
        //                  <div className="mb-4">
        //                     <p className="text-sm font-medium mb-1.5 text-primary">Используйте эти слова/фразы:</p>
        //                     <div className="flex flex-wrap gap-2">
        //                         {exercise.requiredVocabulary.map((vocab, idx) => <Badge key={`vocab-${idx}`} variant="secondary">{vocab}</Badge>)}
        //                     </div>
        //                 </div>
        //             )}
        //              <p className="text-muted-foreground mb-1 mt-3">Ваш текст:</p>
        //         </div>
        //     );
        // }
        // Fallback to general writing prompt
        if (!currentTask) return <p className="text-center p-4 text-muted-foreground">Загрузка письменного задания...</p>;
        return (
            <div>
                <h3 className="text-xl font-semibold mb-2">Письмо:</h3>
                <p className="text-lg mb-3">{currentTask}</p>
                <p className="text-muted-foreground mb-1">Ваш текст:</p>
            </div>
        );
      }
      default: return <p>Тип модуля неизвестен.</p>;
    }
  };

  const moduleTitle = MODULE_NAMES_RU[moduleId] || "Модуль";
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;
  let placeholderText = "Ваш ответ...";
  if (moduleId === 'wordTest') placeholderText = "Введите перевод на русский...";
  const activeInteractiveExercise = activeMatchingExercise || activeAudioQuizExercise || activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise /* || activeStructuredWritingExercise */; // activeStructuredWritingExercise temp removed
  if (activeInteractiveExercise || noContentForModule || !contentManuallyRequested) placeholderText = ""; 

  if (isLoadingTask && topicName === "Загрузка...") { 
      return (
        <div className="container mx-auto py-8">
            <Skeleton className="h-8 w-40 mb-6" />
            <Card className="shadow-xl">
                <CardHeader>
                    <Skeleton className="h-7 w-3/4 mb-1" />
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <Skeleton className="h-2 w-full" />
                </CardHeader>
                <CardContent className="min-h-[200px]">
                    <Skeleton className="h-6 w-1/2 mb-4" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-12 w-full" />
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
          <CardTitle className="font-headline text-2xl flex items-center">
            {activeSequencingExercise && <ListOrdered className="mr-2 h-6 w-6 text-primary"/>}
            {activeMCQExercise && <BookCheck className="mr-2 h-6 w-6 text-primary"/>}
            {activeTrueFalseExercise && <ThumbsUp className="mr-2 h-6 w-6 text-primary"/>}
            {/* {activeStructuredWritingExercise && <Info className="mr-2 h-6 w-6 text-primary"/>} */}
            {activeAudioQuizExercise && <Speaker className="mr-2 h-6 w-6 text-primary"/>}
            {activeMatchingExercise && <Shuffle className="mr-2 h-6 w-6 text-primary"/>}
            {!contentManuallyRequested && !isLoadingTask && <DownloadCloud className="mr-2 h-6 w-6 text-primary/70" />}
            {noContentForModule && !isLoadingTask && contentManuallyRequested && <SearchX className="mr-2 h-6 w-6 text-destructive"/>}
            {isLoadingTask && contentManuallyRequested && <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />}
            {moduleTitle}: {topicName}
          </CardTitle>
          {!isModuleFinished && !noContentForModule && contentManuallyRequested ? (
            <CardDescription>Уровень {levelId}. 
            {activeMatchingExercise ? " Упражнение на сопоставление." : 
             activeAudioQuizExercise ? `Аудио-квиз: Задание ${currentAudioQuizItemIndex + 1} из ${totalTasks}.` :
             (activeMCQExercise || activeTrueFalseExercise) ? `Интерактивное упражнение: Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}.` :
             activeSequencingExercise ? `Интерактивное упражнение: Упорядочите элементы.` :
            //  activeStructuredWritingExercise ? `Структурированное письменное задание.` :
              (currentVocabulary.length > 0 || (lessonContent?.vocabulary && lessonContent.vocabulary.length > 0) || (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions.length > 0) || lessonContent?.readingQuestions.length > 0 || lessonContent?.grammarExplanation || lessonContent?.writingPrompt) ? `Задание ${tasksCompleted + 1} из ${totalTasks}.` : "Загрузка задания..."}
            </CardDescription>
          ) : noContentForModule && !isLoadingTask && contentManuallyRequested ? (
             <CardDescription>Уровень {levelId}. Нет доступного контента для этого модуля.</CardDescription>
          ) : isModuleFinished ? (
            <CardDescription>Уровень {levelId}. Модуль завершен. Ваш результат: {finalModuleScore}%</CardDescription>
          ) : !contentManuallyRequested ? (
            <CardDescription>Уровень {levelId}. Загрузите материалы, чтобы начать.</CardDescription>
          ): (
             <CardDescription>Уровень {levelId}. Загрузка...</CardDescription>
          )}
          {!(noContentForModule && !isLoadingTask && contentManuallyRequested) && contentManuallyRequested && <Progress value={isModuleFinished ? (finalModuleScore ?? 0) : progressPercent} className="mt-2 h-2" />}
        </CardHeader>
        <CardContent>
          {!isModuleFinished ? (
            <>
              <div className="mb-6 min-h-[100px]">
                {renderModuleContent()}
              </div>
              {placeholderText && ( 
                <Textarea
                  placeholder={placeholderText} value={userResponse} onChange={(e) => setUserResponse(e.target.value)}
                  className="mb-4 min-h-[100px]"
                  disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && moduleId !== 'writing' && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                />
              )}
              {feedback && feedback.grammarErrorTags && feedback.grammarErrorTags.length > 0 && (
                <div className="mt-2 p-3 border border-orange-300 bg-orange-50 rounded-md">
                  <p className="text-sm font-medium text-orange-700">Обратите внимание на следующие грамматические моменты:</p>
                  <ul className="list-disc list-inside text-xs text-orange-600">
                    {feedback.grammarErrorTags.map(tag => <li key={tag}>{tag.replace(/_/g, ' ')}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : ( 
            <div className="text-center p-6"> 
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Модуль завершен!</h3>
              <p className="text-lg text-muted-foreground mb-1">Ваш результат: <span className={`font-bold ${finalModuleScore !== null && finalModuleScore >= 70 ? 'text-green-600' : 'text-red-600'}`}>{finalModuleScore}%</span></p>
              {finalModuleScore !== null && finalModuleScore < 70 && (
                <p className="text-sm text-muted-foreground mb-4">Нужно немного подтянуть! Попробуйте еще раз.</p>
              )}
               {interactiveExerciseFeedback?.correctSequence && !interactiveExerciseFeedback.isCorrect && activeSequencingExercise && (
                <div className="mt-4 p-3 border border-blue-300 bg-blue-50 rounded-md text-left">
                    <p className="text-sm font-medium text-blue-700">Правильная последовательность была:</p>
                    <ol className="list-decimal list-inside text-xs text-blue-600">
                        {interactiveExerciseFeedback.correctSequence.map((item, idx) => <li key={`fb-corr-${idx}`}>{item}</li>)}
                    </ol>
                </div>
                )}
              <div className="mt-6 flex gap-3 justify-center">
                <Button onClick={handleRetryModule} variant="outline">
                  <RotateCcw className="mr-2 h-4 w-4" /> Повторить модуль
                </Button>
                {topicContinuationLink && (
                    <Button asChild>
                        <Link href={topicContinuationLink}>
                        {topicContinuationText} <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
                {!topicContinuationLink && (
                     <Button asChild>
                        <Link href={`/levels/${levelId.toLowerCase()}/${topicId}`}>
                            К другим модулям темы <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
              </div>
            </div>
          )}
          {feedback && !isModuleFinished && !activeInteractiveExercise && contentManuallyRequested && ( 
            <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500' : 'border-red-500'}`}> 
             <CardContent className="p-4">
                <p className={`font-semibold ${feedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {feedback.evaluation}
                </p>
                {!feedback.isCorrect && feedback.suggestedCorrection && (
                  <p className="text-sm mt-1 text-muted-foreground">Предлагаемая коррекция: {feedback.suggestedCorrection}</p>
                )}
                 {feedback.grammarErrorTags && feedback.grammarErrorTags.length > 0 && (
                    <div className="mt-2">
                    <p className="text-xs font-medium text-orange-600">Замеченные грамматические моменты:</p>
                    <ul className="list-disc list-inside text-xs text-orange-500">
                        {feedback.grammarErrorTags.map(tag => <li key={tag}>{tag.replace(/_/g, ' ')}</li>)}
                    </ul>
                    </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
        {!isModuleFinished && !(noContentForModule && !isLoadingTask && contentManuallyRequested) && contentManuallyRequested && (
          <CardFooter>
            {/* Matching Exercise Button */}
            {activeMatchingExercise && moduleId === 'vocabulary' && !isMatchingChecked && (
              <Button onClick={handleMatchingCheck} className="w-full" size="lg" disabled={isLoadingTask}>
                 {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoadingTask ? "Проверка..." : "Проверить сопоставления"}
              </Button>
            )}
            {/* Audio Quiz Buttons */}
            {activeAudioQuizExercise && moduleId === 'vocabulary' && (
              !audioQuizItemFeedback ? (
                <Button onClick={handleSubmitAudioQuizAnswer} className="w-full" size="lg" disabled={!selectedAudioQuizOption || isLoadingTask}>
                 {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                </Button>
              ) : (
                <Button onClick={handleNextAudioQuizItem} className="w-full" size="lg">Следующий вопрос</Button>
              )
            )}
            {/* Interactive Listening/Reading Buttons */}
            { (activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise) && (moduleId === 'listening' || moduleId === 'reading') && (
                !interactiveExerciseFeedback ? (
                    activeMCQExercise ? (
                        <Button onClick={handleSubmitMCQAnswer} className="w-full" size="lg" disabled={!selectedMCQOption || isLoadingTask}>
                             {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeTrueFalseExercise ? (
                        <Button onClick={handleSubmitTrueFalseAnswer} className="w-full" size="lg" disabled={selectedTrueFalseAnswer === null || isLoadingTask}>
                            {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeSequencingExercise ? (
                        <Button onClick={handleCheckSequence} className="w-full" size="lg" disabled={userSequence.length !== (activeSequencingExercise as AISequencingExercise).shuffledItems.length || isLoadingTask}>
                            {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isLoadingTask ? "Проверка..." : "Проверить последовательность"}
                        </Button>
                    ) : null 
                ) : ( 
                     !activeSequencingExercise && <Button onClick={handleNextInteractiveItem} className="w-full" size="lg">Следующее задание</Button>
                )
            )}
            {/* Standard Task or Structured Writing Button */}
            {!activeInteractiveExercise && (
              <Button 
                onClick={handleSubmit} 
                disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && moduleId !== 'writing' && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                className="w-full" size="lg"
              >
                {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoadingTask ? "Проверка..." : "Ответить"}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
    

    








