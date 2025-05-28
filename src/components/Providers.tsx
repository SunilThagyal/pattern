"use client";

import type { ReactNode } from 'react';
import { Toaster } from "@/components/ui/toaster";
// import { ThemeProvider } from "next-themes"; // Example if dark mode toggle is added

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {/* <ThemeProvider attribute="class" defaultTheme="light" enableSystem> */}
        {children}
        <Toaster />
      {/* </ThemeProvider> */}
    </>
  );
}
