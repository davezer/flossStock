import md5 from 'spark-md5';

export function gravatarUrl(email, size = 64) {
  const e = String(email || '').trim().toLowerCase();
  const hash = md5.hash(e);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}