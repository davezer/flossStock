// helpers/cred.js (optional helper to keep endpoints tidy)
export async function readCreds(request) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    return {
      email: String(form.get('email') || '').trim().toLowerCase(),
      password: String(form.get('password') || '')
    };
  }
  // fallback: JSON
  try {
    const j = await request.json();
    return {
      email: String(j?.email || '').trim().toLowerCase(),
      password: String(j?.password || '')
    };
  } catch {
    return { email: '', password: '' };
  }
}
