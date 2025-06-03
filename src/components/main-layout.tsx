
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Layers, BookOpenText, Settings as SettingsIcon, Sparkles, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useUserData } from '@/context/user-data-context';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/levels', label: 'Уровни', icon: Layers },
  { href: '/vocabulary', label: 'Словарь', icon: BookOpenText },
  { href: '/settings', label: 'Настройки', icon: SettingsIcon },
];

export function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userData, isLoading } = useUserData();

  const renderNavLinks = (isMobile = false) => (
    <nav className={cn("flex flex-col gap-2", isMobile ? "p-4" : "px-2 py-4")}>
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant={pathname === item.href ? 'secondary' : 'ghost'}
          className="w-full justify-start text-sm"
          asChild
        >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Sparkles className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground fixed">
        <div className="flex h-16 items-center border-b px-6 bg-primary text-primary-foreground">
          <Link href="/" className="flex items-center gap-2 font-headline text-lg font-semibold">
            <Image src="https://placehold.co/32x32.png" alt="Sprachheld Logo" width={32} height={32} data-ai-hint="logo language" className="rounded-sm"/>
            Sprachheld
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {renderNavLinks()}
        </div>
        <div className="mt-auto p-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/70">Уровень: {userData?.currentLevel}</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col md:ml-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-6 md:hidden">
          <Link href="/" className="flex items-center gap-2 font-headline text-lg font-semibold">
             <Image src="https://placehold.co/32x32.png" alt="Sprachheld Logo" width={32} height={32} data-ai-hint="logo language" className="rounded-sm"/>
            Sprachheld
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Открыть меню навигации</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 bg-sidebar text-sidebar-foreground">
              <div className="flex h-16 items-center border-b px-6 bg-primary text-primary-foreground">
                <Link href="/" className="flex items-center gap-2 font-headline text-lg font-semibold">
                   <Image src="https://placehold.co/32x32.png" alt="Sprachheld Logo" width={32} height={32} data-ai-hint="logo language" className="rounded-sm"/>
                  Sprachheld
                </Link>
              </div>
              {renderNavLinks(true)}
              <div className="mt-auto p-4 border-t border-sidebar-border">
                 <p className="text-xs text-sidebar-foreground/70">Уровень: {userData?.currentLevel}</p>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
