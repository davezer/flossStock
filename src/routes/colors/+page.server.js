const PAGE_SIZE_DEFAULT = 60;

export async function load({ url, locals }) {
  const db = locals.db;
  const q = (url.searchParams.get('q') || '').trim();
  const sort = (url.searchParams.get('sort') || 'code').toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(120, Math.max(12, parseInt(url.searchParams.get('pageSize') || PAGE_SIZE_DEFAULT, 10)));
  const offset = (page - 1) * pageSize;
  const orderBy = sort === 'name' ? 'name COLLATE NOCASE ASC' : 'code ASC';

  if (!db) return { colors: [], total: 0, page, pageSize, q, sort, inventory: [] };

  const countSql = q
    ? `SELECT COUNT(*) AS n FROM color WHERE code LIKE ? OR name LIKE ?`
    : `SELECT COUNT(*) AS n FROM color`;
  const countArgs = q ? [`%${q}%`, `%${q}%`] : [];
  const c = await db.prepare(countSql).bind(...countArgs).first();
  const total = Number(c?.n || 0);

  const listSql = q
    ? `SELECT id, full_code AS fullCode, code, name, hex FROM color WHERE code LIKE ? OR name LIKE ? ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    : `SELECT id, full_code AS fullCode, code, name, hex FROM color ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const listArgs = q ? [`%${q}%`, `%${q}%`, pageSize, offset] : [pageSize, offset];
  const rows = await db.prepare(listSql).bind(...listArgs).all();

  // preload inventory for logged-in user
  let inventory = [];
  const session = await locals.auth.validateUser?.();
  if (session?.user) {
    const invRows = await db
      .prepare(
        `
        SELECT i.color_id AS colorId, i.quantity AS qty
        FROM inventory i
        WHERE i.user_id = ?
        `
      )
      .bind(session.user.id)
      .all();
    inventory = invRows?.results || [];
  }

  return { colors: rows?.results || [], total, page, pageSize, q, sort, inventory };
}
