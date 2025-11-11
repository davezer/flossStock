export async function GET({ locals }) {
  const DB = locals.DB;
  const lucia = locals.lucia;
  let dbOk = false;
  let authOk = false;

  try {
    if (DB) await DB.prepare("select 1").first(), dbOk = true;
  } catch (e) {
    console.error("[health] DB check failed:", e);
  }

  try {
    authOk = !!lucia;
  } catch (e) {
    console.error("[health] Auth check failed:", e);
  }

  return new Response(
    JSON.stringify({ dbOk, authOk }),
    { headers: { "content-type": "application/json" } }
  );
}
