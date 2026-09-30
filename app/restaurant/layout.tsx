import type { ReactNode } from "react";
import { RestaurantBottomNav } from "@/components/restaurant-bottom-nav";
import { requireRole } from "@/server/auth/require-role";

export default async function RestaurantLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["restaurant", "admin"]);

  return (
    <>
      {children}
      <RestaurantBottomNav />
    </>
  );
}
