import { error, json } from '@sveltejs/kit';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Set(['image/png','image/jpeg','image/webp','image/gif']);

export const POST = async ({ locals, platform, request }) => {
  const { user } = await locals.auth.validateUser();
  if (!user) throw error(401, 'Sign in required');

  const db = platform.env.DB;
  const bucket = platform.env.AVATARS;
  if (!bucket) throw error(500, 'R2 not bound');

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw error(400, 'No file uploaded');

  const type = file.type || '';
  if (!ALLOWED.has(type)) throw error(415, 'Unsupported image type');

  const size = file.size ?? 0;
  if (size <= 0 || size > MAX_BYTES) throw error(413, 'File too large');

  // delete previous (if any)
  const prev = await db.prepare('SELECT avatar_key FROM user WHERE id=?').bind(user.userId).first();
  if (prev?.avatar_key) {
    try {
      await bucket.delete(prev.avatar_key);
    } catch (err) {
      // Ignore deletion errors but log them for debugging
      console.warn('Could not delete previous avatar from R2:', err);
    }
  }

  // create new key: <userId>/<timestamp>.<ext>
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : 'jpg';
  const key = `${user.userId}/${Date.now()}.${ext}`;

  // Put into R2
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { userId: user.userId }
  });

  // Save in D1
  await db.prepare('UPDATE user SET avatar_key=? WHERE id=?').bind(key, user.userId).run();

  return json({ ok: true, key });
};
