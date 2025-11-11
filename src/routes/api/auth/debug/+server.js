export const GET = async ({ locals, cookies }) => {
  const sid = cookies.get("auth_session") || null;
  return new Response(
    JSON.stringify({ sid, user: locals.user, now: Date.now() }, null, 2),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
