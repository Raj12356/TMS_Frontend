import { NextRequest, NextResponse } from "next/server";
import { isForeignKeyViolation } from "../../../lib/db";
import { listTasks, createTask, updateTask, deleteTask } from "../../../lib/tasks";

const fkError = () =>
  NextResponse.json({ error: "Referenced user does not exist" }, { status: 400 });

// GET /api/tasks?userId=&assignedTo=&includeTransfers=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter: { userId?: number; assignedTo?: number; includeTransfers?: boolean } = {};

    for (const key of ["userId", "assignedTo"] as const) {
      const raw = searchParams.get(key);
      if (raw) {
        const n = Number(raw);
        if (!Number.isInteger(n)) return NextResponse.json([]);
        filter[key] = n;
      }
    }

    if (searchParams.get("includeTransfers") === "true") {
      filter.includeTransfers = true;
    }

    return NextResponse.json(await listTasks(filter));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "GET failed" }, { status: 500 });
  }
}

// POST - create a task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    return NextResponse.json(await createTask(body));
  } catch (err) {
    if (isForeignKeyViolation(err)) return fkError();
    console.error(err);
    return NextResponse.json({ error: "POST failed" }, { status: 500 });
  }
}

// PATCH - partial update; keeps status & completed in sync
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateTask(Number(body.id), body, true);
    if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (isForeignKeyViolation(err)) return fkError();
    console.error(err);
    return NextResponse.json({ error: "PATCH failed" }, { status: 500 });
  }
}

// PUT - full edit (no status/completed syncing, same as before)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateTask(Number(body.id), body, false);
    if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (isForeignKeyViolation(err)) return fkError();
    console.error(err);
    return NextResponse.json({ error: "UPDATE failed" }, { status: 500 });
  }
}

// DELETE /api/tasks?id=
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "DELETE failed" }, { status: 500 });
  }
}
