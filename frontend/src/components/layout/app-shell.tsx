"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getRankTier } from "@/lib/types";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/room/new", label: "Battle", icon: "⚔️" },
  { href: "/problems", label: "Problems", icon: "📚" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tier = getRankTier(user?.elo ?? 0);

  // Hide app shell on battle pages for full-screen experience
  if (pathname.startsWith("/battle/")) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5">
      <header className="mb-6 rounded-2xl border border-border bg-surface/90 px-4 py-3 shadow-[0_12px_40px_-24px_rgba(124,58,237,0.75)] backdrop-blur relative z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="font-semibold tracking-wide flex items-center gap-2">
              <span className="bg-gradient-to-r from-white to-primary-soft bg-clip-text text-transparent text-lg">CodeClash</span>
            </Link>
            <nav className="hidden gap-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition flex items-center gap-1.5 ${
                    pathname.startsWith(item.href) ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted hover:text-foreground hover:bg-surface-soft"
                  }`}
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${user?.username}`}
              className="hidden md:flex items-center gap-2.5 text-sm text-muted hover:text-foreground transition rounded-lg px-2 py-1 hover:bg-surface-soft"
            >
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center shrink-0`}>
                <span className="text-xs text-white font-bold">{tier.icon}</span>
              </div>
              <span>{user?.username}</span>
              <span className={`font-bold ${tier.textColor}`}>{user?.elo ?? 0}</span>
            </Link>
            <Button variant="outline" onClick={logout} size="sm" className="hidden md:block">
              Logout
            </Button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-surface-soft transition"
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                {mobileMenuOpen ? (
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-border space-y-1 animate-slide-up">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  pathname.startsWith(item.href) ? "bg-primary text-white" : "text-muted hover:text-foreground hover:bg-surface-soft"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Link
                href={`/profile/${user?.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-sm py-2"
              >
                <div className={`w-6 h-6 rounded bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                  <span className="text-[10px] text-white font-bold">{tier.icon}</span>
                </div>
                <span>{user?.username}</span>
                <span className={`font-bold text-xs ${tier.textColor}`}>{user?.elo}</span>
              </Link>
              <Button variant="outline" onClick={logout} size="sm">
                Logout
              </Button>
            </div>
          </div>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
