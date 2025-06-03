
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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


export function SettingsPage() {
  const { userData, resetProgress, updateUserData, isLoading } = useUserData();
  const { toast } = useToast();

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
  
  // Dark mode toggle can be added here if desired
  // const handleDarkModeToggle = (checked: boolean) => { ... }


  if (isLoading) {
    return <div>Загрузка настроек...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">Настройки</h1>
      
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

      {/* Example for Dark Mode Toggle - can be expanded
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Тема оформления</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch id="darkmode-switch" />
            <Label htmlFor="darkmode-switch">Темная тема</Label>
          </div>
        </CardContent>
      </Card>
      */}

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
                <AlertDialogAction onClick={handleResetProgress} className={Button({variant: "destructive"}).className}>Да, сбросить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
