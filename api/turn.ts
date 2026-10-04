import { handle } from '../src/app.js';

export function POST(req: Request): Promise<Response> {
  return handle(req);
}
