// lib/supabase/search-filter.ts

/**
 * Pola `ilike` untuk dipakai di dalam `.or()`. Kata kunci dibungkus kutip
 * supaya koma, kurung, atau kutip di dalamnya tidak merusak sintaks filter
 * PostgREST.
 */
export function orIlikePattern(term: string) {
  return `"%${term.replace(/["\\]/g, "\\$&")}%"`;
}
