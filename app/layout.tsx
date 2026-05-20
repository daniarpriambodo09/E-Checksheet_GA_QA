// app/layout.tsx

import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import SyncListener from '@/components/SyncListener'
import { PWARegister } from "@/components/PWARegister"
import './globals.css'
import { DeviceGuard } from "@/lib/device/DeviceGuard"

const inter = Inter({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: 'E-Checksheet - Management System',
  description: 'Sistem manajemen checklist elektronik untuk PT JAI',
  generator: 'v0.app',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {/* PWA: warm-up cache halaman penting setelah SW aktif */}
        <PWARegister />
        <SyncListener />
          <AuthProvider>
            <DeviceGuard>
              {children}
            </DeviceGuard>
          </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}