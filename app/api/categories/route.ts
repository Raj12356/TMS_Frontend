import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth";
import { getNames, replaceNames, cleanNames } from "../../../lib/tasks";

// GET - list of task categories (any logged-in page can read it)
export async function GET() {
  try {
    return NextResponse.json(await getNames("tms_categories"));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

// POST { categories: string[] } - admin only, replaces the whole list
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAdmin(req);
    if (error) return error;

    const { categories } = await req.json();
    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: "categories must be an array" }, { status: 400 });
    }
    return NextResponse.json(await replaceNames("tms_categories", cleanNames(categories)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save categories" }, { status: 500 });
  }
}
