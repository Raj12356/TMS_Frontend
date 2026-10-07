import { NextRequest, NextResponse } from "next/server";
import { isForeignKeyViolation } from "../../../../lib/db";
import { updateTask, getTask } from "../../../../lib/tasks";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function parseTaskId(context: RouteContext): Promise<number | null> {
  try {
    const resolved = await context.params;
    const n = Number(resolved?.id);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

// GET /api/tasks/:id
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const taskId = await parseTaskId(context);
    if (taskId === null) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }
    const task = await getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// PUT /api/tasks/:id - update a task
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const taskId = await parseTaskId(context);
    if (taskId === null) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }
    const body = await req.json();

    const updated = await updateTask(taskId, body, false);
    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Referenced user does not exist" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// PATCH /api/tasks/:id - partial update syncing status/completed
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const taskId = await parseTaskId(context);
    if (taskId === null) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }
    const body = await req.json();

    const updated = await updateTask(taskId, body, true);
    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Referenced user does not exist" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
