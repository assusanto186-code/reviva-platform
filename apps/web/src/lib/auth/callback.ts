export async function exchangeAuthorizationCode(
  code: string | null,
  exchange: (code: string) => Promise<{ error: unknown | null }>,
) {
  if (!code || code.length > 4096) return false;
  const { error } = await exchange(code);
  return !error;
}
