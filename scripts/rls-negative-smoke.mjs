#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
  process.exit(1);
}

const credentials = {
  creatorA: {
    email: process.env.RLS_CREATOR_A_EMAIL,
    password: process.env.RLS_CREATOR_A_PASSWORD,
  },
  creatorB: {
    email: process.env.RLS_CREATOR_B_EMAIL,
    password: process.env.RLS_CREATOR_B_PASSWORD,
  },
  restaurantA: {
    email: process.env.RLS_RESTAURANT_A_EMAIL,
    password: process.env.RLS_RESTAURANT_A_PASSWORD,
  },
  restaurantB: {
    email: process.env.RLS_RESTAURANT_B_EMAIL,
    password: process.env.RLS_RESTAURANT_B_PASSWORD,
  },
};

for (const [name, value] of Object.entries(credentials)) {
  if (!value.email || !value.password) {
    console.error("Missing credentials for " + name + ".");
    process.exit(1);
  }
}

function client() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function login(name) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword(credentials[name]);

  if (error || !data.user) {
    throw new Error("Login failed for " + name + ": " + (error?.message ?? "unknown"));
  }

  return { supabase, user: data.user };
}

async function expectZero(label, promise) {
  const { data, error } = await promise;

  if (error) {
    console.log(JSON.stringify({ label, ok: true, mode: "denied", error: error.message }));
    return;
  }

  if ((data ?? []).length !== 0) {
    throw new Error(label + " leaked " + data.length + " row(s).");
  }

  console.log(JSON.stringify({ label, ok: true, mode: "zero_rows" }));
}

const anonymous = client();
await expectZero(
  "anonymous campaigns",
  anonymous.from("campaigns").select("id").limit(1),
);
await expectZero(
  "anonymous restaurants",
  anonymous.from("restaurants").select("id").limit(1),
);

const creatorB = await login("creatorB");
const { data: creatorBProfile, error: creatorBProfileError } =
  await creatorB.supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", creatorB.user.id)
    .single();

if (creatorBProfileError || !creatorBProfile) {
  throw new Error("Creator B profile fixture is missing.");
}

const { data: payoutFixture, error: payoutFixtureError } =
  await creatorB.supabase
    .from("creator_payout_profiles")
    .select("id")
    .eq("creator_id", creatorBProfile.id)
    .maybeSingle();

if (payoutFixtureError || !payoutFixture) {
  throw new Error("Creator B payout fixture is required for the negative test.");
}

const { data: creatorBBooking, error: creatorBBookingError } =
  await creatorB.supabase
    .from("bookings")
    .select("id")
    .eq("creator_id", creatorBProfile.id)
    .limit(1)
    .maybeSingle();

if (creatorBBookingError || !creatorBBooking) {
  throw new Error("Creator B booking fixture is required for the negative test.");
}

const creatorA = await login("creatorA");
await expectZero(
  "Creator A cannot read Creator B payout destination",
  creatorA.supabase
    .from("creator_payout_profiles")
    .select("id,bank_name,account_number")
    .eq("creator_id", creatorBProfile.id),
);
await expectZero(
  "Creator A cannot read Creator B booking",
  creatorA.supabase
    .from("bookings")
    .select("id")
    .eq("id", creatorBBooking.id),
);

const creatorIntegrity = await creatorA.supabase.rpc("commercial_integrity_report");
if (!creatorIntegrity.error) {
  throw new Error("Creator unexpectedly executed Admin commercial_integrity_report.");
}
console.log(JSON.stringify({
  label: "Creator cannot execute Admin integrity RPC",
  ok: true,
  mode: "denied",
}));

const restaurantB = await login("restaurantB");
const { data: restaurantBMembership, error: restaurantBMembershipError } =
  await restaurantB.supabase
    .from("restaurant_memberships")
    .select("id,restaurant_id")
    .eq("user_id", restaurantB.user.id)
    .limit(1)
    .single();

if (restaurantBMembershipError || !restaurantBMembership) {
  throw new Error("Restaurant B membership fixture is missing.");
}

const { data: restaurantBBooking, error: restaurantBBookingError } =
  await restaurantB.supabase
    .from("bookings")
    .select("id,campaigns!inner(restaurant_id)")
    .eq("campaigns.restaurant_id", restaurantBMembership.restaurant_id)
    .limit(1)
    .maybeSingle();

if (restaurantBBookingError || !restaurantBBooking) {
  throw new Error("Restaurant B booking fixture is required for the negative test.");
}

const restaurantA = await login("restaurantA");
await expectZero(
  "Restaurant A cannot read Restaurant B membership",
  restaurantA.supabase
    .from("restaurant_memberships")
    .select("id,restaurant_id,user_id")
    .eq("id", restaurantBMembership.id),
);
await expectZero(
  "Restaurant A cannot read Restaurant B booking",
  restaurantA.supabase
    .from("bookings")
    .select("id")
    .eq("id", restaurantBBooking.id),
);
await expectZero(
  "Restaurant A cannot read Creator B payout destination",
  restaurantA.supabase
    .from("creator_payout_profiles")
    .select("id,bank_name,account_number")
    .eq("creator_id", creatorBProfile.id),
);

const restaurantIntegrity =
  await restaurantA.supabase.rpc("commercial_integrity_report");
if (!restaurantIntegrity.error) {
  throw new Error("Restaurant unexpectedly executed Admin commercial_integrity_report.");
}
console.log(JSON.stringify({
  label: "Restaurant cannot execute Admin integrity RPC",
  ok: true,
  mode: "denied",
}));

console.log("RLS negative smoke test passed.");
