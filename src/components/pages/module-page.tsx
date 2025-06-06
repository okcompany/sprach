
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
  AIFillInTheBlanksExercise,
  AIMultipleChoiceExercise,
  AISentenceConstructionExercise,
  WritingEvaluationDetails,
  ErrorExplanation, 
} from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES, ALL_LEVELS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Shuffle, ThumbsUp, ThumbsDown, ListOrdered, Trash2, Info, BookCheck, SearchX, Loader2, DownloadCloud, AlignLeft, Edit3, CheckSquare, FileText, ListChecks, BookOpenCheck, SpellCheck, BookHeart, HelpCircle, Eye, EyeOff } from 'lucide-react'; 
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


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
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [moduleScore, setModuleScore] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [totalTasks, setTotalTasks] = useState(5); // Default, will be updated
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

  // State for Interactive Listening/Reading Exercises
  const [activeMCQExercise, setActiveMCQExercise] = useState<AIComprehensionMultipleChoiceExercise | null>(null);
  const [activeTrueFalseExercise, setActiveTrueFalseExercise] = useState<AITrueFalseExercise | null>(null);
  const [activeSequencingExercise, setActiveSequencingExercise] = useState<AISequencingExercise | null>(null);

  // State for Interactive Grammar Exercises
  const [activeFillBlanksExercise, setActiveFillBlanksExercise] = useState<AIFillInTheBlanksExercise | null>(null);
  const [activeGrammarMCQExercise, setActiveGrammarMCQExercise] = useState<AIMultipleChoiceExercise | null>(null);
  const [activeSentenceConstrExercise, setActiveSentenceConstrExercise] = useState<AISentenceConstructionExercise | null>(null);


  const [currentInteractiveQuestionIndex, setCurrentInteractiveQuestionIndex] = useState(0);
  const [interactiveExerciseFeedback, setInteractiveExerciseFeedback] = useState<{ message: string; isCorrect: boolean; correctAnswerText?: string, explanation?: string, correctSequence?: string[] } | null>(null);

  // MCQ Specific State (Listening/Reading/Grammar)
  const [selectedMCQOption, setSelectedMCQOption] = useState<string | null>(null);

  // True/False Specific State
  const [selectedTrueFalseAnswer, setSelectedTrueFalseAnswer] = useState<boolean | null>(null);

  // Sequencing Specific State
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [availableSequenceItems, setAvailableSequenceItems] = useState<string[]>([]);

  // Fill-in-the-blanks state
  const [fillBlanksUserAnswers, setFillBlanksUserAnswers] = useState<string[]>([]);

  const [noContentForModule, setNoContentForModule] = useState(false);
  const [contentManuallyRequested, setContentManuallyRequested] = useState(false);
  const [showListeningScript, setShowListeningScript] = useState(false);


  const topicName = useMemo(() =>
    userData?.progress[levelId]?.topics[topicId]?.name ||
    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name ||
    userData?.customTopics.find(t => t.id === topicId)?.name ||
    "Загрузка...",
  [userData, levelId, topicId]);

  const resetInteractiveStates = useCallback(() => {
    setActiveMatchingExercise(null); setGermanMatchItems([]); setRussianMatchItems([]); setSelectedGermanItemId(null); setIsMatchingChecked(false);
    setActiveAudioQuizExercise(null); setCurrentAudioQuizItemIndex(0); setSelectedAudioQuizOption(null); setAudioQuizItemFeedback(null);
    setActiveMCQExercise(null); setActiveTrueFalseExercise(null); setActiveSequencingExercise(null);
    setActiveFillBlanksExercise(null); setActiveGrammarMCQExercise(null); setActiveSentenceConstrExercise(null);
    setCurrentInteractiveQuestionIndex(0); setInteractiveExerciseFeedback(null); setSelectedMCQOption(null);
    setSelectedTrueFalseAnswer(null); setUserSequence([]); setAvailableSequenceItems([]);
    setFillBlanksUserAnswers([]);
    setShowListeningScript(false); 
  }, [
    setActiveMatchingExercise, setGermanMatchItems, setRussianMatchItems, setSelectedGermanItemId, setIsMatchingChecked,
    setActiveAudioQuizExercise, setCurrentAudioQuizItemIndex, setSelectedAudioQuizOption, setAudioQuizItemFeedback,
    setActiveMCQExercise, setActiveTrueFalseExercise, setActiveSequencingExercise,
    setActiveFillBlanksExercise, setActiveGrammarMCQExercise, setActiveSentenceConstrExercise,
    setCurrentInteractiveQuestionIndex, setInteractiveExerciseFeedback, setSelectedMCQOption,
    setSelectedTrueFalseAnswer, setUserSequence, setAvailableSequenceItems, setFillBlanksUserAnswers,
    setShowListeningScript 
  ]);

  useEffect(() => {
    // Сброс состояния при смене модуля
    setModuleScore(0);
    setTasksCompleted(0);
    setIsModuleFinished(false);
    setFinalModuleScore(null);
    setFeedback(null);
    setUserResponse('');
    setCurrentTask(null);
    resetInteractiveStates();
    // setShowListeningScript(false); // Now handled by resetInteractiveStates
    setContentManuallyRequested(false);
    setLessonContent(null);
    setNoContentForModule(false);
    setNextSequentialUncompletedModule(null);
    setTopicContinuationLink(null);
    setTopicContinuationText('');
    setCurrentVocabulary([]);

  }, [levelId, topicId, moduleId, resetInteractiveStates]); 

  const fetchLesson = useCallback(async () => {
    if (topicName === "Загрузка...") {
      setIsLoadingTask(false);
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
      loadedLessonContent = await getTopicLessonContent(levelId, topicName, topicId);
    } catch (error) {
      console.error("[ModulePage fetchLesson] Error during getTopicLessonContent:", error);
      loadedLessonContent = null;
    }

    setLessonContent(loadedLessonContent);
    let vocabularySourceUsed: 'ai_interactive' | 'ai_list' | 'fallback' | 'bank_only' | 'none' = 'none';
    let wordsToUseForModule: VocabularyWord[] = [];

    if (loadedLessonContent) {
      setNoContentForModule(false);
      if (moduleId === 'vocabulary') {
        const matchingExercise = loadedLessonContent.interactiveMatchingExercise;
        const audioQuiz = loadedLessonContent.interactiveAudioQuizExercise;

        if (matchingExercise && matchingExercise.pairs?.length > 0) {
          vocabularySourceUsed = 'ai_interactive';
          setActiveMatchingExercise(matchingExercise);
          setTotalTasks(1); 
          const germanPairs = matchingExercise.pairs.map((p, i) => ({ id: `gp_${i}`, text: p.german, originalText: p.german, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const germanDistractors = (matchingExercise.germanDistractors || []).map((d, i) => ({ id: `gd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setGermanMatchItems(shuffleArray([...germanPairs, ...germanDistractors]));
          const russianPairs = matchingExercise.pairs.map((p, i) => ({ id: `rp_${i}`, text: p.russian, originalText: p.russian, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const russianDistractors = (matchingExercise.russianDistractors || []).map((d, i) => ({ id: `rd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setRussianMatchItems(shuffleArray([...russianPairs, ...russianDistractors]));
        } else if (audioQuiz && audioQuiz.items?.length > 0) {
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

        if (mcqExercise && mcqExercise.questions?.length > 0) {
            setActiveMCQExercise(mcqExercise); setTotalTasks(mcqExercise.questions.length);
        } else if (trueFalseExercise && trueFalseExercise.statements?.length > 0) {
            setActiveTrueFalseExercise(trueFalseExercise); setTotalTasks(trueFalseExercise.statements.length);
        } else if (sequencingExercise && sequencingExercise.shuffledItems?.length > 0) {
            setActiveSequencingExercise(sequencingExercise); setAvailableSequenceItems(shuffleArray([...sequencingExercise.shuffledItems])); setUserSequence([]); setTotalTasks(1); 
        } else {
            
            const questionsList = moduleId === 'listening' ? loadedLessonContent.listeningExercise?.questions : loadedLessonContent.readingQuestions;
            const baseText = moduleId === 'listening' ? loadedLessonContent.listeningExercise?.script : loadedLessonContent.readingPassage;
            if (baseText && questionsList && questionsList.length > 0) {
                setTotalTasks(questionsList.length); setCurrentTask(questionsList[0]);
            } else if (baseText) { 
                setCurrentTask("Какова главная идея этого текста? (Ответьте на русском)"); setTotalTasks(1);
            } else {
                 setNoContentForModule(true);
            }
        }
      } else if (moduleId === 'writing') {
        if (loadedLessonContent.writingPrompt) {
            setCurrentTask(loadedLessonContent.writingPrompt); setTotalTasks(1);
        } else {
             setNoContentForModule(true);
        }
      } else if (moduleId === 'grammar') {
        const fillBlanks = loadedLessonContent.grammarFillInTheBlanks;
        const grammarMCQ = loadedLessonContent.grammarMultipleChoice;
        const sentenceConstr = loadedLessonContent.grammarSentenceConstruction;

        if (fillBlanks && fillBlanks.questions?.length > 0) {
            setActiveFillBlanksExercise(fillBlanks); setFillBlanksUserAnswers(Array(fillBlanks.questions.length).fill('')); setTotalTasks(fillBlanks.questions.length);
        } else if (grammarMCQ && grammarMCQ.questions?.length > 0) {
            setActiveGrammarMCQExercise(grammarMCQ); setTotalTasks(grammarMCQ.questions.length);
        } else if (sentenceConstr && sentenceConstr.tasks?.length > 0) {
            setActiveSentenceConstrExercise(sentenceConstr); setUserSequence([]); if(sentenceConstr.tasks[0]?.words) {setAvailableSequenceItems(shuffleArray([...sentenceConstr.tasks[0].words]));} setTotalTasks(sentenceConstr.tasks.length);
        } else if (loadedLessonContent.grammarExplanation) { 
            setCurrentTask("Напишите 2-3 предложения, используя грамматическое правило, объясненное выше. (Ответьте на немецком)"); 
            setTotalTasks(1);
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

    
    if (!loadedLessonContent && !noContentForModule) { 
        setNoContentForModule(true);
    }

    if (noContentForModule && vocabularySourceUsed !== 'fallback' && vocabularySourceUsed !== 'bank_only') { 
        if (!loadedLessonContent && (moduleId !== 'vocabulary' && moduleId !== 'wordTest')) {
             toast({ title: "Ошибка загрузки урока", description: `Не удалось получить материалы для модуля "${MODULE_NAMES_RU[moduleId]}". Попробуйте позже.`, variant: "destructive", duration: 7000 });
        } else if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && vocabularySourceUsed === 'none') {
            toast({ title: "Нет слов для изучения", description: "AI не предоставил слова, и ваш локальный банк слов или резервный список для этой темы пусты.", variant: "default", duration: 7000 });
        } else if (loadedLessonContent) { 
             toast({ title: `Нет контента для модуля ${MODULE_NAMES_RU[moduleId]}`, description: "AI не смог сгенерировать необходимые материалы для этого модуля.", variant: "default", duration: 7000 });
        }
    }
    setIsLoadingTask(false);
  }, [
      levelId, topicId, moduleId, topicName, resetInteractiveStates,
      getTopicLessonContent, addWordToBank, toast, getWordsForTopic,
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
    
    setModuleScore(0);
    setTasksCompleted(0);
    setIsModuleFinished(false);
    setFinalModuleScore(null);
    setFeedback(null);
    setUserResponse('');
    setCurrentTask(null);
    resetInteractiveStates();
    setNextSequentialUncompletedModule(null); 
    setTopicContinuationLink(null); 
    setTopicContinuationText('');
    setCurrentVocabulary([]);
    
    if (lessonContent && !noContentForModule) {
        
        if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && lessonContent.vocabulary && lessonContent.vocabulary.length > 0 && !activeMatchingExercise && !activeAudioQuizExercise) {
            const wordsForModule = lessonContent.vocabulary.map(v => ({
                ...v, 
                id: `${v.german}-${topicId}-retry-${Date.now()}${Math.random()}`, 
                consecutiveCorrectAnswers: 0, 
                errorCount: 0
            }));
            setCurrentVocabulary(wordsForModule);
            setTotalTasks(wordsForModule.length);
            if (wordsForModule[0]) setCurrentTask(wordsForModule[0].german);
        } else if (moduleId === 'writing' && lessonContent.writingPrompt) {
            setCurrentTask(lessonContent.writingPrompt);
            setTotalTasks(1);
        } else if ( (moduleId === 'listening' || moduleId === 'reading') ) {
            
            const mcqExercise = moduleId === 'listening' ? lessonContent.interactiveListeningMCQ : lessonContent.interactiveReadingMCQ;
            const trueFalseExercise = moduleId === 'listening' ? lessonContent.interactiveListeningTrueFalse : lessonContent.interactiveReadingTrueFalse;
            const sequencingExercise = moduleId === 'listening' ? lessonContent.interactiveListeningSequencing : lessonContent.interactiveReadingSequencing;

            if (mcqExercise && mcqExercise.questions?.length > 0) {
                setActiveMCQExercise(mcqExercise); setTotalTasks(mcqExercise.questions.length); setCurrentInteractiveQuestionIndex(0);
            } else if (trueFalseExercise && trueFalseExercise.statements?.length > 0) {
                setActiveTrueFalseExercise(trueFalseExercise); setTotalTasks(trueFalseExercise.statements.length); setCurrentInteractiveQuestionIndex(0);
            } else if (sequencingExercise && sequencingExercise.shuffledItems?.length > 0) {
                setActiveSequencingExercise(sequencingExercise); setAvailableSequenceItems(shuffleArray([...sequencingExercise.shuffledItems])); setUserSequence([]); setTotalTasks(1); setCurrentInteractiveQuestionIndex(0);
            } else {
                const questionsList = moduleId === 'listening' ? lessonContent.listeningExercise?.questions : lessonContent.readingQuestions;
                const baseText = moduleId === 'listening' ? lessonContent.listeningExercise?.script : lessonContent.readingPassage;
                if (baseText && questionsList && questionsList.length > 0) {
                    setTotalTasks(questionsList.length); setCurrentTask(questionsList[0]);
                } else if (baseText) {
                    setCurrentTask("Какова главная идея этого текста? (Ответьте на русском)"); setTotalTasks(1);
                }
            }
        } else if (moduleId === 'grammar') {
             
            const fillBlanks = lessonContent.grammarFillInTheBlanks;
            const grammarMCQ = lessonContent.grammarMultipleChoice;
            const sentenceConstr = lessonContent.grammarSentenceConstruction;

            if (fillBlanks && fillBlanks.questions?.length > 0) {
                setActiveFillBlanksExercise(fillBlanks); setFillBlanksUserAnswers(Array(fillBlanks.questions.length).fill('')); setTotalTasks(fillBlanks.questions.length); setCurrentInteractiveQuestionIndex(0);
            } else if (grammarMCQ && grammarMCQ.questions?.length > 0) {
                setActiveGrammarMCQExercise(grammarMCQ); setTotalTasks(grammarMCQ.questions.length); setCurrentInteractiveQuestionIndex(0);
            } else if (sentenceConstr && sentenceConstr.tasks?.length > 0) {
                setActiveSentenceConstrExercise(sentenceConstr); setUserSequence([]); if(sentenceConstr.tasks[0]?.words) {setAvailableSequenceItems(shuffleArray([...sentenceConstr.tasks[0].words]));} setTotalTasks(sentenceConstr.tasks.length); setCurrentInteractiveQuestionIndex(0);
            } else if (lessonContent.grammarExplanation) {
                setCurrentTask("Напишите 2-3 предложения, используя грамматическое правило, объясненное выше. (Ответьте на немецком)"); 
                setTotalTasks(1);
            }
        } else if (moduleId === 'vocabulary' && lessonContent.interactiveMatchingExercise && lessonContent.interactiveMatchingExercise.pairs?.length > 0) {
            const matchingExercise = lessonContent.interactiveMatchingExercise;
            setActiveMatchingExercise(matchingExercise);
            setTotalTasks(1);
            const germanPairs = matchingExercise.pairs.map((p, i) => ({ id: `gp_${i}`, text: p.german, originalText: p.german, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
            const germanDistractors = (matchingExercise.germanDistractors || []).map((d, i) => ({ id: `gd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
            setGermanMatchItems(shuffleArray([...germanPairs, ...germanDistractors]));
            const russianPairs = matchingExercise.pairs.map((p, i) => ({ id: `rp_${i}`, text: p.russian, originalText: p.russian, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
            const russianDistractors = (matchingExercise.russianDistractors || []).map((d, i) => ({ id: `rd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
            setRussianMatchItems(shuffleArray([...russianPairs, ...russianDistractors]));
            setIsMatchingChecked(false);
        } else if (moduleId === 'vocabulary' && lessonContent.interactiveAudioQuizExercise && lessonContent.interactiveAudioQuizExercise.items?.length > 0) {
            const audioQuiz = lessonContent.interactiveAudioQuizExercise;
            setActiveAudioQuizExercise(audioQuiz);
            setTotalTasks(audioQuiz.items.length);
            setCurrentAudioQuizItemIndex(0);
            setSelectedAudioQuizOption(null);
            setAudioQuizItemFeedback(null);
        }
    }
  };

  const handleRequestContent = () => {
    setContentManuallyRequested(true); 
  };

  
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
    
    updateModuleProgress(levelId, topicId, moduleId, score);
    setFinalModuleScore(score);
    setTasksCompleted(1); 
    setIsModuleFinished(true);
    toast({ title: "Сопоставление завершено!", description: `Ваш результат: ${score}%. Найдено ${correctMatches} из ${totalPairs} пар.`, duration: 7000 });
    setIsLoadingTask(false);
  };


  
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
      setAudioQuizItemFeedback(null);
      setSelectedAudioQuizOption(null);
    }
  };

  
  const handleSelectMCQOption = (option: string) => {
    if (interactiveExerciseFeedback) return;
    setSelectedMCQOption(option);
  };

  const handleSubmitMCQAnswer = (isGrammarMCQ: boolean = false) => {
    const activeExercise = isGrammarMCQ ? activeGrammarMCQExercise : activeMCQExercise;
    if (!activeExercise || !selectedMCQOption || interactiveExerciseFeedback) return;

    setIsLoadingTask(true);
    const currentQuestion = activeExercise.questions[currentInteractiveQuestionIndex];
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

  
  const handleSelectSequenceItem = (itemText: string) => {
    if (interactiveExerciseFeedback) return; 
    if (activeSentenceConstrExercise) {
      
      setUserSequence(prev => [...prev, itemText]);
      setAvailableSequenceItems(prev => prev.filter(item => item !== itemText));
    }
    else if (activeSequencingExercise) { 
      setUserSequence(prev => [...prev, itemText]);
      setAvailableSequenceItems(prev => prev.filter(item => item !== itemText));
    }
  };

  const handleRemoveFromSequence = (itemText: string, index: number) => {
    if (interactiveExerciseFeedback) return; 
     if (activeSentenceConstrExercise || activeSequencingExercise) {
        setUserSequence(prev => prev.filter((_, i) => i !== index));
        setAvailableSequenceItems(prev => [...prev, itemText].sort(() => Math.random() - 0.5)); 
     }
  };

  const handleResetSequence = () => {
    if (interactiveExerciseFeedback) return;
    if (activeSequencingExercise) {
      setUserSequence([]);
      setAvailableSequenceItems(shuffleArray([...activeSequencingExercise.shuffledItems]));
    } else if (activeSentenceConstrExercise) {
        
        const currentTask = activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex];
        if (currentTask) {
            setUserSequence([]);
            setAvailableSequenceItems(shuffleArray([...currentTask.words]));
        }
    }
  };

  const handleCheckSequence = () => {
    if (interactiveExerciseFeedback) return; 
    setIsLoadingTask(true);
    let isCorrect = false;
    let correctOrder: string[] = [];
    let scoreIncrement = 0;
    let feedbackMessage = "";

    if (activeSequencingExercise) { 
        correctOrder = activeSequencingExercise.correctOrder;
        isCorrect = userSequence.length === correctOrder.length && userSequence.every((item, index) => item === correctOrder[index]);
        feedbackMessage = isCorrect ? "Правильно! Последовательность верная." : "Неверно. Порядок неправильный.";
        if (isCorrect) scoreIncrement = 100; 

    } else if (activeSentenceConstrExercise) { 
        const currentTaskData = activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex];
        correctOrder = currentTaskData.possibleCorrectSentences; 
        const userSentence = userSequence.join(" ");
        isCorrect = correctOrder.some(cs => cs === userSentence);
        feedbackMessage = isCorrect ? "Правильно! Предложение составлено верно." : "Неверно. Попробуйте другой порядок или слова.";
        if (isCorrect) scoreIncrement = (100 / totalTasks);
    }

    if (isCorrect) {
      setModuleScore(prev => prev + scoreIncrement);
    }

    setInteractiveExerciseFeedback({
        message: feedbackMessage,
        isCorrect: isCorrect,
        correctSequence: !isCorrect && (activeSequencingExercise || activeSentenceConstrExercise) ? correctOrder : undefined,
        explanation: activeSentenceConstrExercise?.tasks[currentInteractiveQuestionIndex]?.explanation
    });

    
    if (activeSequencingExercise) {
        const finalScore = Math.round(scoreIncrement); 
        updateModuleProgress(levelId, topicId, moduleId, finalScore);
        setFinalModuleScore(finalScore);
        setIsModuleFinished(true);
        setTasksCompleted(1); 
        toast({ title: "Упражнение на упорядочивание завершено!", description: `Ваш результат: ${finalScore}%`, duration: 5000 });
    }
    setIsLoadingTask(false);
  };

  
  const handleFillBlanksInputChange = (questionIndex: number, value: string) => {
    if (interactiveExerciseFeedback && currentInteractiveQuestionIndex === questionIndex) return; 
    const newAnswers = [...fillBlanksUserAnswers];
    newAnswers[questionIndex] = value;
    setFillBlanksUserAnswers(newAnswers);
  };

  const handleSubmitFillBlanks = () => {
    if (!activeFillBlanksExercise || (interactiveExerciseFeedback && tasksCompleted === currentInteractiveQuestionIndex)) return;
    setIsLoadingTask(true);

    const currentQuestionData = activeFillBlanksExercise.questions[currentInteractiveQuestionIndex];
    const userAnswer = fillBlanksUserAnswers[currentInteractiveQuestionIndex]?.trim().toLowerCase();
    const isCurrentCorrect = currentQuestionData.correctAnswers.some(ans => ans.trim().toLowerCase() === userAnswer);

    let scoreIncrement = 0;
    if (isCurrentCorrect) {
      scoreIncrement = (100 / totalTasks);
      setModuleScore(prev => prev + scoreIncrement);
    }

    setInteractiveExerciseFeedback({
      message: isCurrentCorrect ? `Вопрос ${currentInteractiveQuestionIndex + 1}: Правильно!` : `Вопрос ${currentInteractiveQuestionIndex + 1}: Неверно.`,
      isCorrect: isCurrentCorrect,
      correctAnswerText: isCurrentCorrect ? undefined : currentQuestionData.correctAnswers.join(" / "),
      explanation: currentQuestionData.explanation
    });

    setIsLoadingTask(false);
  };


  
  const handleNextInteractiveItem = (isGrammarExercise: boolean = false) => {
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
      setInteractiveExerciseFeedback(null);
      setSelectedMCQOption(null);
      setSelectedTrueFalseAnswer(null);
      if (isGrammarExercise && activeSentenceConstrExercise) {
          setUserSequence([]); 
          if (activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex + 1]?.words) {
               setAvailableSequenceItems(shuffleArray([...activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex + 1].words]));
          } else {
               setAvailableSequenceItems([]); 
          }
      }
    }
  };
  
  const [showNextTaskButton, setShowNextTaskButton] = useState(false);

  
  const handleSubmit = async () => {
    if (!currentTask ) return;
    
    if (isModuleFinished || activeMatchingExercise || activeAudioQuizExercise || activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise || activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise || noContentForModule) return;

    setIsLoadingTask(true);
    if (moduleId !== 'writing') {
      setFeedback(null); 
    }

    let questionContext = ''; let expectedAnswerForAI = ''; let grammarRulesForAI: string | undefined = undefined;

    if (moduleId === 'vocabulary' || moduleId === 'wordTest') {
        
        const wordList = currentVocabulary.length > 0 ? currentVocabulary : (lessonContent?.vocabulary || []);
        const currentWordDef = wordList.find(v => v.german === currentTask);

        if (!currentWordDef) { toast({ title: "Ошибка данных урока", description: "Не найдено текущее слово для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; }
        questionContext = `Пользователя попросили перевести слово "${currentWordDef.german}" на русский.`;
        expectedAnswerForAI = currentWordDef.russian;
    }
    else if (moduleId === 'grammar' && !activeFillBlanksExercise && !activeGrammarMCQExercise && !activeSentenceConstrExercise ) { 
        questionContext = `Пользователя попросили ответить на вопрос или выполнить задание, связанное с грамматическим объяснением: "${lessonContent?.grammarExplanation}". Задание было: "${currentTask}"`;
        grammarRulesForAI = lessonContent?.grammarExplanation;
    }
    else if (moduleId === 'listening') {
        if (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[tasksCompleted]) {
            questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[tasksCompleted]}"`;
        } else if (lessonContent?.listeningExercise && currentTask) { 
            questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${currentTask}"`;
        }
         else {
            toast({ title: "Ошибка данных урока", description: "Нет данных для аудирования для оценки.", variant: "destructive" }); setIsLoadingTask(false); return;
        }
    }
    else if (moduleId === 'reading') {
        if (lessonContent?.readingPassage && lessonContent.readingQuestions && lessonContent.readingQuestions[tasksCompleted]) {
            questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${lessonContent.readingQuestions[tasksCompleted]}"`;
        } else if (lessonContent?.readingPassage && currentTask) { 
            questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${currentTask}"`;
        }
         else {
            toast({ title: "Ошибка данных урока", description: "Нет данных для чтения для оценки.", variant: "destructive" }); setIsLoadingTask(false); return;
        }
    }
    else if (moduleId === 'writing') {
        questionContext = `Пользователя попросили написать текст на тему: "${currentTask}".`;
    }

    const evaluation = await evaluateUserResponse(levelId, topicId, moduleId, userResponse, questionContext, expectedAnswerForAI, grammarRulesForAI);
    if (!evaluation) {
        toast({ title: "Ошибка оценки ответа", description: "Не удалось получить оценку от AI. Попробуйте еще раз.", variant: "destructive" });
        setIsLoadingTask(false);
        return;
    }
    setFeedback(evaluation);
    setShowNextTaskButton(true); 

    if (moduleId === 'writing') {
        setIsLoadingTask(false);
        return; 
    }
    
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
    
    
    if ((tasksCompleted + 1) >= totalTasks) {
        const finalScore = Math.round(moduleScore + (evaluation?.isCorrect ? (100/totalTasks) : 0)); 
        updateModuleProgress(levelId, topicId, moduleId, finalScore);
        setFinalModuleScore(finalScore);
        setIsModuleFinished(true);
        toast({title: `Модуль "${MODULE_NAMES_RU[moduleId]}" завершен!`, description: `Ваш результат: ${finalScore}%.`, duration: 5000});
    }
    
    setIsLoadingTask(false);
  };
  
  const handleNextStandardTask = () => {
    setUserResponse(''); 
    setFeedback(null);
    setShowNextTaskButton(false);

    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) {
        // This case should ideally be handled after handleSubmit if it was the last task
        // and feedback was shown. But as a safeguard:
        const finalScore = Math.round(moduleScore); // Use existing moduleScore
        if (!isModuleFinished) { // Only update if not already marked finished
             updateModuleProgress(levelId, topicId, moduleId, finalScore);
             setFinalModuleScore(finalScore);
             setIsModuleFinished(true);
             toast({title: `Модуль "${MODULE_NAMES_RU[moduleId]}" завершен!`, description: `Ваш результат: ${finalScore}%.`, duration: 5000});
        }
    } else {
      // Move to the next task
      const nextQuestionList = (moduleId === 'listening') 
          ? lessonContent?.listeningExercise?.questions 
          : (moduleId === 'reading') 
              ? lessonContent?.readingQuestions 
              : null;

      if ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary[newTasksCompleted]) { 
          setCurrentTask(currentVocabulary[newTasksCompleted].german); 
      } else if (nextQuestionList && nextQuestionList.length > newTasksCompleted) { 
          setCurrentTask(nextQuestionList[newTasksCompleted]); 
      } else if (moduleId === 'grammar' && !activeFillBlanksExercise && !activeGrammarMCQExercise && !activeSentenceConstrExercise && lessonContent?.grammarExplanation && currentTask) {
         // For standard grammar (1 task), this shouldn't be reached if newTasksCompleted < totalTasks
      }
    }
  };


  
  const handleCompleteWritingModule = () => {
    if (!feedback || moduleId !== 'writing') return; 

    
    const score = feedback.isCorrect ? 100 : 50; 
    
    updateModuleProgress(levelId, topicId, moduleId, score);
    setFinalModuleScore(score);
    setTasksCompleted(1); 
    setIsModuleFinished(true);
    toast({title: `Модуль "Письмо" завершен!`, description: `Ваш результат: ${score}%.`, duration: 5000});
    
  };


  const renderModuleContent = () => {
    if (!contentManuallyRequested && !lessonContent && !isLoadingTask && !noContentForModule) {
      return (
        <div className="text-center p-6">
          <DownloadCloud className="h-16 w-16 mx-auto mb-4 text-primary/70" />
          <h3 className="text-xl font-semibold mb-3">Материалы модуля еще не загружены</h3>
          <p className="text-muted-foreground mb-6">Нажмите кнопку ниже, чтобы ИИ сгенерировал для вас урок.</p>
          <Button onClick={handleRequestContent} size="lg" disabled={isLoadingTask}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ display: isLoadingTask ? 'inline-block' : 'none' }} />
            {isLoadingTask ? "Загрузка..." : "Загрузить материалы модуля"}
          </Button>
        </div>
      );
    }

    if (isLoadingTask && !lessonContent) { 
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
                 <Button onClick={handleRequestContent} variant="outline" className="mt-6" disabled={isLoadingTask}>
                    {isLoadingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    {isLoadingTask ? "Загрузка..." : "Попробовать загрузить снова"}
                </Button>
            </div>
        );
    }

    
    if (moduleId === 'writing' && feedback && feedback.writingDetails) {
      const details = feedback.writingDetails;
      return (
        <div>
          <h3 className="text-xl font-semibold mb-2">Ваш текст на тему:</h3>
          <p className="text-lg mb-4 p-3 border rounded-md bg-muted/30 whitespace-pre-wrap">{userResponse || "Вы еще не ввели текст."}</p>
          <Card className="mb-4 bg-card">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Оценка вашего текста</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={['overallFeedback', 'taskAchievement']} className="w-full">
                {details.overallFeedback && (
                  <AccordionItem value="overallFeedback">
                    <AccordionTrigger className="text-base">
                      <FileText className="mr-2 h-5 w-5 text-primary" /> Общее впечатление
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <p>{details.overallFeedback}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {details.taskAchievement && (
                  <AccordionItem value="taskAchievement">
                    <AccordionTrigger className="text-base">
                      <ListChecks className="mr-2 h-5 w-5 text-primary" /> Решение задачи
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <div dangerouslySetInnerHTML={{ __html: details.taskAchievement.replace(/\n/g, '<br />') }} />
                    </AccordionContent>
                  </AccordionItem>
                )}
                {details.coherenceAndCohesion && (
                  <AccordionItem value="coherenceAndCohesion">
                    <AccordionTrigger className="text-base">
                     <AlignLeft className="mr-2 h-5 w-5 text-primary" /> Связность и логика
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                       <p>{details.coherenceAndCohesion}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {details.lexicalResource && (
                  <AccordionItem value="lexicalResource">
                    <AccordionTrigger className="text-base">
                      <BookOpenCheck className="mr-2 h-5 w-5 text-primary" /> Словарный запас
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <p>{details.lexicalResource}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {details.grammaticalAccuracy && (
                  <AccordionItem value="grammaticalAccuracy">
                    <AccordionTrigger className="text-base">
                      <SpellCheck className="mr-2 h-5 w-5 text-primary" /> Грамматика
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <p>{details.grammaticalAccuracy}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {feedback.grammarErrorTags && feedback.grammarErrorTags.length > 0 && (
                  <AccordionItem value="grammarTags">
                    <AccordionTrigger className="text-base">
                      <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" /> Грамматические моменты
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside text-sm text-orange-600 dark:text-orange-400">
                        {feedback.grammarErrorTags.map(tag => <li key={tag}>{tag.replace(/_/g, ' ')}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {details.suggestedImprovements && details.suggestedImprovements.length > 0 && (
                  <AccordionItem value="suggestedImprovements">
                    <AccordionTrigger className="text-base">
                       <Edit3 className="mr-2 h-5 w-5 text-primary" /> Предложения по улучшению
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <ul className="list-disc pl-5 space-y-1">
                        {details.suggestedImprovements.map((imp, idx) => <li key={idx}>{imp}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {feedback.suggestedCorrection && (
                  <AccordionItem value="fullCorrection">
                    <AccordionTrigger className="text-base">
                      <CheckSquare className="mr-2 h-5 w-5 text-green-600" /> Пример исправленного текста
                    </AccordionTrigger>
                    <AccordionContent className="prose dark:prose-invert max-w-none text-sm">
                      <p>{feedback.suggestedCorrection}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      );
    }

    
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
    
    if (moduleId === 'vocabulary' && activeAudioQuizExercise) {
      if (!activeAudioQuizExercise.items || activeAudioQuizExercise.items.length === 0) return <p className="text-center p-4 text-muted-foreground">Нет вопросов для аудио-квиза.</p>;
      const currentItem = activeAudioQuizExercise.items[currentAudioQuizItemIndex];
      if (!currentItem) return <p className="text-center p-4 text-muted-foreground">Ошибка: текущий вопрос аудио-квиза не найден.</p>;
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
    
    const currentLRInteractiveExercise = activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise;
    if ((moduleId === 'listening' || moduleId === 'reading') && currentLRInteractiveExercise) {
        const baseText = moduleId === 'listening' ? lessonContent?.listeningExercise?.script : lessonContent?.readingPassage;
        return ( 
            <div>
                <h3 className="text-xl font-semibold mb-2">{currentLRInteractiveExercise.instructions}</h3>
                 <p className="text-center text-muted-foreground mb-4">
                    {currentLRInteractiveExercise.type === 'sequencing' ? `Упорядочите ${ (currentLRInteractiveExercise as AISequencingExercise).shuffledItems?.length || 0} элементов.` : `Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}`}
                 </p>

                {baseText && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Button variant="outline" onClick={() => speak(baseText, 'de-DE' )}>
                                <Speaker className="mr-2 h-4 w-4" /> {moduleId === 'listening' ? "Прослушать текст" : "Озвучить текст"}
                            </Button>
                            {moduleId === 'listening' && ( 
                                !showListeningScript ? (
                                    <Button variant="outline" onClick={() => setShowListeningScript(true)}>
                                        <Eye className="mr-2 h-4 w-4" /> Показать текст
                                    </Button>
                                ) : (
                                    <Button variant="outline" onClick={() => setShowListeningScript(false)}>
                                        <EyeOff className="mr-2 h-4 w-4" /> Скрыть текст
                                    </Button>
                                )
                            )}
                        </div>
                        { (moduleId === 'listening' && showListeningScript) || moduleId === 'reading' ? ( 
                            <Card className="bg-muted/30">
                                <CardHeader className="pb-2 pt-3"><CardTitle className="text-base">{moduleId === 'listening' ? "Текст для аудирования" : "Текст для чтения"}</CardTitle></CardHeader>
                                <CardContent className="prose dark:prose-invert max-w-none text-sm max-h-60 overflow-y-auto py-2">
                                    <p>{baseText}</p>
                                </CardContent>
                            </Card>
                        ) : null }
                    </div>
                )}
                

                {activeMCQExercise && activeMCQExercise.type === 'comprehensionMultipleChoice' && (() => {
                    if (!activeMCQExercise.questions || activeMCQExercise.questions.length === 0) return <p>Нет вопросов для MCQ.</p>;
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

                {activeTrueFalseExercise && activeTrueFalseExercise.type === 'trueFalse' && (() => {
                    if (!activeTrueFalseExercise.statements || activeTrueFalseExercise.statements.length === 0) return <p>Нет утверждений для True/False.</p>;
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

                {activeSequencingExercise && activeSequencingExercise.type === 'sequencing' && (() => {
                    if (!activeSequencingExercise.shuffledItems || activeSequencingExercise.shuffledItems.length === 0) return <p>Нет элементов для упорядочивания.</p>;
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
                             {interactiveExerciseFeedback.correctAnswerText && !interactiveExerciseFeedback.isCorrect && (
                                <p className="text-sm mt-1">Правильный ответ: <span className="font-semibold">{interactiveExerciseFeedback.correctAnswerText}</span></p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    
    if (moduleId === 'grammar') {
      const grammarExplanation = lessonContent?.grammarExplanation;
      const currentGrammarInteractiveExercise = activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise;
      
      return (
        <div>
          {grammarExplanation && (
            <Card className="mb-6 bg-muted/30 shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <BookHeart className="mr-2 h-5 w-5 text-primary" />
                  Теория: Грамматическое правило
                </CardTitle>
              </CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none text-sm">
                
                <div dangerouslySetInnerHTML={{ __html: grammarExplanation.replace(/\n/g, '<br />') }} />
              </CardContent>
            </Card>
          )}

          
          {currentGrammarInteractiveExercise && (
            <div>
              <h3 className="text-xl font-semibold mb-2">{currentGrammarInteractiveExercise.instructions}</h3>
              <p className="text-center text-muted-foreground mb-4">
                Задание {currentInteractiveQuestionIndex + 1} из {totalTasks}
              </p>

              
              {activeFillBlanksExercise && (() => {
                if (!activeFillBlanksExercise.questions || activeFillBlanksExercise.questions.length === 0) return <p>Нет заданий "Заполните пропуски".</p>;
                const currentQuestion = activeFillBlanksExercise.questions[currentInteractiveQuestionIndex];
                if (!currentQuestion) return <p>Ошибка: текущий вопрос "Заполните пропуски" не найден.</p>;
                return (
                  <div className="space-y-4 mb-6">
                    <p className="font-medium text-lg whitespace-pre-line">{currentQuestion.promptText}</p>
                    <Textarea
                      placeholder="Ваш ответ..."
                      value={fillBlanksUserAnswers[currentInteractiveQuestionIndex] || ''}
                      onChange={(e) => handleFillBlanksInputChange(currentInteractiveQuestionIndex, e.target.value)}
                      className="min-h-[80px]"
                      disabled={!!(interactiveExerciseFeedback && currentInteractiveQuestionIndex === tasksCompleted && interactiveExerciseFeedback.message.startsWith(`Вопрос ${currentInteractiveQuestionIndex + 1}`)) || isLoadingTask}
                    />
                  </div>
                );
              })()}

              
              {activeGrammarMCQExercise && (() => {
                if (!activeGrammarMCQExercise.questions || activeGrammarMCQExercise.questions.length === 0) return <p>Нет вопросов для MCQ по грамматике.</p>;
                const currentQuestion = activeGrammarMCQExercise.questions[currentInteractiveQuestionIndex];
                if (!currentQuestion) return <p>Ошибка: текущий вопрос MCQ по грамматике не найден.</p>;
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

              
              {activeSentenceConstrExercise && (() => {
                 if (!activeSentenceConstrExercise.tasks || activeSentenceConstrExercise.tasks.length === 0) return <p>Нет заданий "Составь предложение".</p>;
                 const currentTaskData = activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex];
                 if (!currentTaskData) return <p>Ошибка: текущее задание "Составь предложение" не найдено.</p>;
                 return (
                     <div className="space-y-6 mb-6">
                         <p className="font-medium text-lg">{currentTaskData.explanation || "Составьте предложение из данных слов:"}</p>
                         <div>
                             <h4 className="font-medium text-md mb-2">Доступные слова:</h4>
                             {availableSequenceItems.length === 0 && !interactiveExerciseFeedback && <p className="text-sm text-muted-foreground">Все слова добавлены в ваше предложение.</p>}
                             <div className="flex flex-wrap gap-2">
                                 {availableSequenceItems.map((item, index) => (
                                     <Button
                                         key={`avail-constr-${index}`}
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
                                 <h4 className="font-medium text-md">Ваше предложение:</h4>
                                 <Button variant="ghost" size="sm" onClick={handleResetSequence} disabled={!!interactiveExerciseFeedback || userSequence.length === 0 || isLoadingTask}>
                                     <RotateCcw className="mr-1 h-3 w-3" /> Сбросить
                                 </Button>
                             </div>
                             {userSequence.length === 0 && <p className="text-sm text-muted-foreground">Начните выбирать слова из списка выше.</p>}
                             <div className="p-3 border rounded-md bg-muted/20 min-h-[40px] flex flex-wrap gap-1">
                                 {userSequence.map((item, index) => (
                                     <Badge
                                        key={`user-constr-${index}`}
                                        variant="secondary"
                                        className="text-sm p-1 px-2 cursor-pointer"
                                        onClick={() => !interactiveExerciseFeedback && !isLoadingTask && handleRemoveFromSequence(item, index)}
                                     >
                                         {item}
                                         {!interactiveExerciseFeedback && !isLoadingTask && <Trash2 className="ml-1.5 h-3 w-3 text-destructive/70"/>}
                                     </Badge>
                                 ))}
                             </div>
                         </div>
                     </div>
                 );
              })()}

              
              {interactiveExerciseFeedback && currentInteractiveQuestionIndex === tasksCompleted && ( 
                <Card className={`mb-4 ${interactiveExerciseFeedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                  <CardContent className="p-4">
                    <p className={`font-semibold ${interactiveExerciseFeedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {interactiveExerciseFeedback.message}
                    </p>
                    {interactiveExerciseFeedback.correctAnswerText && !interactiveExerciseFeedback.isCorrect && (
                        <p className="text-sm mt-1">Правильный ответ: <span className="font-semibold">{interactiveExerciseFeedback.correctAnswerText}</span></p>
                    )}
                    {interactiveExerciseFeedback.correctSequence && !interactiveExerciseFeedback.isCorrect && ( 
                        <div className="mt-2">
                            <p className="text-sm font-medium text-muted-foreground">Правильные варианты:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                {interactiveExerciseFeedback.correctSequence.map((s, i) => <li key={`corr-sent-fb-${i}`}>{s}</li>)}
                            </ul>
                        </div>
                    )}
                    {interactiveExerciseFeedback.explanation && <p className="text-sm mt-1 text-muted-foreground">Пояснение: {interactiveExerciseFeedback.explanation}</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          
          {!currentGrammarInteractiveExercise && grammarExplanation && currentTask && (
             <div>
                <p className="text-lg mb-2">{currentTask}</p>
             </div>
          )}
           {placeholderText && !currentGrammarInteractiveExercise && grammarExplanation && currentTask && ( 
             <Textarea
                placeholder={placeholderText} value={userResponse} onChange={(e) => setUserResponse(e.target.value)}
                className="mb-4 min-h-[100px]"
                disabled={isLoadingTask || tasksCompleted >= totalTasks}
              />
           )}

        </div>
      );
    }


    
    if (!lessonContent && ( (moduleId !== 'vocabulary' && moduleId !== 'wordTest') || ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary.length === 0) ) ) { return <p className="text-center p-4 text-muted-foreground">Загрузка данных урока...</p>; }

    switch (moduleId) {
      case 'vocabulary':
      case 'wordTest': {
        
        if (currentVocabulary.length === 0 && !(lessonContent?.vocabulary && lessonContent.vocabulary.length > 0) && !activeMatchingExercise && !activeAudioQuizExercise) return <p className="text-center p-4 text-muted-foreground">Слов для изучения/теста не найдено.</p>;
        
        const wordList = currentVocabulary.length > 0 ? currentVocabulary : (lessonContent?.vocabulary || []);
        const word = wordList.find(v => v.german === currentTask);

        if (!word) return <p className="text-center p-4 text-muted-foreground">Ошибка: Слово не найдено для {currentTask}.</p>;
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
      case 'listening': { 
        if (!activeMCQExercise && !activeTrueFalseExercise && !activeSequencingExercise) { 
            if (!lessonContent?.listeningExercise || !lessonContent.listeningExercise.script) return <p className="text-center p-4 text-muted-foreground">Загрузка аудирования...</p>;
            const script = lessonContent.listeningExercise.script;
            const currentListeningQuestion = lessonContent.listeningExercise.questions?.[tasksCompleted];
            return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">Аудирование:</h3>
                    <p className="mb-1 text-muted-foreground">Прослушайте текст и ответьте на вопросы.</p>
                    <div className="flex items-center gap-2 mb-4">
                        <Button onClick={() => speak(script, 'de-DE')}>
                            <Speaker className="mr-2 h-4 w-4" /> Прослушать текст
                        </Button>
                        {!showListeningScript ? (
                            <Button variant="outline" onClick={() => setShowListeningScript(true)}>
                                <Eye className="mr-2 h-4 w-4" /> Показать текст
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={() => setShowListeningScript(false)}>
                                <EyeOff className="mr-2 h-4 w-4" /> Скрыть текст
                            </Button>
                        )}
                    </div>
                    {showListeningScript && (
                        <Card className="mb-4 bg-muted/30">
                            <CardHeader className="py-2 pt-3">
                                <CardTitle className="text-base">Текст для аудирования</CardTitle>
                            </CardHeader>
                            <CardContent className="prose dark:prose-invert max-w-none text-sm max-h-60 overflow-y-auto py-2">
                                <p>{script}</p>
                            </CardContent>
                        </Card>
                    )}
                    {currentListeningQuestion && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )}
                    {!currentTask && tasksCompleted < totalTasks && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>}
                    {currentTask && (!lessonContent.listeningExercise.questions || lessonContent.listeningExercise.questions.length === 0) && tasksCompleted < totalTasks && (
                        <p className="text-lg mb-2">Вопрос: {currentTask}</p>
                    )}
                    {tasksCompleted >= totalTasks && (!lessonContent.listeningExercise.questions || lessonContent.listeningExercise.questions.length === 0) && <p className="text-muted-foreground">Вопросов к этому тексту нет, или они уже пройдены.</p>}
                </div>
            );
        }
        break; 
      }
      case 'reading': { 
        if (!activeMCQExercise && !activeTrueFalseExercise && !activeSequencingExercise) {
            if (!lessonContent?.readingPassage) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>;
            return (
                <div>
                    <h3 className="text-xl font-semibold mb-2">Чтение:</h3>
                     <Card className="mb-4 bg-muted/30">
                        <CardHeader className="py-2 pt-3">
                            <CardTitle className="text-base">Текст для чтения</CardTitle>
                        </CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none text-sm py-2">
                            <div dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} />
                        </CardContent>
                    </Card>
                    {currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )}
                    {!currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>}
                    {currentTask && (!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && tasksCompleted < totalTasks && (
                        <p className="text-lg mb-2">Вопрос: {currentTask}</p> 
                    )}
                    {tasksCompleted >= totalTasks && (!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && <p className="text-muted-foreground">Вопросов к этому тексту нет, или они уже пройдены.</p>}
                </div>
            );
        }
        break;
      }
      case 'writing': { 
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
  
  const isAnyInteractiveExerciseActive = activeMatchingExercise || activeAudioQuizExercise || activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise || activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise;
  
  
  const shouldShowTextarea = 
    contentManuallyRequested && lessonContent && 
    !isModuleFinished && 
    !isAnyInteractiveExerciseActive && 
    moduleId !== 'writing' || (moduleId === 'writing' && !feedback) && 
    (currentTask || (moduleId === 'grammar' && lessonContent?.grammarExplanation)); 

  if (moduleId === 'grammar' && lessonContent?.grammarExplanation && !isAnyInteractiveExerciseActive && currentTask) {
    placeholderText = "Напишите здесь ваши предложения...";
  }


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
            {moduleId === 'grammar' && !(activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise) && <BookHeart className="mr-2 h-6 w-6 text-primary"/>}
            {activeFillBlanksExercise && <Edit3 className="mr-2 h-6 w-6 text-primary"/>}
            {activeGrammarMCQExercise && <CheckSquare className="mr-2 h-6 w-6 text-primary"/>}
            {activeSentenceConstrExercise && <AlignLeft className="mr-2 h-6 w-6 text-primary"/>}
            {activeSequencingExercise && <ListOrdered className="mr-2 h-6 w-6 text-primary"/>}
            {activeMCQExercise && <BookCheck className="mr-2 h-6 w-6 text-primary"/>}
            {activeTrueFalseExercise && <ThumbsUp className="mr-2 h-6 w-6 text-primary"/>}
            {activeAudioQuizExercise && <Speaker className="mr-2 h-6 w-6 text-primary"/>}
            {activeMatchingExercise && <Shuffle className="mr-2 h-6 w-6 text-primary"/>}
            {moduleId === 'writing' && <FileText className="mr-2 h-6 w-6 text-primary"/>}
            
            {!contentManuallyRequested && !isLoadingTask && !isAnyInteractiveExerciseActive && moduleId !== 'grammar' && moduleId !== 'writing' && <DownloadCloud className="mr-2 h-6 w-6 text-primary/70" />}
            {noContentForModule && !isLoadingTask && contentManuallyRequested && <SearchX className="mr-2 h-6 w-6 text-destructive"/>}
            {isLoadingTask && contentManuallyRequested && !lessonContent && <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />}
            
            {moduleTitle}: {topicName}
          </CardTitle>
          {!isModuleFinished && !noContentForModule && contentManuallyRequested && lessonContent ? (
            <CardDescription>Уровень {levelId}.
            {activeMatchingExercise ? " Упражнение на сопоставление." :
             activeAudioQuizExercise ? `Аудио-квиз: Задание ${currentAudioQuizItemIndex + 1} из ${totalTasks}.` :
             (activeMCQExercise || activeTrueFalseExercise) ? `Интерактивное упражнение (Чтение/Аудир.): Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}.` :
             activeSequencingExercise ? `Интерактивное упражнение (Чтение/Аудир.): Упорядочите элементы.` :
             (activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise) ? `Интерактивное упражнение (Грамматика): Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}.` :
             (moduleId === 'writing' && feedback) ? "Ваш текст оценен. Смотрите ниже." :
              (currentVocabulary.length > 0 || (lessonContent?.vocabulary && lessonContent.vocabulary.length > 0) || (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions.length > 0) || (lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0) || (lessonContent?.grammarExplanation && currentTask) || lessonContent?.writingPrompt) ? `Задание ${tasksCompleted + 1} из ${totalTasks}.` : "Загрузка задания..."}
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
          {!(noContentForModule && !isLoadingTask && contentManuallyRequested) && contentManuallyRequested && lessonContent && <Progress value={isModuleFinished ? (finalModuleScore ?? 0) : (moduleId === 'writing' && feedback ? 100 : progressPercent)} className="mt-2 h-2" />}
        </CardHeader>
        <CardContent>
          {!isModuleFinished ? (
            <>
              <div className="mb-6 min-h-[100px]">
                {renderModuleContent()}
              </div>
              {shouldShowTextarea && (
                <Textarea
                  placeholder={placeholderText} value={userResponse} onChange={(e) => setUserResponse(e.target.value)}
                  className="mb-4 min-h-[100px]"
                  disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && moduleId !== 'writing' && !isAnyInteractiveExerciseActive)}
                />
              )}
              
              {feedback && !isAnyInteractiveExerciseActive && moduleId !== 'writing' && contentManuallyRequested && (
                <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500' : 'border-red-500'}`}>
                  <CardContent className="p-4">
                      <p className={`font-semibold ${feedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {feedback.evaluation}
                      </p>
                      {!feedback.isCorrect && feedback.suggestedCorrection && (
                      <p className="text-sm mt-2 text-muted-foreground">Предлагаемый полный правильный ответ: <span className="font-medium">{feedback.suggestedCorrection}</span></p>
                      )}
                      {feedback.grammarErrorTags && feedback.grammarErrorTags.length > 0 && (
                          <div className="mt-3">
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Замеченные грамматические моменты:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                              {feedback.grammarErrorTags.map(tag => <Badge key={tag} variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-300">{tag.replace(/_/g, ' ')}</Badge>)}
                          </div>
                          </div>
                      )}
                      {feedback.errorExplanationDetails && !feedback.isCorrect && (
                        <Card className="mt-4 border-orange-400 bg-orange-50 dark:bg-orange-800/20">
                          <CardHeader className="pb-2 pt-3">
                            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center">
                              <HelpCircle className="mr-2 h-4 w-4" /> Разбор ошибки
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1.5 text-xs pb-3">
                            {feedback.errorExplanationDetails.generalExplanation && (
                              <p><strong>Объяснение:</strong> {feedback.errorExplanationDetails.generalExplanation}</p>
                            )}
                            {feedback.errorExplanationDetails.specificExample && (
                              <p><strong>В вашем ответе:</strong> <code className="bg-orange-200 dark:bg-orange-700/50 p-0.5 rounded text-orange-800 dark:text-orange-200">{feedback.errorExplanationDetails.specificExample}</code></p>
                            )}
                            {feedback.errorExplanationDetails.correctionExample && (
                              <p><strong>Небольшое исправление:</strong> <span className="font-medium text-green-700 dark:text-green-400">{feedback.errorExplanationDetails.correctionExample}</span></p>
                            )}
                            {feedback.errorExplanationDetails.theoryReference && (
                              <p className="mt-1 text-muted-foreground"><strong>Теория:</strong> {feedback.errorExplanationDetails.theoryReference}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                  </CardContent>
                </Card>
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
                <div className="mt-4 p-3 border border-blue-300 bg-blue-50 rounded-md text-left dark:bg-blue-900/30 dark:border-blue-700">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Правильная последовательность была:</p>
                    <ol className="list-decimal list-inside text-xs text-blue-600 dark:text-blue-400">
                        {interactiveExerciseFeedback.correctSequence.map((item, idx) => <li key={`fb-corr-${idx}`}>{item}</li>)}
                    </ol>
                </div>
                )}
                {feedback && feedback.errorExplanationDetails && !feedback.isCorrect && moduleId !== 'writing' && (
                    <Card className="mt-4 border-orange-400 bg-orange-50 dark:bg-orange-800/20 text-left">
                        <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center">
                            <HelpCircle className="mr-2 h-4 w-4" /> Подробный разбор последней ошибки
                        </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-xs pb-3">
                        {feedback.evaluation && <p><strong>Краткий вывод:</strong> {feedback.evaluation}</p>}
                        {feedback.suggestedCorrection && (
                            <p><strong>Полный правильный ответ:</strong> <span className="font-medium text-green-700 dark:text-green-400">{feedback.suggestedCorrection}</span></p>
                        )}
                        {feedback.errorExplanationDetails.generalExplanation && (
                            <p><strong>Объяснение ошибки:</strong> {feedback.errorExplanationDetails.generalExplanation}</p>
                        )}
                        {feedback.errorExplanationDetails.specificExample && (
                            <p><strong>В вашем ответе (фрагмент):</strong> <code className="bg-orange-200 dark:bg-orange-700/50 p-0.5 rounded text-orange-800 dark:text-orange-200">{feedback.errorExplanationDetails.specificExample}</code></p>
                        )}
                        {feedback.errorExplanationDetails.correctionExample && (
                            <p><strong>Исправление фрагмента:</strong> <span className="font-medium text-green-700 dark:text-green-400">{feedback.errorExplanationDetails.correctionExample}</span></p>
                        )}
                        {feedback.errorExplanationDetails.theoryReference && (
                            <p className="mt-1 text-muted-foreground"><strong>Теория:</strong> {feedback.errorExplanationDetails.theoryReference}</p>
                        )}
                        </CardContent>
                    </Card>
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
        </CardContent>
        
        {!isModuleFinished && !(noContentForModule && !isLoadingTask && contentManuallyRequested) && contentManuallyRequested && lessonContent && (
          <CardFooter>
            {moduleId === 'writing' && (
              !feedback ? (
                <Button onClick={handleSubmit} className="w-full" size="lg" disabled={isLoadingTask || !userResponse.trim()}>
                  {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Отправить на проверку
                </Button>
              ) : (
                <Button onClick={handleCompleteWritingModule} className="w-full" size="lg" disabled={isLoadingTask}>
                  {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Завершить и перейти
                </Button>
              )
            )}
            {activeMatchingExercise && moduleId === 'vocabulary' && !isMatchingChecked && (
              <Button onClick={handleMatchingCheck} className="w-full" size="lg" disabled={isLoadingTask}>
                 {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoadingTask ? "Проверка..." : "Проверить сопоставления"}
              </Button>
            )}
            {activeAudioQuizExercise && moduleId === 'vocabulary' && (
              !audioQuizItemFeedback ? (
                <Button onClick={handleSubmitAudioQuizAnswer} className="w-full" size="lg" disabled={!selectedAudioQuizOption || isLoadingTask}>
                 {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                </Button>
              ) : (
                <Button onClick={handleNextAudioQuizItem} className="w-full" size="lg">Следующий вопрос</Button>
              )
            )}
            
            { (activeMCQExercise || activeTrueFalseExercise || activeSequencingExercise) && (moduleId === 'listening' || moduleId === 'reading') && (
                !interactiveExerciseFeedback ? ( 
                    activeMCQExercise ? (
                        <Button onClick={() => handleSubmitMCQAnswer(false)} className="w-full" size="lg" disabled={!selectedMCQOption || isLoadingTask}>
                             {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeTrueFalseExercise ? (
                        <Button onClick={handleSubmitTrueFalseAnswer} className="w-full" size="lg" disabled={selectedTrueFalseAnswer === null || isLoadingTask}>
                            {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeSequencingExercise ? (
                        <Button onClick={handleCheckSequence} className="w-full" size="lg" disabled={!activeSequencingExercise.shuffledItems || userSequence.length !== activeSequencingExercise.shuffledItems.length || isLoadingTask}>
                            {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoadingTask ? "Проверка..." : "Проверить последовательность"}
                        </Button>
                    ) : null
                ) : ( 
                     !activeSequencingExercise && <Button onClick={() => handleNextInteractiveItem(false)} className="w-full" size="lg">Следующее задание</Button>
                )
            )}
            
             { (activeFillBlanksExercise || activeGrammarMCQExercise || activeSentenceConstrExercise) && moduleId === 'grammar' && (
                 !interactiveExerciseFeedback || (tasksCompleted === currentInteractiveQuestionIndex && !interactiveExerciseFeedback.message.startsWith(`Вопрос ${currentInteractiveQuestionIndex + 1}`)) ? ( 
                    activeFillBlanksExercise ? (
                        <Button
                            onClick={handleSubmitFillBlanks}
                            className="w-full"
                            size="lg"
                            disabled={!fillBlanksUserAnswers[currentInteractiveQuestionIndex]?.trim() || isLoadingTask}
                        >
                            {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeGrammarMCQExercise ? (
                         <Button onClick={() => handleSubmitMCQAnswer(true)} className="w-full" size="lg" disabled={!selectedMCQOption || isLoadingTask}>
                            {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoadingTask ? "Проверка..." : "Проверить ответ"}
                        </Button>
                    ) : activeSentenceConstrExercise ? (
                         <Button onClick={handleCheckSequence} className="w-full" size="lg" 
                            disabled={ (activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex]?.words.length ?? 0) > 0 && userSequence.length !== activeSentenceConstrExercise.tasks[currentInteractiveQuestionIndex]?.words.length || isLoadingTask}>
                            {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoadingTask ? "Проверка..." : "Проверить предложение"}
                        </Button>
                    ) : null
                 ) : ( 
                    <Button onClick={() => handleNextInteractiveItem(true)} className="w-full" size="lg">Следующее задание</Button>
                 )
             )}

            
            {moduleId !== 'writing' && !isAnyInteractiveExerciseActive && !(moduleId === 'grammar' && !currentTask) && (
              !showNextTaskButton ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                  className="w-full" size="lg"
                >
                  {isLoadingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoadingTask ? "Проверка..." : "Ответить"}
                </Button>
              ) : (
                 (tasksCompleted +1) < totalTasks ? (
                    <Button onClick={handleNextStandardTask} className="w-full" size="lg">
                        Следующее задание <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                 ) : (
                    <Button onClick={handleNextStandardTask} className="w-full" size="lg"> 
                        {/* This effectively becomes "Finish Module" if it's the last task and feedback is shown */}
                        Завершить модуль <CheckCircle className="ml-2 h-4 w-4" />
                    </Button>
                 )
              )
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

