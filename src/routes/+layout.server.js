export async function load({ cookies }) {
  return { cookies: cookies.getAll() };
}
