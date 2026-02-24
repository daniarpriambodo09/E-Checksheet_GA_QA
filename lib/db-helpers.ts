// lib/db-helpers.ts
import pool from './db';
import { QueryResult } from 'pg';

export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result: QueryResult = await pool.query(query, params);
    return result.rows as T[];
  } catch (error) {
    console.error('❌ Query execution error:', error);
    throw error;
  }
}

export async function executeQueryOne<T = any>(
  query: string,
  params: any[] = []
): Promise<T | null> {
  try {
    const result: QueryResult = await pool.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Query execution error:', error);
    throw error;
  }
}

export async function executeInsert(
  query: string,
  params: any[] = []
): Promise<number> {
  try {
    const result: QueryResult = await pool.query(query, params);
    return result.rows[0]?.id || 0;
  } catch (error) {
    console.error('❌ Insert execution error:', error);
    throw error;
  }
}

export async function executeUpdate(
  query: string,
  params: any[] = []
): Promise<number> {
  try {
    const result: QueryResult = await pool.query(query, params);
    return result.rowCount || 0;
  } catch (error) {
    console.error('❌ Update execution error:', error);
    throw error;
  }
}

export async function executeDelete(
  query: string,
  params: any[] = []
): Promise<number> {
  try {
    const result: QueryResult = await pool.query(query, params);
    return result.rowCount || 0;
  } catch (error) {
    console.error('❌ Delete execution error:', error);
    throw error;
  }
}