import { NextResponse, type NextRequest } from "next/server";
import { bookingIcsFilename, buildBookingIcs } from "@/lib/calendar-export";
import { getSiteOrigin } from "@/lib/site-origin";
import { getBookingCalendarEvent } from "@/server/queries/booking-calendar";

export const dynamic = "force-dynamic";

// One-off .ics download for the Creator or Restaurant of a confirmed booking.
// Access is decided by RLS on the viewer's session; there is no public feed.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const origin = await getSiteOrigin();
  const result = await getBookingCalendarEvent(id, origin);

  if (result.kind === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (result.kind === "not_found") {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new NextResponse(buildBookingIcs(result.event), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bookingIcsFilename(result.event.startsAt)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
