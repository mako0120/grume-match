import type { ReactNode } from "react";
import { requireRole } from "@/server/auth/require-role";

export default async function CreatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["creator", "admin"]);
  return children;
}
