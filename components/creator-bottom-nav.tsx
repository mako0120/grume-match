"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/creator/campaigns", label: "案件" },
  { href: "/creator/offers", label: "指名" },
  { href: "/creator/flash", label: "FLASH" },
  { href: "/creator/bookings", label: "予定" },
  { href: "/creator/wallet", label: "報酬" },
] as const;

export function CreatorBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Creator navigation">
      {items.map((item) => {
        const active =
          item.href === "/creator/campaigns"
            ? pathname.startsWith("/creator/campaigns")
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "bottom-nav-item active" : "bottom-nav-item"}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
