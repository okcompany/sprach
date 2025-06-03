
"use client";

import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useUserData } from '@/context/user-data-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { XCircle, PlusCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';


export function SettingsPage() {
  const { userData, resetProgress, updateUserData, isLoading } = useUserData();
  const { toast } = useToast();
  const [newPreferredTopic, setNewPreferredTopic] = useState('');

  const handleResetProgress = () => {
    resetProgress();
    toast({
      title: "Прогресс сброшен",
      description: "Все ваши данные удалены. Вы можете начать обучение заново.",
      duration: 5000,
    });
  };

  const handleNotificationsToggle = (checked: boolean) => {
    if (userData) {
      updateUserData({ settings: { ...userData.settings, notificationsEnabled: checked } });
      toast({
        title: `Уведомления ${checked ? 'включены' : 'выключены'}`,
      });
    }
  };

  const handleAddPreferredTopic = () => {
    if (newPreferredTopic.trim() && userData) {
      const currentTopics = userData.profile.preferredTopics || [];
      if (!currentTopics.includes(newPreferredTopic.trim())) {
        updateUserData({ 
          profile: { 
            ...userData.profile, 
            preferredTopics: [...currentTopics, newPreferredTopic.trim()] 
          } 
        });
        setNewPreferredTopic('');
        toast({ title: "Предпочитаемая тема добавлена" });
      } else {
        toast({ title: "Эта тема уже в списке", variant: "destructive" });
      }
    }
  };

  const handleRemovePreferredTopic = (topicToRemove: string) => {
    if (userData) {
      updateUserData({
        profile: {
          ...userData.profile,
          preferredTopics: (userData.profile.preferredTopics || []).filter(topic => topic !== topicToRemove)
        }
      });
      toast({ title: "Предпочитаемая тема удалена" });
    }
  };
  
  if (isLoading) {
    return <div>Загрузка настроек...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">Настройки</h1>

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Внешний вид</CardTitle>
          <CardDescription>Выберите тему оформления приложения.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="theme-toggle-button">Тема:</Label>
          <ThemeToggle />
        </CardContent>
      </Card>
      
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Уведомления</CardTitle>
          <CardDescription>Управляйте напоминаниями и уведомлениями приложения.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch 
              id="notifications-switch" 
              checked={userData?.settings?.notificationsEnabled ?? true}
              onCheckedChange={handleNotificationsToggle}
            />
            <Label htmlFor="notifications-switch">Включить уведомления</Label>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Напоминания о необходимости повторить слова или продолжить урок.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Предпочитаемые темы</CardTitle>
          <CardDescription>Укажите темы, которые ИИ будет учитывать при подборе уроков.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input 
              placeholder="Например, 'Искусство', 'Спорт', 'Бизнес'"
              value={newPreferredTopic}
              onChange={(e) => setNewPreferredTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPreferredTopic()}
            />
            <Button onClick={handleAddPreferredTopic} disabled={!newPreferredTopic.trim()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Добавить
            </Button>
          </div>
          {userData?.profile?.preferredTopics && userData.profile.preferredTopics.length > 0 ? (
            <ul className="space-y-2">
              {userData.profile.preferredTopics.map(topic => (
                <li key={topic} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                  <span className="text-sm">{topic}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemovePreferredTopic(topic)}>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Удалить</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Вы еще не добавили предпочитаемые темы.</p>
          )}
        </CardContent>
      </Card>


      <Card className="border-destructive shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-destructive">Сброс прогресса</CardTitle>
          <CardDescription>Это действие необратимо удалит все ваши данные обучения.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Если вы хотите начать обучение с самого начала, вы можете сбросить весь свой прогресс. 
            Все изученные слова, пройденные темы и уровни будут удалены.
          </p>
        </CardContent>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Сбросить мой прогресс</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие нельзя отменить. Весь ваш прогресс обучения будет безвозвратно удален.
                  Вы действительно хотите сбросить все данные?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetProgress} className={buttonVariants({ variant: "destructive" })}>Да, сбросить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
