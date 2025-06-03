
"use client";

import type { ReactNode } from 'react';
import { UserDataProvider } from '@/context/user-data-context';
import { ThemeProvider } from 'next-themes';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UserDataProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </UserDataProvider>
  );
}
