/** Unwrap a Supabase response: throw on error, return non-null data. */
export function must<T>(
  res: { data: T | null; error: { message: string } | null },
  what = "query",
): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what} returned no data`);
  return res.data;
}
