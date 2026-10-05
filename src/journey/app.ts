import { supabaseFromEnv, supabaseStore } from '../store.js';
import { createJourneyHandler } from './handler.js';

/**
 * The journey handler with real dependencies. Built on first use, so a missing
 * env var fails the request, not the import.
 *
 * ALLOWED_EMAILS is a comma-separated allow-list. Empty means nobody: the
 * study is closed until someone is invited.
 */
let handler: ((req: Request) => Promise<Response>) | null = null;

export function handleJourney(req: Request): Promise<Response> {
  if (!handler) {
    const db = supabaseFromEnv();
    const allowed = new Set(
      (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
    handler = createJourneyHandler(supabaseStore(db), {
      async verifyUser(accessToken) {
        const { data, error } = await db.auth.getUser(accessToken);
        if (error || !data.user?.email) return null;
        return { id: data.user.id, email: data.user.email.toLowerCase() };
      },
      isAllowed: (email) => allowed.has(email.toLowerCase()),
    });
  }
  return handler(req);
}
