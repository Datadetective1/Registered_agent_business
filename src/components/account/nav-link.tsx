"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors",
        active ? "bg-sand font-medium text-ink" : "text-muted hover:bg-sand hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
