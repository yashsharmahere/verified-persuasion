import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { supabaseFromEnv } from '../src/store.js';

export const db = () => supabaseFromEnv();

/** --name value, or undefined. */
export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

export function requireArg(name: string, hint: string): string {
  const v = arg(name);
  if (!v) {
    console.error(`Missing --${name}. ${hint}`);
    process.exit(1);
  }
  return v;
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** 32 random bytes: the link is the credential, so it must not be guessable. */
export const newToken = () => randomBytes(32).toString('base64url');

export const baseUrl = () => (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function check<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error || res.data == null) {
    console.error(`${what}: ${res.error?.message ?? 'no data returned'}`);
    process.exit(1);
  }
  return res.data;
}
