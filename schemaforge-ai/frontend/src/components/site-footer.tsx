"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/workspace") || pathname.startsWith("/shared")) {
    return null;
  }

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>SchemaForge AI</p>
        <nav className="flex flex-wrap gap-4">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
