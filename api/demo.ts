import { createDemoHandler } from '../src/demo.js';

const handle = createDemoHandler();

export function GET(req: Request): Promise<Response> {
  return handle(req);
}

export function POST(req: Request): Promise<Response> {
  return handle(req);
}
