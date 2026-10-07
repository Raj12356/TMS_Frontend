import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { taskExists, listComments, addComment } from "../../../../../lib/tasks";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/tasks/:id/comments?managerId=<id>
// When managerId is provided, only comments belonging to that manager's private channel are returned.
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const taskId = Number((await params).id);
    if (!Number.isInteger(taskId) || !(await taskExists(taskId))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const rawManagerId = req.nextUrl.searchParams.get("managerId");
    const managerId =
      rawManagerId !== null && Number.isInteger(Number(rawManagerId))
        ? Number(rawManagerId)
        : null;
    return NextResponse.json(await listComments(taskId, managerId));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// POST /api/tasks/:id/comments  { message, userId?, managerId }
// managerId is required for private channel isolation.
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
    const userId =
      Number.isInteger(Number(rawId)) && rawId !== null && rawId !== undefined
        ? Number(rawId)
        : null;

    // managerId determines which private conversation channel this message belongs to
    const rawManagerId = body?.managerId;
    const managerId =
      rawManagerId !== null &&
      rawManagerId !== undefined &&
      Number.isInteger(Number(rawManagerId))
        ? Number(rawManagerId)
        : null;

    return NextResponse.json({ comment: await addComment(taskId, userId, message, managerId) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
