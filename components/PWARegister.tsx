// components/PWARegister.tsx
//
// Client component ringan yang trigger warm-up cache PWA setelah SW aktif.
// Dirender di root layout agar berjalan di semua halaman.

"use client";

import { useEffect } from "react";
import { registerPWA } from "@/lib/pwa/register";

export function PWARegister() {
  useEffect(() => {
    registerPWA();
  }, []);

  return null;
}