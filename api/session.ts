import { handle } from '../src/app.js';

export function GET(req: Request): Promise<Response> {
  return handle(req);
}
