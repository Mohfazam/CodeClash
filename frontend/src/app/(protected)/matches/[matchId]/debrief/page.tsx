"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { DebriefResponse } from "@/lib/types";

function formatMs(ms: number | null) {
  if (!ms) return "--";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export default function MatchDebriefPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const { token, user } = useAuth();
  const [data, setData] = useState<DebriefResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiRequest<DebriefResponse>({ path: `/api/matches/${matchId}/debrief`, token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load debrief"));
  }, [token, matchId]);

  const meIsP1 = user?.id === data?.player1.id;
  const me = meIsP1 ? data?.player1 : data?.player2;
  const opp = meIsP1 ? data?.player2 : data?.player1;
  const result =
    data?.match.winner_id === null
      ? "Draw"
      : data?.match.winner_id === user?.id
      ? "Victory"
      : "Defeat";

  return (
    <main className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-surface to-surface-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-primary-soft">Match Debrief</p>
        <h1 className="mt-1 text-2xl font-semibold">{data?.problem.title ?? "Loading..."}</h1>
        {data ? <p className="mt-2 text-sm text-muted">{result}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </Card>

      {data ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">You</h2>
            <p className="mt-2 text-sm text-muted">{me?.username}</p>
            <p className="text-sm">Score: {me?.score ?? 0}</p>
            <p className="text-sm">Solve time: {formatMs(me?.solve_time_ms ?? null)}</p>
            <p className="text-sm">Submissions: {me?.submission_count ?? 0}</p>
            <p className="text-sm">
              ELO: {me?.elo_delta && me.elo_delta > 0 ? "+" : ""}
              {me?.elo_delta ?? 0}
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Opponent</h2>
            <p className="mt-2 text-sm text-muted">{opp?.username}</p>
            <p className="text-sm">Score: {opp?.score ?? 0}</p>
            <p className="text-sm">Solve time: {formatMs(opp?.solve_time_ms ?? null)}</p>
            <p className="text-sm">Submissions: {opp?.submission_count ?? 0}</p>
            <p className="text-sm">
              ELO: {opp?.elo_delta && opp.elo_delta > 0 ? "+" : ""}
              {opp?.elo_delta ?? 0}
            </p>
          </Card>
        </section>
      ) : null}

      <div className="flex gap-3">
        <Link href="/dashboard" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm">
          Back to dashboard
        </Link>
        <Link href="/room/new" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">
          New battle
        </Link>
      </div>
    </main>
  );
}
