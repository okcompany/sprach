
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserData } from '@/context/user-data-context';
import type { VocabularyWord, LanguageLevel } from '@/types/german-learning';
import { DEFAULT_TOPICS } from '@/types/german-learning';
import { Speaker, CheckCircle, AlertCircle, RotateCcw, Lightbulb, Send, ArrowRight, BookCopy, Sparkles, Repeat as RepeatIcon, CheckCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

// Dummy TTS function - replace with actual implementation from module-page or central util
const speak = (text: string, lang: 'ru-RU' | 'de-DE') => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  } else {
    console.warn("TTS not available.");
  }
};

export function VocabularyPage() {
  const { userData, isLoading, getWordsForReview, updateWordInBank, markWordAsMastered } = useUserData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Review Session State
  const [isReviewSessionActive, setIsReviewSessionActive] = useState(false);
  const [reviewWordsQueue, setReviewWordsQueue] = useState<VocabularyWord[]>([]);
  const [currentReviewWordIndex, setCurrentReviewWordIndex] = useState(0);
  const [userReviewInput, setUserReviewInput] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  const currentReviewWord = useMemo(() => {
    if (isReviewSessionActive && reviewWordsQueue.length > 0 && currentReviewWordIndex < reviewWordsQueue.length) {
      return reviewWordsQueue[currentReviewWordIndex];
    }
    return null;
  }, [isReviewSessionActive, reviewWordsQueue, currentReviewWordIndex]);

  const allWords = useMemo(() => userData?.vocabularyBank || [], [userData]);
  const wordsForReview = useMemo(() => getWordsForReview(), [getWordsForReview]);
  
  const wordsForCurrentTopic = useMemo(() => {
    if (!userData?.currentTopicId) return [];
    return allWords.filter(word => word.topic === userData.currentTopicId);
  }, [allWords, userData?.currentTopicId]);

  const errorWords = useMemo(() => {
    return allWords.filter(word => (word.errorCount || 0) > 0 && (word.consecutiveCorrectAnswers || 0) < 3);
  }, [allWords]);

  const filteredWords = (words: VocabularyWord[]) => {
    if (!searchTerm) return words;
    return words.filter(word => 
      word.german.toLowerCase().includes(searchTerm.toLowerCase()) ||
      word.russian.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const startReviewSession = () => {
    if (wordsForReview.length === 0) {
      toast({ title: "Словарь для повторения пуст", description: "Нет слов для повторения.", variant: "default" });
      return;
    }
    const shuffledWords = [...wordsForReview].sort(() => Math.random() - 0.5);
    setReviewWordsQueue(shuffledWords);
    setCurrentReviewWordIndex(0);
    setUserReviewInput('');
    setReviewFeedback(null);
    setShowCorrectAnswer(false);
    setIsReviewSessionActive(true);
    toast({ title: "Сессия повторения начата!", description: `Слов для повторения: ${shuffledWords.length}` });
  };

  const handleReviewSubmit = () => {
    if (!currentReviewWord) return;

    const isCorrect = userReviewInput.trim().toLowerCase() === currentReviewWord.russian.trim().toLowerCase();
    let feedbackMsg = '';
    let updatedWord = { ...currentReviewWord };

    if (isCorrect) {
      feedbackMsg = "Правильно!";
      updatedWord.consecutiveCorrectAnswers = (updatedWord.consecutiveCorrectAnswers || 0) + 1;
      updatedWord.errorCount = Math.max(0, (updatedWord.errorCount || 0) - (updatedWord.errorCount > 1 ? 1 : 0) ); // Optionally reduce error count on correct
      toast({ title: "Отлично!", description: "Верный ответ.", variant: "default" });
    } else {
      feedbackMsg = `Неправильно. Правильный ответ: ${currentReviewWord.russian}`;
      updatedWord.consecutiveCorrectAnswers = 0;
      updatedWord.errorCount = (updatedWord.errorCount || 0) + 1;
      toast({ title: "Ошибка", description: `Правильный ответ: ${currentReviewWord.russian}`, variant: "destructive" });
    }
    
    updatedWord.lastTestedDate = new Date().toISOString();
    updateWordInBank(updatedWord);
    setReviewFeedback(feedbackMsg);
    setShowCorrectAnswer(true);
  };

  const handleShowAnswer = () => {
    if (!currentReviewWord) return;
    let updatedWord = { 
      ...currentReviewWord, 
      consecutiveCorrectAnswers: 0, 
      errorCount: (currentReviewWord.errorCount || 0) + 1,
      lastTestedDate: new Date().toISOString() 
    };
    updateWordInBank(updatedWord);
    setReviewFeedback(`Правильный ответ: ${currentReviewWord.russian}`);
    setShowCorrectAnswer(true);
    toast({ title: "Показан ответ", description: `Слово "${currentReviewWord.german}" отмечено как требующее внимания.`, variant: "default" });
  };

  const handleNextWord = () => {
    if (currentReviewWordIndex < reviewWordsQueue.length - 1) {
      setCurrentReviewWordIndex(prevIndex => prevIndex + 1);
      setUserReviewInput('');
      setReviewFeedback(null);
      setShowCorrectAnswer(false);
    } else {
      setIsReviewSessionActive(false);
      toast({ title: "Сессия завершена!", description: "Отличная работа! Все слова пройдены.", duration: 5000 });
    }
  };
  
  const handleMarkAsMastered = (wordId: string) => {
    markWordAsMastered(wordId);
    toast({
        title: "Слово отмечено как выученное",
        description: "Оно больше не будет активно предлагаться для повторения.",
    });
  };

  const getDisplayTopicName = (level: LanguageLevel, topicId: string): string => {
    if (!userData) return topicId; 

    const progressTopicName = userData.progress[level]?.topics[topicId]?.name;
    if (progressTopicName) return progressTopicName;

    const defaultTopic = DEFAULT_TOPICS[level]?.find(t => t.id === topicId);
    if (defaultTopic) return defaultTopic.name;

    const customTopic = userData.customTopics.find(t => t.id === topicId);
    if (customTopic) return customTopic.name;
    
    return topicId; 
  };

  const WordCardDisplay = ({ word }: { word: VocabularyWord }) => {
    const displayTopicName = getDisplayTopicName(word.level, word.topic);
    const isMastered = (word.consecutiveCorrectAnswers || 0) >= 3;

    return (
      <Card className="mb-4 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center">
                <h3 className="text-xl font-semibold font-headline">{word.german}</h3>
                <Button variant="ghost" size="icon" onClick={() => speak(word.german, 'de-DE')} className="ml-2">
                  <Speaker className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-muted-foreground">{word.russian}</p>
            </div>
            <div className="text-xs text-right text-muted-foreground">
              <p>Уровень: {word.level}</p>
              <p className="truncate max-w-[150px]" title={displayTopicName}>
                Тема: {displayTopicName}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                  <CheckCircle className={`h-4 w-4 ${ (word.consecutiveCorrectAnswers || 0) > 0 ? 'text-green-500' : 'text-muted'}`} />
                  <span>Верно подряд: {word.consecutiveCorrectAnswers || 0}</span>
              </div>
               <div className="flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${(word.errorCount || 0) > 0 ? 'text-red-500' : 'text-muted'}`} />
                   <span>Ошибок: {word.errorCount || 0}</span>
              </div>
          </div>
          {isMastered && (
            <div className="mt-3">
              <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400 dark:border-green-500/30 px-2.5 py-1 text-xs">
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Освоено
              </Badge>
            </div>
          )}
          {word.exampleSentence && <p className="text-sm mt-2 italic">Пример: {word.exampleSentence}</p>}
           {!isMastered && (
              <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleMarkAsMastered(word.id)} 
                  className="mt-3 text-xs"
              >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Отметить как выученное
              </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="text-center p-10">Загрузка словаря...</div>;
  }

  const totalWordsCount = allWords.length;
  const masteredWordsCount = allWords.filter(w => (w.consecutiveCorrectAnswers || 0) >= 3).length;
  const wordsNeedingReviewCount = wordsForReview.length;


  if (isReviewSessionActive && currentReviewWord) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-center">Сессия повторения</CardTitle>
            <CardDescription className="text-center">
              Слово {currentReviewWordIndex + 1} из {reviewWordsQueue.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
                <h2 className="text-4xl font-bold font-headline">{currentReviewWord.german}</h2>
                <Button variant="ghost" size="icon" onClick={() => speak(currentReviewWord.german, 'de-DE')}>
                    <Speaker className="h-8 w-8" />
                </Button>
            </div>
            {currentReviewWord.exampleSentence && (
                <p className="text-sm italic text-muted-foreground mb-4">Пример: {currentReviewWord.exampleSentence}</p>
            )}
            
            {!showCorrectAnswer ? (
              <Input 
                type="text"
                placeholder="Введите перевод на русский..."
                value={userReviewInput}
                onChange={(e) => setUserReviewInput(e.target.value)}
                className="text-lg text-center h-12 mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleReviewSubmit()}
              />
            ) : (
              <div className={`p-3 rounded-md text-lg mb-4 ${reviewFeedback?.toLowerCase().includes("правильно") ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {reviewFeedback}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {!showCorrectAnswer ? (
              <>
                <Button onClick={handleReviewSubmit} className="w-full" size="lg" disabled={!userReviewInput.trim()}>
                  <Send className="mr-2" /> Проверить
                </Button>
                <Button variant="outline" onClick={handleShowAnswer} className="w-full">
                  <Lightbulb className="mr-2" /> Не помню / Показать ответ
                </Button>
              </>
            ) : (
              <Button onClick={handleNextWord} className="w-full" size="lg">
                Следующее слово <ArrowRight className="ml-2" />
              </Button>
            )}
             <Button variant="ghost" onClick={() => setIsReviewSessionActive(false)} className="w-full mt-2 text-muted-foreground">
                Завершить сессию
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-6 text-center">Мой словарь</h1>
      
      <Card className="mb-8 shadow-md bg-card">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-center">Статистика</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <BookCopy className="h-8 w-8 mb-2 text-primary" />
            <p className="text-2xl font-bold">{totalWordsCount}</p>
            <p className="text-sm text-muted-foreground">Всего слов</p>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <Sparkles className="h-8 w-8 mb-2 text-accent" />
            <p className="text-2xl font-bold">{masteredWordsCount}</p>
            <p className="text-sm text-muted-foreground">Освоено</p>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <RepeatIcon className="h-8 w-8 mb-2 text-destructive" />
            <p className="text-2xl font-bold">{wordsNeedingReviewCount}</p>
            <p className="text-sm text-muted-foreground">На повторении</p>
          </div>
        </CardContent>
      </Card>

      <Input 
        placeholder="Поиск слова..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6 max-w-md mx-auto"
      />
      <Tabs defaultValue="currentTopic" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
          <TabsTrigger value="currentTopic">Текущая тема</TabsTrigger>
          <TabsTrigger value="errors">Ошибки</TabsTrigger>
          <TabsTrigger value="review">На повторение</TabsTrigger>
          <TabsTrigger value="all">Все слова</TabsTrigger>
        </TabsList>
        
        <TabsContent value="currentTopic">
          <Card>
            <CardHeader><CardTitle>Слова текущей темы</CardTitle><CardDescription>Слова, связанные с активной темой ({getDisplayTopicName(userData?.currentLevel || 'A0', userData?.currentTopicId || "")})</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(wordsForCurrentTopic).length === 0 && <p className="text-muted-foreground text-center py-4">Нет слов для текущей темы или по вашему запросу.</p>}
              {filteredWords(wordsForCurrentTopic).map(word => <WordCardDisplay key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader><CardTitle>Слова с ошибками</CardTitle><CardDescription>Слова, в которых вы недавно допускали ошибки и которые еще не освоены.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(errorWords).length === 0 && <p className="text-muted-foreground text-center py-4">Нет слов с ошибками или по вашему запросу. Отлично!</p>}
              {filteredWords(errorWords).map(word => <WordCardDisplay key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader><CardTitle>Слова на повторение</CardTitle><CardDescription>Слова, которые требуют вашего внимания для закрепления.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(wordsForReview).length === 0 && <p className="text-muted-foreground text-center py-4">Нет слов для повторения или по вашему запросу. Все слова усвоены!</p>}
              {filteredWords(wordsForReview).map(word => <WordCardDisplay key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
           <Card>
            <CardHeader><CardTitle>Все изученные слова</CardTitle><CardDescription>Полный список всех слов в вашем словаре.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(allWords).length === 0 && <p className="text-muted-foreground text-center py-4">Ваш словарь пуст или нет слов по вашему запросу.</p>}
              {filteredWords(allWords).map(word => <WordCardDisplay key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
       <div className="mt-8 text-center">
            <Button 
                onClick={startReviewSession} 
                size="lg" 
                className="shadow-md"
                disabled={wordsNeedingReviewCount === 0}
            >
                <RotateCcw className="mr-2 h-5 w-5" /> Начать сессию повторения
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
                {wordsNeedingReviewCount > 0 
                    ? `Доступно слов для повторения: ${wordsNeedingReviewCount}.`
                    : "Отлично! Все слова, требующие повторения, пройдены."}
            </p>
        </div>
    </div>
  );
}

