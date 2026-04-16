"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const publicRoutes = ["/", "/login", "/register"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isPublicRoute = publicRoutes.includes(pathname);
    if (!token && !isPublicRoute) router.replace("/login");
    if (token && (pathname === "/login" || pathname === "/register")) router.replace("/dashboard");
  }, [loading, token, pathname, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading session...</div>;
  }

  return <>{children}</>;
}
