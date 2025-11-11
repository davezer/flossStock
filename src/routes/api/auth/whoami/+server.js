// src/routes/api/auth/whoami/+server.js
export const GET = async ({ locals }) => {
  return new Response(JSON.stringify({
    user: locals.user ? { id: locals.user.id, email: locals.user.email } : null,
    hasSession: !!locals.session
  }), { status: 200, headers: { "content-type": "application/json" } });
};
