import { supabaseFromEnv, supabaseStore } from '../store.js';
import { createJourneyHandler } from './handler.js';

/**
 * The journey handler with real dependencies. Built on first use, so a missing
 * env var fails the request, not the import.
 *
 * MAX_NEW_BELIEFS_PER_DAY caps new beliefs across everyone (default 20).
 */
let handler: ((req: Request) => Promise<Response>) | null = null;

export function handleJourney(req: Request): Promise<Response> {
  if (!handler) {
    const limit = Number(process.env.MAX_NEW_BELIEFS_PER_DAY);
    handler = createJourneyHandler(supabaseStore(supabaseFromEnv()), {
      dailyLimit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
  }
  return handler(req);
}
