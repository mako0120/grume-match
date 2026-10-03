import {
  REVIEW_TAGS,
  toReviewSummary,
  type PostReport,
  type ReviewDirection,
  type ReviewSummary,
} from "@/lib/pr-feedback";
import { createClient } from "@/lib/supabase/server";

export type BookingReview = {
  direction: ReviewDirection;
  isMine: boolean;
  rating: number;
  tags: string[];
  comment: string | null;
  createdAt: string;
};

export type BookingReviewState = {
  /** The PR is complete (post approved), so both sides can review. */
  open: boolean;
  myDirection: ReviewDirection;
  tagChoices: readonly string[];
  mine: BookingReview | null;
  /** The other side's review, once revealed. */
  theirs: BookingReview | null;
};

/** Review state of one booking from the viewer's side. */
export async function getBookingReviews(
  bookingId: string,
  viewer: "creator" | "restaurant",
): Promise<BookingReviewState> {
  const supabase = await createClient();
  const myDirection: ReviewDirection =
    viewer === "creator" ? "creator_to_restaurant" : "restaurant_to_creator";

  const [{ data: booking }, { data: rows }] = await Promise.all([
    supabase.from("bookings").select("applications(status)").eq("id", bookingId).maybeSingle(),
    supabase.rpc("booking_pr_reviews", { p_booking_id: bookingId }),
  ]);

  const application = booking?.applications as { status: string } | { status: string }[] | null | undefined;
  const status = Array.isArray(application) ? application[0]?.status : application?.status;

  const reviews = ((rows ?? []) as {
    direction: ReviewDirection;
    is_mine: boolean;
    rating: number;
    tags: string[];
    comment: string | null;
    created_at: string;
  }[]).map((row) => ({
    direction: row.direction,
    isMine: row.is_mine,
    rating: row.rating,
    tags: row.tags ?? [],
    comment: row.comment,
    createdAt: row.created_at,
  }));

  return {
    open: status === "approved" || status === "paid",
    myDirection,
    tagChoices: REVIEW_TAGS[myDirection],
    mine: reviews.find((review) => review.isMine) ?? null,
    theirs: reviews.find((review) => !review.isMine) ?? null,
  };
}

export async function getRestaurantReviewSummaries(restaurantIds: string[]) {
  const summaries = new Map<string, ReviewSummary>();
  const ids = [...new Set(restaurantIds)];
  if (!ids.length) return summaries;

  const supabase = await createClient();
  const { data } = await supabase.rpc("restaurant_review_summaries", { p_restaurant_ids: ids });
  for (const row of (data ?? []) as {
    restaurant_id: string;
    review_count: number;
    average_rating: number | string | null;
    tag_counts: Record<string, number> | null;
  }[]) {
    const summary = toReviewSummary(row);
    if (summary) summaries.set(row.restaurant_id, summary);
  }
  return summaries;
}

export type PostReportRow = PostReport & {
  id: string;
  deliverableId: string;
  bookingId: string;
  creatorId: string;
  status: "pending" | "verified" | "rejected";
  reviewNote: string | null;
  measuredOn: string | null;
  submittedAt: string;
};

type RawPostReport = {
  id: string;
  deliverable_id: string;
  booking_id: string;
  creator_id: string;
  status: "pending" | "verified" | "rejected";
  review_note: string | null;
  measured_on: string | null;
  submitted_at: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  follows: number | null;
};

const reportColumns =
  "id,deliverable_id,booking_id,creator_id,status,review_note,measured_on,submitted_at,views,reach,likes,comments,saves,shares,follows";

function present(row: RawPostReport): PostReportRow {
  return {
    id: row.id,
    deliverableId: row.deliverable_id,
    bookingId: row.booking_id,
    creatorId: row.creator_id,
    status: row.status,
    reviewNote: row.review_note,
    measuredOn: row.measured_on,
    submittedAt: row.submitted_at,
    views: row.views ?? 0,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    saves: row.saves,
    shares: row.shares,
    follows: row.follows,
  };
}

/** Reports of one booking, keyed by deliverable. */
export async function getBookingPostReports(bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pr_post_reports")
    .select(reportColumns)
    .eq("booking_id", bookingId);

  return new Map(
    ((data ?? []) as RawPostReport[]).map((row) => [row.deliverable_id, present(row)]),
  );
}

/** Verified reports of the signed-in Restaurant, keyed by booking. */
export async function getRestaurantPostReports(restaurantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pr_post_reports")
    .select(reportColumns)
    .eq("restaurant_id", restaurantId)
    .eq("status", "verified");

  const byBooking = new Map<string, PostReportRow[]>();
  for (const row of ((data ?? []) as RawPostReport[]).map(present)) {
    byBooking.set(row.bookingId, [...(byBooking.get(row.bookingId) ?? []), row]);
  }
  return byBooking;
}
