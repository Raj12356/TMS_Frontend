import { NextRequest, NextResponse } from "next/server";
import { isForeignKeyViolation } from "../../../../lib/db";
import { updateTask } from "../../../../lib/tasks";

// PUT /api/tasks/:id - update a task (used by the team-member dashboard for status changes)
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const taskId = Number((await context.params).id);
    if (!Number.isInteger(taskId)) {
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
