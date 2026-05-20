"use client";

import { useSync } from '@/hooks/useSync';

export default function SyncListener() {
  useSync();
  return null;
}
