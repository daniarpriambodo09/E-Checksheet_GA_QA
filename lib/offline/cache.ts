// lib/offline/cache.ts

import { db } from './db';

export async function saveCache(key: string, data: any): Promise<void> {
  await db.cachedData.put({
    key,
    data,
    updatedAt: Date.now()
  });
}

export async function getCache(key: string): Promise<any | null> {
  const cached = await db.cachedData.get(key);
  return cached ? cached.data : null;
}