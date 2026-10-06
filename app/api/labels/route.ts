import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/auth";
import { getNames, replaceNames, cleanNames } from "../../../lib/tasks";

// GET - list of labels
export async function GET() {
  try {
    return NextResponse.json(await getNames("tms_labels"));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load labels" }, { status: 500 });
  }
}

// POST { labels: string[] } - admin only, replaces the whole list
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAdmin(req);
    if (error) return error;

    const { labels } = await req.json();
    if (!Array.isArray(labels)) {
      return NextResponse.json({ error: "labels must be an array" }, { status: 400 });
    }
    return NextResponse.json(await replaceNames("tms_labels", cleanNames(labels)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save labels" }, { status: 500 });
  }
}
