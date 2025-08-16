import dmc from '$lib/data/dmc.json' assert { type: 'json' };

export async function load({ params }) {
  const code = params.code;
  const color = dmc.find(c => String(c.code).toLowerCase() === String(code).toLowerCase()) || null;
  return { color };
}