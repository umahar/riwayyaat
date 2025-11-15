import { NextResponse } from "next/server";
import { hadithService } from "@/features/hadith/server/hadith-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await hadithService.listHadithInsights();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[api/hadith] Failed to load data", error);
    return NextResponse.json(
      { error: "Unable to load hadith data." },
      { status: 500 },
    );
  }
}
