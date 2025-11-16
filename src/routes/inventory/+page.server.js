// src/routes/inventory/+page.server.js

export const load = async ({ fetch, locals }) => {
  const { user } = (await locals?.auth?.validateUser?.()) ?? { user: null };

  // Inventory
  const r = await fetch('/api/inventory', { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));

  const rawItems = Array.isArray(j.items) ? j.items : [];

  const items = rawItems.map((it) => ({
    color_id: it.color_id,
    quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
    notes: it.notes ?? '',
    code: it.code ?? '',
    name: it.name ?? '',
    hex: it.hex ?? '#cccccc',
    updated_at: it.updated_at ?? null,
    // 👇 new: how many of this color are assigned to your projects
    used_in_projects: Number(it.used_in_projects ?? it.project_count ?? 0) || 0
  }));

  // Projects (only bother if signed in)
  let projects = [];
  if (user) {
    try {
      const rp = await fetch('/api/projects', { cache: 'no-store' });
      const jp = await rp.json().catch(() => ({}));

      // 👇 accept either new shape (projects) or old (items) just in case
      const rawProjects = Array.isArray(jp.projects)
        ? jp.projects
        : Array.isArray(jp.items)
        ? jp.items
        : [];

      projects = rawProjects.map((p) => ({
        id: p.id,
        name: p.name,
        // whatever you stored in D1 as the R2 key/URL:
        file_key: p.pdf_path ?? p.file_key ?? p.fileKey ?? null,
        created_at: p.created_at ?? null
      }));
    } catch {
      // fail soft – just leave projects = []
    }
  }

  return { user, items, projects };
};

