/** A plain http(s) address, e.g. not a pasted Markdown link like "[https://…](https://…)". */
export function isUsableSupabaseUrl(url: string): boolean {
  if (/\s|[[\]()<>"']/.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}
