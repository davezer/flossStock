// helpers/cred.js
export async function readCreds(request) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();

  // Form: multipart or urlencoded
  if (
    ct.includes("multipart/form-data") ||
    ct.includes("application/x-www-form-urlencoded")
  ) {
    const form = await request.formData();
    return {
      email: String(form.get("email") || "").trim().toLowerCase(),
      password: String(form.get("password") || ""),
      username: (() => {
        const u = form.get("username");
        return u != null ? String(u).trim() : null;
      })()
    };
  }

  // Fallback: JSON body
  try {
    const j = await request.json();
    return {
      email: String(j?.email || "").trim().toLowerCase(),
      password: String(j?.password || ""),
      username: j?.username != null ? String(j.username).trim() : null
    };
  } catch {
    return { email: "", password: "", username: null };
  }
}
