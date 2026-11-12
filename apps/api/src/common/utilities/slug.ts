import { randomBytes } from 'crypto';

export const generateOpaqueToken = (byteLength = 48): string =>
  randomBytes(byteLength).toString('hex');

export const slugify = (value: string): string => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return base.length > 0 ? base : 'workspace';
};

export const buildUniqueSlug = (value: string): string =>
  `${slugify(value)}-${randomBytes(4).toString('hex')}`;
