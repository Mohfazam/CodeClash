"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/room/new", label: "Battle" },
  { href: "/problems", label: "Problems" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-surface/90 px-4 py-3 shadow-[0_12px_40px_-24px_rgba(124,58,237,0.75)] backdrop-blur">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="font-semibold tracking-wide">
            <span className="bg-gradient-to-r from-white to-primary-soft bg-clip-text text-transparent">CodeClash</span>
          </Link>
          <nav className="hidden gap-3 md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  pathname.startsWith(item.href) ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/profile/${user?.username}`} className="text-sm text-muted hover:text-foreground transition">
            {user?.username} <span className="ml-1 text-foreground font-semibold">ELO {user?.elo ?? 0}</span>
          </Link>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
