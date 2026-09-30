import type { ReactNode } from "react";
import { requireRole } from "@/server/auth/require-role";

export default async function RestaurantLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["restaurant", "admin"]);
  return children;
}
