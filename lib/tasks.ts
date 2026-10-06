import { query, withTransaction } from "./db";

export interface ApiComment {
  id: number;
  userId: number | null;
  userName: string | null;
  message: string;
  createdAt: string;
}

export interface TaskRecord {
  userId: number | null;
  assignedTo: number | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string | null;
  category: string | null;
  status: string;
  completed: boolean;
  attachments: string[];
}

// ---------------------------------------------------------------- pure helpers (unit-tested)

const toIntOrNull = (v: any): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const toStrOrNull = (v: any): string | null => (v === undefined || v === null ? null : String(v));
const toAttachments = (v: any): string[] =>
  Array.isArray(v) ? v.map((a) => String(a).trim()).filter(Boolean) : [];

export const emptyTask = (): TaskRecord => ({
  userId: null,
  assignedTo: null,
  title: "",
  description: null,
  dueDate: null,
  priority: null,
  category: null,
  status: "pending",
  completed: false,
  attachments: [],
});

/**
 * Applies a partial update from the API body. Only known columns are accepted.
 * sync=true keeps `status` and `completed` consistent (used by PATCH, like before).
 */
export function mergeTask(cur: TaskRecord, patch: any, sync: boolean): TaskRecord {
  const has = (k: string) => patch && patch[k] !== undefined;
  const next: TaskRecord = { ...cur };

  if (has("userId")) next.userId = toIntOrNull(patch.userId);
  if (has("assignedTo")) next.assignedTo = toIntOrNull(patch.assignedTo);
  if (has("title")) next.title = String(patch.title);
  if (has("description")) next.description = toStrOrNull(patch.description);
  if (has("dueDate")) next.dueDate = toStrOrNull(patch.dueDate);
  if (has("priority")) next.priority = toStrOrNull(patch.priority);
  if (has("category")) next.category = toStrOrNull(patch.category);
  if (has("attachments")) next.attachments = toAttachments(patch.attachments);
  if (has("completed")) next.completed = !!patch.completed;
  if (has("status")) next.status = String(patch.status);

  if (sync) {
    if (has("completed")) next.status = next.completed ? "completed" : "pending";
    if (has("status")) next.completed = next.status === "completed";
  }
  return next;
}

// JSON drops `undefined`, so empty fields are simply absent from the response (same as the old JSON file)
const orUndef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

function toApiTask(r: any, comments: ApiComment[]) {
  return {
    id: r.id as number,
    userId: orUndef<number>(r.user_id),
    assignedTo: orUndef<number>(r.assigned_to),
    title: r.title as string,
    description: orUndef<string>(r.description),
    dueDate: orUndef<string>(r.due_date),
    priority: orUndef<string>(r.priority),
    category: orUndef<string>(r.category),
    status: r.status as string,
    completed: r.completed as boolean,
    attachments: (r.attachments ?? []) as string[],
    comments,
  };
}
export type ApiTask = ReturnType<typeof toApiTask>;

const toApiComment = (r: any): ApiComment => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name ?? null,
  message: r.message,
  createdAt: new Date(r.created_at).toISOString(),
});

const rowToRecord = (r: any): TaskRecord => ({
  userId: r.user_id,
  assignedTo: r.assigned_to,
  title: r.title,
  description: r.description,
  dueDate: r.due_date,
  priority: r.priority,
  category: r.category,
  status: r.status,
  completed: r.completed,
  attachments: r.attachments ?? [],
});

// ---------------------------------------------------------------- tasks

async function attachComments(rows: any[]): Promise<ApiTask[]> {
  if (rows.length === 0) return [];
  const { rows: cRows } = await query(
    `SELECT c.id, c.task_id, c.user_id, u.name AS user_name, c.message, c.created_at
       FROM tms_comments c LEFT JOIN tms_users u ON u.id = c.user_id
      WHERE c.task_id = ANY($1::bigint[])
      ORDER BY c.created_at, c.id`,
    [rows.map((r) => r.id)]
  );
  const byTask = new Map<number, ApiComment[]>();
  for (const c of cRows) {
    const list = byTask.get(c.task_id) ?? [];
    list.push(toApiComment(c));
    byTask.set(c.task_id, list);
  }
  return rows.map((r) => toApiTask(r, byTask.get(r.id) ?? []));
}

export async function listTasks(filter: { userId?: number; assignedTo?: number }): Promise<ApiTask[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    where.push(`user_id = $${params.length}`);
  }
  if (filter.assignedTo !== undefined) {
    params.push(filter.assignedTo);
    where.push(`assigned_to = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT * FROM tms_tasks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`,
    params
  );
  return attachComments(rows);
}

export async function getTask(id: number): Promise<ApiTask | null> {
  const { rows } = await query(`SELECT * FROM tms_tasks WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  return (await attachComments(rows))[0];
}

export async function createTask(body: any): Promise<ApiTask> {
  const t = mergeTask(emptyTask(), body, false);
  if (!body || body.status === undefined) t.status = t.completed ? "completed" : "pending";
  const { rows } = await query(
    `INSERT INTO tms_tasks
       (user_id, assigned_to, title, description, due_date, priority, category, status, completed, attachments)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [t.userId, t.assignedTo, t.title, t.description, t.dueDate, t.priority, t.category, t.status, t.completed, t.attachments]
  );
  return toApiTask(rows[0], []);
}

/** Returns null when the task doesn't exist. */
export async function updateTask(id: number, body: any, sync: boolean): Promise<ApiTask | null> {
  const cur = await query(`SELECT * FROM tms_tasks WHERE id = $1`, [id]);
  if (!cur.rows[0]) return null;
  const t = mergeTask(rowToRecord(cur.rows[0]), body, sync);
  await query(
    `UPDATE tms_tasks SET user_id=$2, assigned_to=$3, title=$4, description=$5, due_date=$6,
            priority=$7, category=$8, status=$9, completed=$10, attachments=$11
      WHERE id = $1`,
    [id, t.userId, t.assignedTo, t.title, t.description, t.dueDate, t.priority, t.category, t.status, t.completed, t.attachments]
  );
  return getTask(id);
}

export async function deleteTask(id: number): Promise<void> {
  await query(`DELETE FROM tms_tasks WHERE id = $1`, [id]); // comments are removed by ON DELETE CASCADE
}

// ---------------------------------------------------------------- comments

export async function taskExists(id: number): Promise<boolean> {
  const { rowCount } = await query(`SELECT 1 FROM tms_tasks WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function listComments(taskId: number): Promise<ApiComment[]> {
  const { rows } = await query(
    `SELECT c.id, c.user_id, u.name AS user_name, c.message, c.created_at
       FROM tms_comments c LEFT JOIN tms_users u ON u.id = c.user_id
      WHERE c.task_id = $1 ORDER BY c.created_at, c.id`,
    [taskId]
  );
  return rows.map(toApiComment);
}

/** userId that doesn't match a real user is stored as NULL. */
export async function addComment(taskId: number, userId: number | null, message: string): Promise<ApiComment> {
  const { rows } = await query(
    `WITH ins AS (
       INSERT INTO tms_comments (task_id, user_id, message)
       VALUES ($1, (SELECT id FROM tms_users WHERE id = $2), $3)
       RETURNING id, user_id, message, created_at
     )
     SELECT ins.id, ins.user_id, u.name AS user_name, ins.message, ins.created_at
       FROM ins LEFT JOIN tms_users u ON u.id = ins.user_id`,
    [taskId, userId, message]
  );
  return toApiComment(rows[0]);
}

// ---------------------------------------------------------------- categories & labels

export type ListTable = "tms_categories" | "tms_labels"; // fixed set -> safe to interpolate

export const cleanNames = (input: any): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    const name = String(v ?? "").trim().slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= 200) break;
  }
  return out;
};

export async function getNames(table: ListTable): Promise<string[]> {
  const { rows } = await query(`SELECT name FROM ${table} ORDER BY id`);
  return rows.map((r) => r.name);
}

/** Replaces the whole list with the given names (what the admin "Save Changes" button sends). */
export async function replaceNames(table: ListTable, names: string[]): Promise<string[]> {
  await withTransaction(async (c) => {
    await c.query(`DELETE FROM ${table}`);
    if (names.length) {
      await c.query(
        `INSERT INTO ${table} (name)
         SELECT n FROM unnest($1::text[]) WITH ORDINALITY AS t(n, ord) ORDER BY ord`,
        [names]
      );
    }
  });
  return getNames(table);
}
