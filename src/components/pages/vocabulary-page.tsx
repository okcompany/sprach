
"use client";

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserData } from '@/context/user-data-context';
import type { VocabularyWord } from '@/types/german-learning';
import { Speaker, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';

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
  const { userData, isLoading, getWordsForReview, updateWordInBank } = useUserData();
  const [searchTerm, setSearchTerm] = useState('');

  const allWords = useMemo(() => userData?.vocabularyBank || [], [userData]);
  
  const wordsForCurrentTopic = useMemo(() => {
    if (!userData?.currentTopicId) return [];
    return allWords.filter(word => word.topic === userData.currentTopicId);
  }, [allWords, userData?.currentTopicId]);

  const errorWords = useMemo(() => {
    return allWords.filter(word => word.errorCount > 0 && word.consecutiveCorrectAnswers < 3);
  }, [allWords]);

  const reviewWords = useMemo(() => {
    // Words that are not yet mastered (less than 3 consecutive correct answers)
    return allWords.filter(word => word.consecutiveCorrectAnswers < 3);
  }, [allWords]);


  const filteredWords = (words: VocabularyWord[]) => {
    if (!searchTerm) return words;
    return words.filter(word => 
      word.german.toLowerCase().includes(searchTerm.toLowerCase()) ||
      word.russian.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const WordCard = ({ word }: { word: VocabularyWord }) => (
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
          <div className="text-xs text-muted-foreground">
            <p>Уровень: {word.level}</p>
            <p>Тема: {userData?.progress[word.level]?.topics[word.topic]?.name || word.topic}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
                <CheckCircle className={`h-4 w-4 ${word.consecutiveCorrectAnswers > 0 ? 'text-green-500' : 'text-muted'}`} />
                <span>Верно подряд: {word.consecutiveCorrectAnswers}</span>
            </div>
             <div className="flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${word.errorCount > 0 ? 'text-red-500' : 'text-muted'}`} />
                 <span>Ошибок: {word.errorCount}</span>
            </div>
        </div>
        {word.exampleSentence && <p className="text-sm mt-1 italic">Пример: {word.exampleSentence}</p>}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div>Загрузка словаря...</div>;
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">Мой словарь</h1>
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
            <CardHeader><CardTitle>Слова текущей темы</CardTitle><CardDescription>Слова, связанные с активной темой ({userData?.progress[userData?.currentLevel]?.topics[userData?.currentTopicId || ""]?.name || "не выбрана"})</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(wordsForCurrentTopic).length === 0 && <p>Нет слов для текущей темы или по вашему запросу.</p>}
              {filteredWords(wordsForCurrentTopic).map(word => <WordCard key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader><CardTitle>Слова с ошибками</CardTitle><CardDescription>Слова, в которых вы недавно допускали ошибки.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(errorWords).length === 0 && <p>Нет слов с ошибками или по вашему запросу. Отлично!</p>}
              {filteredWords(errorWords).map(word => <WordCard key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader><CardTitle>Слова на повторение</CardTitle><CardDescription>Слова, которые требуют вашего внимания для закрепления.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(reviewWords).length === 0 && <p>Нет слов для повторения или по вашему запросу.</p>}
              {filteredWords(reviewWords).map(word => <WordCard key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
           <Card>
            <CardHeader><CardTitle>Все изученные слова</CardTitle><CardDescription>Полный список всех слов в вашем словаре.</CardDescription></CardHeader>
            <CardContent>
              {filteredWords(allWords).length === 0 && <p>Ваш словарь пуст или нет слов по вашему запросу.</p>}
              {filteredWords(allWords).map(word => <WordCard key={word.id} word={word} />)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
       <div className="mt-8 text-center">
            <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" /> Начать сессию повторения (Интервальное повторение)
            </Button>
            <p className="text-sm text-muted-foreground mt-2">ИИ подберет слова, которые вам нужно повторить.</p>
        </div>
    </div>
  );
}
