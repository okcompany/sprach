
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
  AIAudioQuizItem,
  AIListeningInteractiveExercise,
  AIReadingInteractiveExercise,
  AIComprehensionMultipleChoiceExercise,
  AIComprehensionMQ_Question,
  AITrueFalseExercise,
  AITrueFalseStatement,
} from '@/types/german-learning';
import { MODULE_NAMES_RU, DEFAULT_TOPICS, ALL_MODULE_TYPES, ALL_LEVELS } from '@/types/german-learning';
import { Speaker, RotateCcw, CheckCircle, AlertTriangle, ArrowRight, Shuffle, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const [isLoadingTask, setIsLoadingTask] = useState(true); 
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

  // State for Interactive Listening/Reading Exercises
  const [activeInteractiveExercise, setActiveInteractiveExercise] = useState<AIListeningInteractiveExercise | AIReadingInteractiveExercise | null>(null);
  const [currentInteractiveQuestionIndex, setCurrentInteractiveQuestionIndex] = useState(0);
  const [interactiveExerciseFeedback, setInteractiveExerciseFeedback] = useState<{ message: string; isCorrect: boolean; correctAnswerText?: string, explanation?: string } | null>(null);
  
  // MCQ Specific State
  const [selectedMCQOption, setSelectedMCQOption] = useState<string | null>(null);

  // True/False Specific State
  const [selectedTrueFalseAnswer, setSelectedTrueFalseAnswer] = useState<boolean | null>(null);


  const topicName = useMemo(() => 
    userData?.progress[levelId]?.topics[topicId]?.name || 
    DEFAULT_TOPICS[levelId]?.find(t => t.id === topicId)?.name || 
    userData?.customTopics.find(t => t.id === topicId)?.name || 
    "Загрузка...",
  [userData, levelId, topicId]);

  const resetInteractiveStates = () => {
    setActiveMatchingExercise(null);
    setGermanMatchItems([]);
    setRussianMatchItems([]);
    setSelectedGermanItemId(null);
    setIsMatchingChecked(false);

    setActiveAudioQuizExercise(null);
    setCurrentAudioQuizItemIndex(0);
    setSelectedAudioQuizOption(null);
    setAudioQuizItemFeedback(null);

    setActiveInteractiveExercise(null);
    setCurrentInteractiveQuestionIndex(0);
    setInteractiveExerciseFeedback(null);
    setSelectedMCQOption(null);
    setSelectedTrueFalseAnswer(null);
  };

  const fetchLesson = useCallback(async () => {
    setIsLoadingTask(true);
    setLessonContent(null); 
    setCurrentTask(null);
    setFeedback(null);
    resetInteractiveStates();

    if (topicName === "Загрузка...") {
      setIsLoadingTask(false); 
      return;
    }

    const content = await getTopicLessonContent(levelId, topicName);
    setLessonContent(content);

    if (content) {
      if (moduleId === 'vocabulary') {
        const matchingExercise = content.interactiveVocabularyExercises?.find(ex => ex.type === 'matching') as AIMatchingExercise | undefined;
        const audioQuiz = content.interactiveVocabularyExercises?.find(ex => ex.type === 'audioQuiz') as AIAudioQuizExercise | undefined;

        if (matchingExercise) {
          setActiveMatchingExercise(matchingExercise);
          setTotalTasks(1);
          const germanPairs = matchingExercise.pairs.map((p, i) => ({ id: `gp_${i}`, text: p.german, originalText: p.german, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const germanDistractors = (matchingExercise.germanDistractors || []).map((d, i) => ({ id: `gd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setGermanMatchItems(shuffleArray([...germanPairs, ...germanDistractors]));
          const russianPairs = matchingExercise.pairs.map((p, i) => ({ id: `rp_${i}`, text: p.russian, originalText: p.russian, type: 'pair', selected: false, matchedId: null, isPairTarget: true } as MatchItem));
          const russianDistractors = (matchingExercise.russianDistractors || []).map((d, i) => ({ id: `rd_${i}`, text: d, originalText: d, type: 'distractor', selected: false, matchedId: null, isPairTarget: false } as MatchItem));
          setRussianMatchItems(shuffleArray([...russianPairs, ...russianDistractors]));
        } else if (audioQuiz) {
          setActiveAudioQuizExercise(audioQuiz);
          setTotalTasks(audioQuiz.items.length);
        } else {
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
            updateModuleProgress(levelId, topicId, moduleId, 0); setFinalModuleScore(0); setIsModuleFinished(true);
            toast({ title: "Модуль завершен", description: "Слов для этого модуля не найдено.", variant: "default", duration: 5000 });
            setIsLoadingTask(false); return;
          }
          setTotalTasks(availableWordsCount); setCurrentTask(effectiveVocabularyList[0].german);
        }
      } else if (moduleId === 'listening' || moduleId === 'reading') {
        const interactiveExercises = moduleId === 'listening' ? content.interactiveListeningExercises : content.interactiveReadingExercises;
        const mcqExercise = interactiveExercises?.find(ex => ex.type === 'comprehensionMultipleChoice') as AIComprehensionMultipleChoiceExercise | undefined;
        const trueFalseExercise = interactiveExercises?.find(ex => ex.type === 'trueFalse') as AITrueFalseExercise | undefined;

        if (mcqExercise) {
            setActiveInteractiveExercise(mcqExercise);
            setTotalTasks(mcqExercise.questions.length);
        } else if (trueFalseExercise) {
            setActiveInteractiveExercise(trueFalseExercise);
            setTotalTasks(trueFalseExercise.statements.length);
        } else { // Fallback to open-ended questions
            const questionsList = moduleId === 'listening' ? content.listeningExercise?.questions : content.readingQuestions;
            const baseText = moduleId === 'listening' ? content.listeningExercise?.script : content.readingPassage;
            if (baseText && questionsList && questionsList.length > 0) { 
                setTotalTasks(questionsList.length); setCurrentTask(questionsList[0]); 
            } else if (baseText) { 
                setCurrentTask("Какова главная идея этого текста?"); setTotalTasks(1); 
            } else { 
                setCurrentTask(`Нет данных для модуля ${MODULE_NAMES_RU[moduleId]}.`); setTotalTasks(1); 
            }
        }
      } else if (moduleId === 'grammar') { setCurrentTask(content.grammarExplanation); setTotalTasks(1); }
      else if (moduleId === 'writing') { setCurrentTask(content.writingPrompt); setTotalTasks(1); }
    } else {  
      if (moduleId === 'vocabulary') { 
        const wordsFromBank = getWordsForTopic(topicId); setCurrentVocabulary(wordsFromBank);
        const availableWordsCount = wordsFromBank.length;
        if (availableWordsCount > 0) {
          toast({ title: "Загрузка AI-контента не удалась", description: "Модуль будет использовать слова из вашего словаря для этой темы.", variant: "default", duration: 6000 });
          setTotalTasks(availableWordsCount); setCurrentTask(wordsFromBank[0].german);
        } else { updateModuleProgress(levelId, topicId, moduleId, 0); setFinalModuleScore(0); setIsModuleFinished(true); toast({ title: "Модуль завершен", description: "Не удалось загрузить новый контент, и слов в банке для этой темы нет.", variant: "default", duration: 7000 }); setIsLoadingTask(false); return; }
      } else { toast({ title: "Ошибка загрузки урока", description: `Не удалось получить материалы для модуля "${MODULE_NAMES_RU[moduleId]}".`, variant: "destructive", duration: 7000 }); setTotalTasks(1); setCurrentTask(null);  }
    }
    setIsLoadingTask(false);
  }, [levelId, topicName, moduleId, getTopicLessonContent, getWordsForTopic, addWordToBank, topicId, toast, updateModuleProgress]);

  useEffect(() => {
    if (topicName !== "Загрузка...") {
         fetchLesson();
    }
  }, [fetchLesson, topicName]); 
  
 useEffect(() => { 
    setNextSequentialUncompletedModule(null); setTopicContinuationLink(null); setTopicContinuationText('');
    if (isModuleFinished && finalModuleScore !== null && userData) { /* ... existing navigation logic ... */ }
  }, [isModuleFinished, finalModuleScore, userData, levelId, topicId, moduleId, isTopicCompleted, isLevelCompleted, router]);


  const handleRetryModule = () => {
    setIsModuleFinished(false); setFinalModuleScore(null); setTasksCompleted(0); setModuleScore(0); setUserResponse('');
    setNextSequentialUncompletedModule(null); setTopicContinuationLink(null); setTopicContinuationText('');
    fetchLesson(); 
  };

  // --- Matching Exercise Handlers ---
  const handleGermanItemSelect = (itemId: string) => { /* ... */ };
  const handleRussianItemSelect = (russianItemId: string) => { /* ... */ };
  const handleUnmatchPair = (germanItemIdToUnmatch: string) => { /* ... */ };
  const handleMatchingCheck = () => { /* ... */ };

  // --- Audio Quiz Handlers ---
  const handleSelectAudioQuizOption = (option: string) => {
    if (audioQuizItemFeedback) return; // Don't allow change after submission
    setSelectedAudioQuizOption(option);
  };

  const handleSubmitAudioQuizAnswer = () => {
    if (!activeAudioQuizExercise || !selectedAudioQuizOption || audioQuizItemFeedback) return;
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
    if (!activeInteractiveExercise || activeInteractiveExercise.type !== 'comprehensionMultipleChoice' || !selectedMCQOption || interactiveExerciseFeedback) return;
    const currentQuestion = activeInteractiveExercise.questions[currentInteractiveQuestionIndex];
    const isCorrect = selectedMCQOption === currentQuestion.correctAnswer;
    let scoreIncrement = 0;

    if (isCorrect) {
      scoreIncrement = (100 / totalTasks);
      setModuleScore(prev => prev + scoreIncrement);
      setInteractiveExerciseFeedback({ message: "Правильно!", isCorrect: true, explanation: currentQuestion.explanation });
    } else {
      setInteractiveExerciseFeedback({ message: `Неверно. Правильный ответ: ${currentQuestion.correctAnswer}`, isCorrect: false, correctAnswerText: currentQuestion.correctAnswer, explanation: currentQuestion.explanation });
    }
  };

  // --- True/False Handlers (Listening/Reading) ---
  const handleSelectTrueFalseAnswer = (answer: boolean) => {
    if (interactiveExerciseFeedback) return;
    setSelectedTrueFalseAnswer(answer);
  };

  const handleSubmitTrueFalseAnswer = () => {
    if (!activeInteractiveExercise || activeInteractiveExercise.type !== 'trueFalse' || selectedTrueFalseAnswer === null || interactiveExerciseFeedback) return;
    const currentStatement = activeInteractiveExercise.statements[currentInteractiveQuestionIndex];
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
  };
  
  // --- Common Handler for Next Interactive Item (MCQ, True/False, later Sequencing) ---
  const handleNextInteractiveItem = () => {
    setInteractiveExerciseFeedback(null);
    setSelectedMCQOption(null); // Reset MCQ specific state
    setSelectedTrueFalseAnswer(null); // Reset True/False specific state
    // Add resets for other interactive types here in the future

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
    if (!currentTask || isModuleFinished || activeMatchingExercise || activeAudioQuizExercise || activeInteractiveExercise) return;
    setIsLoadingTask(true); setFeedback(null);
    let questionContext = ''; let expectedAnswerForAI = ''; let grammarRulesForAI: string | undefined = undefined;
    
    if (moduleId === 'vocabulary' || moduleId === 'wordTest') { /* ... */ } 
    else if (moduleId === 'grammar') { /* ... */ }
    else if (moduleId === 'listening') { /* ... */  if (lessonContent?.listeningExercise && lessonContent.listeningExercise.questions && lessonContent.listeningExercise.questions[tasksCompleted]) { questionContext = `Скрипт: "${lessonContent.listeningExercise.script}". Вопрос: "${lessonContent.listeningExercise.questions[tasksCompleted]}"`; } else { toast({ title: "Ошибка данных урока", description: "Нет данных для аудирования для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; } }
    else if (moduleId === 'reading') { /* ... */  if (lessonContent?.readingPassage && lessonContent.readingQuestions && lessonContent.readingQuestions[tasksCompleted]) { questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${lessonContent.readingQuestions[tasksCompleted]}"`; } else if (lessonContent?.readingPassage) { questionContext = `Текст для чтения: "${lessonContent.readingPassage}". Вопрос по тексту: "${currentTask}"`; } else { toast({ title: "Ошибка данных урока", description: "Нет данных для чтения для оценки.", variant: "destructive" }); setIsLoadingTask(false); return; } }
    else if (moduleId === 'writing') { /* ... */ }
    
    const evaluation = await evaluateUserResponse(levelId, topicId, moduleId, userResponse, questionContext, expectedAnswerForAI, grammarRulesForAI);
    if (!evaluation) { toast({ title: "Ошибка оценки ответа", variant: "destructive" }); setIsLoadingTask(false); return;  }
    setFeedback(evaluation); setIsLoadingTask(false);
    
    let scoreIncrement = 0;
    if (evaluation?.isCorrect) { /* ... */ } else { /* ... */ }
    setUserResponse(''); 
    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);

    if (newTasksCompleted >= totalTasks) { /* ... module finished logic ... */ } 
    else { 
      if ((moduleId === 'vocabulary' || moduleId === 'wordTest')) { /* ... */ } 
      else if (moduleId === 'listening' || moduleId === 'reading') {
        const questionsList = moduleId === 'listening' ? lessonContent?.listeningExercise?.questions : lessonContent?.readingQuestions; 
        if (questionsList && questionsList.length > newTasksCompleted) { setCurrentTask(questionsList[newTasksCompleted]); }
        else { setIsModuleFinished(true); const finalScoreFallback = Math.round(moduleScore); updateModuleProgress(levelId, topicId, moduleId, finalScoreFallback); setFinalModuleScore(finalScoreFallback); toast({title: `Неожиданное завершение модуля (${MODULE_NAMES_RU[moduleId]})`, description: "Вопросы закончились раньше."}); }
      }
    }
  };

  const renderModuleContent = () => {
    // --- Vocabulary: Matching Exercise ---
    if (moduleId === 'vocabulary' && activeMatchingExercise) { /* ... existing matching UI ... */ }
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
                disabled={!!audioQuizItemFeedback}
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
    if ((moduleId === 'listening' || moduleId === 'reading') && activeInteractiveExercise) {
        const baseText = moduleId === 'listening' ? lessonContent?.listeningExercise?.script : lessonContent?.readingPassage;
        return (
            <div>
                <h3 className="text-xl font-semibold mb-2">{activeInteractiveExercise.instructions}</h3>
                <p className="text-center text-muted-foreground mb-4">Задание {currentInteractiveQuestionIndex + 1} из {totalTasks}</p>
                
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
                {activeInteractiveExercise.type === 'comprehensionMultipleChoice' && (() => {
                    const currentQuestion = activeInteractiveExercise.questions[currentInteractiveQuestionIndex];
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
                                    disabled={!!interactiveExerciseFeedback}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    );
                })()}

                {/* True/False Rendering */}
                {activeInteractiveExercise.type === 'trueFalse' && (() => {
                    const currentStatement = activeInteractiveExercise.statements[currentInteractiveQuestionIndex];
                    if (!currentStatement) return <p>Ошибка: утверждение не найдено.</p>;
                    return (
                        <div className="space-y-3 mb-6">
                            <p className="font-medium text-lg mb-4 text-center p-3 border rounded-md bg-card-foreground/5">{currentStatement.statement}</p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    variant={selectedTrueFalseAnswer === true ? "default" : "outline"}
                                    className="p-4 h-auto text-base min-w-[120px]"
                                    onClick={() => handleSelectTrueFalseAnswer(true)}
                                    disabled={!!interactiveExerciseFeedback}
                                >
                                    <ThumbsUp className="mr-2 h-5 w-5"/> Верно
                                </Button>
                                <Button
                                    variant={selectedTrueFalseAnswer === false ? "destructive" : "outline"}
                                    className="p-4 h-auto text-base min-w-[120px]"
                                    onClick={() => handleSelectTrueFalseAnswer(false)}
                                    disabled={!!interactiveExerciseFeedback}
                                >
                                     <ThumbsDown className="mr-2 h-5 w-5"/> Неверно
                                </Button>
                            </div>
                        </div>
                    );
                })()}
                
                {/* TODO: Sequencing Rendering will go here */}

                {interactiveExerciseFeedback && (
                    <Card className={`mb-4 ${interactiveExerciseFeedback.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                        <CardContent className="p-4">
                            <p className={`font-semibold ${interactiveExerciseFeedback.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {interactiveExerciseFeedback.message}
                            </p>
                            {interactiveExerciseFeedback.explanation && <p className="text-sm mt-1 text-muted-foreground">Пояснение: {interactiveExerciseFeedback.explanation}</p>}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    // --- Fallback to Standard Vocabulary / Other Modules (Non-interactive or not yet implemented interactive) ---
    if (!lessonContent && ( (moduleId !== 'vocabulary' && moduleId !== 'wordTest') || ((moduleId === 'vocabulary' || moduleId === 'wordTest') && currentVocabulary.length === 0) ) ) { /* ... */ }
    switch (moduleId) {
      case 'vocabulary': case 'wordTest': { /* ... standard vocab/wordtest UI ... */ }
      case 'grammar': { /* ... standard grammar UI ... */ }
      case 'listening': { /* ... standard listening UI (if no interactive exercise) ... */ if (!lessonContent?.listeningExercise || !lessonContent.listeningExercise.script) return <p className="text-center p-4 text-muted-foreground">Загрузка аудирования...</p>; const currentListeningQuestion = lessonContent.listeningExercise.questions?.[tasksCompleted]; return (<div> <h3 className="text-xl font-semibold mb-2">Аудирование:</h3> <p className="mb-1">Прослушайте текст:</p> <div className="prose dark:prose-invert max-w-none mb-2 p-3 border rounded-md bg-card-foreground/5 text-sm">{lessonContent.listeningExercise.script}</div> <Button onClick={() => speak(lessonContent.listeningExercise.script, 'de-DE')} className="mb-4"><Speaker className="mr-2 h-4 w-4" /> Прослушать текст</Button> {currentListeningQuestion && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )} {!currentTask && tasksCompleted < totalTasks && <p className="text-muted-foreground">Загрузка вопроса...</p>} {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы прослушаны.</p>} </div>); }
      case 'reading': { /* ... standard reading UI (if no interactive exercise) ... */ if (!lessonContent?.readingPassage) return <p className="text-center p-4 text-muted-foreground">Загрузка текста для чтения...</p>; return (<div> <h3 className="text-xl font-semibold mb-2">Чтение:</h3> <div className="prose dark:prose-invert max-w-none mb-4 p-4 border rounded-md bg-card-foreground/5" dangerouslySetInnerHTML={{ __html: lessonContent.readingPassage.replace(/\n/g, '<br />') }} /> {currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && ( <p className="text-lg mb-2">Вопрос {tasksCompleted + 1}: {currentTask}</p> )} {!currentTask && tasksCompleted < totalTasks && lessonContent.readingQuestions && lessonContent.readingQuestions.length > 0 && <p className="text-muted-foreground">Загрузка вопроса...</p>} {(!lessonContent.readingQuestions || lessonContent.readingQuestions.length === 0) && tasksCompleted < totalTasks && ( <p className="text-lg mb-2">Вопрос: {currentTask}</p>  )} {tasksCompleted >= totalTasks && <p className="text-muted-foreground">Все вопросы пройдены.</p>} </div>); }
      case 'writing': { /* ... standard writing UI ... */ }
      default: return <p>Тип модуля неизвестен.</p>;
    }
  };

  const moduleTitle = MODULE_NAMES_RU[moduleId] || "Модуль";
  const progressPercent = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;
  let placeholderText = "Ваш ответ...";
  if (moduleId === 'wordTest') placeholderText = "Введите перевод на русский...";
  if (activeMatchingExercise || activeAudioQuizExercise || activeInteractiveExercise) placeholderText = ""; // No textarea for these

  if (isLoadingTask && topicName === "Загрузка...") { /* ... Skeleton UI ... */ }
  if (isLoadingTask) { /* ... Skeleton UI ... */ }

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
            {activeMatchingExercise ? " Упражнение на сопоставление." : 
             activeAudioQuizExercise ? `Аудио-квиз: Задание ${currentAudioQuizItemIndex + 1} из ${totalTasks}.` :
             activeInteractiveExercise ? `Интерактивное упражнение: Задание ${currentInteractiveQuestionIndex + 1} из ${totalTasks}.` :
             `Задание ${tasksCompleted + 1} из ${totalTasks}.`}
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
              {placeholderText && ( 
                <Textarea
                  placeholder={placeholderText} value={userResponse} onChange={(e) => setUserResponse(e.target.value)}
                  className="mb-4 min-h-[100px]"
                  disabled={isLoadingTask || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                />
              )}
            </>
          ) : ( 
            <div className="text-center p-6"> {/* ... Module Finished UI ... */} </div>
          )}
          {feedback && !isModuleFinished && !activeMatchingExercise && !activeAudioQuizExercise && !activeInteractiveExercise && ( 
            <Card className={`mb-4 ${feedback.isCorrect ? 'border-green-500' : 'border-red-500'}`}> {/* ... Feedback UI ... */} </Card>
          )}
        </CardContent>
        {!isModuleFinished && (
          <CardFooter>
            {/* Matching Exercise Button */}
            {activeMatchingExercise && moduleId === 'vocabulary' && !isMatchingChecked && (
              <Button onClick={handleMatchingCheck} className="w-full" size="lg">Проверить сопоставления</Button>
            )}
            {/* Audio Quiz Buttons */}
            {activeAudioQuizExercise && moduleId === 'vocabulary' && (
              !audioQuizItemFeedback ? (
                <Button onClick={handleSubmitAudioQuizAnswer} className="w-full" size="lg" disabled={!selectedAudioQuizOption}>Проверить ответ</Button>
              ) : (
                <Button onClick={handleNextAudioQuizItem} className="w-full" size="lg">Следующий вопрос</Button>
              )
            )}
            {/* Interactive Listening/Reading Buttons */}
            {activeInteractiveExercise && (moduleId === 'listening' || moduleId === 'reading') && (
                !interactiveExerciseFeedback ? (
                    activeInteractiveExercise.type === 'comprehensionMultipleChoice' ? (
                        <Button onClick={handleSubmitMCQAnswer} className="w-full" size="lg" disabled={!selectedMCQOption}>Проверить ответ</Button>
                    ) : activeInteractiveExercise.type === 'trueFalse' ? (
                        <Button onClick={handleSubmitTrueFalseAnswer} className="w-full" size="lg" disabled={selectedTrueFalseAnswer === null}>Проверить ответ</Button>
                    ) : null // Placeholder for future sequencing button
                ) : (
                     <Button onClick={handleNextInteractiveItem} className="w-full" size="lg">Следующее задание</Button>
                )
            )}
            {/* Standard Task Button */}
            {!activeMatchingExercise && !activeAudioQuizExercise && !activeInteractiveExercise && (
              <Button 
                onClick={handleSubmit} 
                disabled={isLoadingTask || !userResponse.trim() || tasksCompleted >= totalTasks || (!currentTask && (moduleId === 'listening' || (moduleId === 'reading' && lessonContent?.readingQuestions && lessonContent.readingQuestions.length > 0)))}
                className="w-full" size="lg"
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
    

    