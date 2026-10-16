import { NextResponse } from "next/server";
import { getLaunchReadiness } from "@/server/queries/launch-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await getLaunchReadiness();

  const blockers = [
    ...readiness.checks
      .filter((check) => !check.ok)
      .map((check) => check.key),
    ...readiness.approvalChecks
      .filter((check) => !check.ok)
      .map((check) => check.key),
    ...(readiness.databaseReady ? [] : ["database_schema"]),
    ...(readiness.publicLaunchEnabled ? [] : ["public_launch_disabled"]),
  ];

  return NextResponse.json(
    {
      ok: readiness.ready,
      mode: readiness.publicLaunchEnabled ? "public" : "private_alpha",
      environmentReady: readiness.environmentReady,
      approvalsReady: readiness.approvalsReady,
      databaseReady: readiness.databaseReady,
      publicLaunchEnabled: readiness.publicLaunchEnabled,
      blockers,
      checks: [...readiness.checks, ...readiness.approvalChecks],
    },
    {
      status:
        readiness.environmentReady && readiness.databaseReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
