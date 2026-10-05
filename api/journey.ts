import { handleJourney } from '../src/journey/app.js';

export function GET(req: Request): Promise<Response> {
  return handleJourney(req);
}

export function POST(req: Request): Promise<Response> {
  return handleJourney(req);
}
