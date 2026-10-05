export function validateLeetcodeProblemUrl(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string')
    throw new Error('Enter a valid HTTPS LeetCode Problem URL.');

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid HTTPS LeetCode Problem URL.');
  }

  if (
    url.protocol !== 'https:' ||
    !['leetcode.com', 'www.leetcode.com'].includes(url.hostname) ||
    url.port !== '' ||
    !/^\/problems\/[a-z0-9-]+\/?$/i.test(url.pathname) ||
    url.username !== '' ||
    url.password !== ''
  )
    throw new Error('Enter a valid HTTPS LeetCode Problem URL.');

  return trimmed;
}
