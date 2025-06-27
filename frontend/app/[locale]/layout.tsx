import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/providers/themeProvider"
import "../globals.css"
import { ReactNode } from 'react';
import path from 'path';
import fs from 'fs';
import I18nProviderWrapper from "@/components/providers/I18nProviderWrapper"

const inter = Inter({ subsets: ["latin"] })

// Dynamic metadata based on locale
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  let messages: any = {}
  if (['zh', 'en'].includes(locale)) {
    const filePath = path.join(process.cwd(), 'public', 'locales', locale, 'common.json');
    messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  return {
    title: {
      default: messages.layout?.title,
      template: messages.layout?.titleTemplate,
    },
    description: messages.layout?.description,
    icons: {
      icon: '/modelengine-logo.png',
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    }
  }
}

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/modelengine-logo.png" sizes="any"/>
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <I18nProviderWrapper>{children}</I18nProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}