/**
 * Offline mutation queue backed by localStorage.
 *
 * When the device is on a poor-signal pitch, any Supabase writes that fail
 * are stored here.  Call flushQueue() when the device comes back online to
 * replay them in order.
 *
 * Usage:
 *   import { enqueue, flushQueue } from '@/lib/offlineQueue';
 *
 *   // In your mutation handler:
 *   const { error } = await supabase.from('player_match_minutes').upsert(row);
 *   if (error) {
 *     enqueue({ table: 'player_match_minutes', op: 'upsert', payload: row });
 *   }
 *
 *   // In your component on reconnect:
 *   useOnlineStatus(() => flushQueue(supabase));
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type QueuedOp = {
  id: string;             // uuid-ish, for deduplication
  table: string;
  op: 'upsert' | 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  /** ISO timestamp when it was queued */
  queuedAt: string;
};

const STORAGE_KEY = 'matchday_offline_queue';

// ─── Read / write helpers ─────────────────────────────────────────────────────

function readQueue(): QueuedOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add a failed mutation to the queue. */
export function enqueue(op: Omit<QueuedOp, 'id' | 'queuedAt'>) {
  const queue = readQueue();
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

/** How many operations are waiting to sync. */
export function pendingCount(): number {
  return readQueue().length;
}

/**
 * Replay all queued operations against Supabase in order.
 * Successfully replayed ops are removed; failed ones stay for the next attempt.
 */
export async function flushQueue(supabase: SupabaseClient): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedOp[] = [];

  for (const op of queue) {
    try {
      let error: unknown = null;

      if (op.op === 'upsert') {
        ({ error } = await supabase.from(op.table).upsert(op.payload));
      } else if (op.op === 'insert') {
        ({ error } = await supabase.from(op.table).insert(op.payload));
      } else if (op.op === 'update') {
        // payload must contain 'id' for the .eq filter
        const { id, ...rest } = op.payload;
        ({ error } = await supabase.from(op.table).update(rest).eq('id', id));
      } else if (op.op === 'delete') {
        ({ error } = await supabase.from(op.table).delete().eq('id', op.payload.id));
      }

      if (error) {
        console.warn('[offlineQueue] replay failed, keeping for retry:', op, error);
        remaining.push(op);
      }
    } catch (err) {
      console.warn('[offlineQueue] replay threw, keeping for retry:', op, err);
      remaining.push(op);
    }
  }

  writeQueue(remaining);

  if (remaining.length < queue.length) {
    console.info(
      `[offlineQueue] synced ${queue.length - remaining.length} queued op(s); ${remaining.length} remaining`,
    );
  }
}

/** Clear the queue (e.g. after a sign-out). */
export function clearQueue() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
