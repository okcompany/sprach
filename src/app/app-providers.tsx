
"use client";

import type { ReactNode } from 'react';
import { UserDataProvider } from '@/context/user-data-context';
// Import other providers here if needed, e.g., ThemeProvider for dark mode

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UserDataProvider>
      {/* <ThemeProvider attribute="class" defaultTheme="system" enableSystem> */}
        {children}
      {/* </ThemeProvider> */}
    </UserDataProvider>
  );
}
