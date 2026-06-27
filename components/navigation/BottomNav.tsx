"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Home", href: "/home", icon: "⌂" },
  { label: "Closet", href: "/wardrobe", icon: "▦" },
  { label: "Looks", href: "/looks", icon: "◌" },
  { label: "Avatar", href: "/avatar", icon: "◈" },
  { label: "Stylist", href: "/stylist", icon: "✦" }
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] overflow-hidden rounded-t-[1.75rem] border-t border-line bg-surface/95 px-2 pb-[calc(0.625rem+var(--safe-bottom))] pt-2 backdrop-blur"
      aria-label="Primary navigation"
    >
      <div className="flex w-full items-stretch gap-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-1 text-center font-semibold transition active:scale-[0.98]",
                active ? "bg-cocoa text-white shadow-card" : "text-muted hover:bg-cocoa/10 hover:text-cocoa"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={`${item.label}${active ? ", current tab" : ""}`}
            >
              <span className="text-base leading-none" aria-hidden>{item.icon}</span>
              <span className="block max-w-full overflow-hidden truncate whitespace-nowrap text-center text-[10px] leading-none sm:text-[11px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
