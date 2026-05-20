// lib/offline/db.ts

import Dexie, { Table } from 'dexie';

export interface Checklist {
  id: string;
  endpoint: string;
  payload: any; // You can define a more specific type if needed
  synced: boolean;
  createdAt: number;
}

export interface CachedData {
  key: string;
  data: any;
  updatedAt: number;
}

export class ChecklistDB extends Dexie {
  checklists!: Table<Checklist>;
  cachedData!: Table<CachedData>;

  constructor() {
    super('checklistDB');
    this.version(2).stores({
      checklists: 'id, endpoint, synced, createdAt',
      cachedData: 'key, updatedAt'
    });
  }
}

export const db = new ChecklistDB();