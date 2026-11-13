// Build-time guard: a malformed Supabase address fails the build loudly instead of deploying a blank site.
// (A pasted Markdown link once did exactly that on Cloudflare Pages, 2026-11-13.)
import type { Plugin } from 'vite';
import { isUsableSupabaseUrl } from '../src/sync/supabaseUrl';

/** Problems with the Supabase settings a build would bake in (empty means fine, or sync deliberately off). */
export function supabaseEnvProblems(env: Record<string, string | undefined>): string[] {
  const url = env.VITE_SUPABASE_URL ?? '';
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const problems: string[] = [];
  if (url && !isUsableSupabaseUrl(url)) {
    problems.push(`VITE_SUPABASE_URL must be a plain address like https://your-project.supabase.co (got ${JSON.stringify(url.slice(0, 80))}).`);
  }
  if (url && !key) problems.push('VITE_SUPABASE_URL is set but VITE_SUPABASE_PUBLISHABLE_KEY is missing.');
  if (key && /\s|[[\]()<>"']/.test(key)) problems.push('VITE_SUPABASE_PUBLISHABLE_KEY contains spaces, quotes or brackets.');
  if (/service_role|sb_secret_/.test(key)) problems.push('That is a SECRET key. Use the publishable (sb_publishable_…) key; never ship the secret one.');
  return problems;
}

export function checkSupabaseEnv(): Plugin {
  return {
    name: 'vespera-check-supabase-env',
    apply: 'build',
    configResolved(config) {
      const problems = supabaseEnvProblems(config.env as Record<string, string | undefined>);
      if (problems.length) throw new Error(`Vespera build stopped:\n- ${problems.join('\n- ')}`);
    },
  };
}
