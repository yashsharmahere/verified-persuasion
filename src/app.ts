import { createHandler } from './http.js';
import { supabaseStore } from './store.js';

/** One handler per process, built on first use so a missing env var fails the request, not the import. */
let handler: ((req: Request) => Promise<Response>) | null = null;

export function handle(req: Request): Promise<Response> {
  handler ??= createHandler(supabaseStore());
  return handler(req);
}
