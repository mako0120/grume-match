"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/restaurant", label: "ホーム" },
  { href: "/restaurant/campaigns/new", label: "案件作成" },
  { href: "/restaurant/offers/new", label: "指名" },
  { href: "/restaurant/flash/new", label: "FLASH" },
  { href: "/notifications", label: "通知" },
] as const;

export function RestaurantBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Restaurant navigation">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/restaurant" && pathname.startsWith(item.href + "/"));

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
