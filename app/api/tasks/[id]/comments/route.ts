import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { taskExists, listComments, addComment } from "../../../../../lib/tasks";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/tasks/:id/comments
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const taskId = Number((await params).id);
    if (!Number.isInteger(taskId) || !(await taskExists(taskId))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(await listComments(taskId));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// POST /api/tasks/:id/comments  { message, userId? }
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const taskId = Number((await params).id);
    if (!Number.isInteger(taskId) || !(await taskExists(taskId))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await req.json();
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Prefer the logged-in user from the session cookie; fall back to the id sent by the client
    const me = await getSessionUser(req);
    const rawId = me?.id ?? body?.userId;
    const userId = Number.isInteger(Number(rawId)) && rawId !== null && rawId !== undefined ? Number(rawId) : null;

    return NextResponse.json({ comment: await addComment(taskId, userId, message) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
