// src/routes/projects/[project_id]/+page.server.js
import { redirect, error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
  const id = params.project_id;

  // Ask the API for project + colors
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}/colors`, {
    cache: 'no-store'
  });

  // If API says "not logged in", push to login
  if (res.status === 401) {
    throw redirect(302, '/auth/login'); // adjust to your actual sign-in route if different
  }

  const j = await res.json().catch(() => ({}));

  if (!res.ok || !j?.project) {
    throw error(404, 'Project not found');
  }

  return {
    project: j.project,          // { id, name }
    colors: j.colors ?? []       // [{ color_id, code, name, hex, quantity, ... }]
  };
};
