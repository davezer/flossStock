import { error } from '@sveltejs/kit';

export const GET = async ({ params, platform, setHeaders }) => {
  const bucket = platform.env.AVATARS;
  if (!bucket) throw error(500, 'R2 not bound');

  const key = params.key; // full key path
  if (!key) throw error(404);

  const obj = await bucket.get(key);
  if (!obj) throw error(404);

  const ctype = obj.httpMetadata?.contentType || 'application/octet-stream';
  setHeaders({
    'content-type': ctype,
    'cache-control': 'public, max-age=86400'
  });

  return new Response(obj.body);
};
