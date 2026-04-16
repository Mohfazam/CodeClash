"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGate } from "@/components/auth/auth-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
