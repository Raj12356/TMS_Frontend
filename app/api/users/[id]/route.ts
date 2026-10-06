import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth";
import { ROLES, Role, updateUserRole, deleteUser } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/users/:id  { role }  -> change a user's role
export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    const { error, me } = await requireAdmin(req);
    if (error) return error;

    const targetId = Number((await context.params).id);
    const { role } = await req.json();

    if (!Number.isInteger(targetId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (!ROLES.includes(role as Role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Prevent locking everyone out of the admin panel
    if (targetId === me!.id && role !== "admin") {
      return NextResponse.json({ error: "You cannot change your own admin role" }, { status: 400 });
    }

    const updated = await updateUserRole(targetId, role as Role);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/users/:id -> remove a user.
// Postgres cascades: tasks they created (+ those tasks' comments) are deleted,
// tasks assigned to them become unassigned, their other comments keep no author.
export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const { error, me } = await requireAdmin(req);
    if (error) return error;

    const targetId = Number((await context.params).id);
    if (!Number.isInteger(targetId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (targetId === me!.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    if (!(await deleteUser(targetId))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedId: targetId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
