"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutTemplate, LifeBuoy, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home", icon: Sparkles },
  { href: "/workspace", label: "Workspace", icon: Database },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <Database className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Schema<span className="text-indigo-400">Forge</span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                pathname === href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <BadgePro />
          <Link href="/workspace">
            <Button size="sm" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Generate
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function BadgePro() {
  return (
    <span className="hidden rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 sm:inline">
      Beta v1.0
    </span>
  );
}
