"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Match, Problem, Submission } from "@/lib/types";

type MatchDetails = Match & {
  problem: Problem;
  player1: { id: string; username: string; elo: number };
  player2: { id: string; username: string; elo: number };
};

export default function BattlePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const router = useRouter();
  const { token } = useAuth();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitStatus, setSubmitStatus] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiRequest<MatchDetails>({ path: `/api/matches/${matchId}`, token })
      .then((data) => {
        if (data.status !== "active") {
          router.replace(`/matches/${matchId}/debrief`);
          return;
        }
        setMatch(data);
        setCode(data.problem.starterCode?.javascript ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load match"));
  }, [token, matchId, router]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("room:join", { room_code: matchId });
    socket.on("match:timer_tick", ({ remaining_ms }: { remaining_ms: number }) => setRemainingMs(remaining_ms));
    socket.on("match:opponent_typing", () => setEventStatus("Opponent is typing..."));
    socket.on("match:idle_warning", () => setEventStatus("Idle warning received."));
    socket.on("match:ended", ({ reason }: { reason: string }) => {
      setEventStatus(`Match ended: ${reason}`);
      window.setTimeout(() => router.push(`/matches/${matchId}/debrief`), 600);
    });

    return () => {
      socket.emit("room:leave", { room_code: matchId });
      socket.off("match:timer_tick");
      socket.off("match:opponent_typing");
      socket.off("match:idle_warning");
      socket.off("match:ended");
    };
  }, [token, matchId, router]);

  const submit = async () => {
    if (!token) return;
    setSubmitStatus("Submitting...");
    try {
      const result = await apiRequest<Submission>({
        path: "/api/submissions",
        method: "POST",
        token,
        body: { matchId, code, language },
      });
      setSubmitStatus(`Verdict: ${result.verdict} (${result.testCasesPassed}/${result.testCasesTotal})`);
    } catch (err) {
      setSubmitStatus("");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const surrender = async () => {
    if (!token) return;
    try {
      await apiRequest({ path: `/api/matches/${matchId}/surrender`, method: "POST", token });
      setEventStatus("You surrendered.");
      window.setTimeout(() => router.push(`/matches/${matchId}/debrief`), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Surrender failed");
    }
  };

  const onCodeChange = (next: string) => {
    setCode(next);
    if (token) {
      const socket = getSocket(token);
      socket.emit("code:update", { match_id: matchId, code_length: next.length, cursor_line: 0 });
      socket.emit("idle:heartbeat", { match_id: matchId });
    }
  };

  return (
    <main className="grid gap-4 lg:grid-cols-5">
      <Card className="space-y-3 lg:col-span-2">
        <p className="text-sm text-muted">Battle Arena</p>
        <h1 className="text-xl font-semibold">{match?.problem.title ?? "Loading..."}</h1>
        <p className="text-xs uppercase tracking-wide text-primary-soft">{match?.problem.difficulty}</p>
        <p className="whitespace-pre-wrap text-sm text-muted">{match?.problem.description}</p>
        <p className="text-sm text-muted">
          Time left: {remainingMs !== null ? `${Math.max(0, Math.floor(remainingMs / 1000))}s` : "waiting"}
        </p>
        {eventStatus ? <p className="text-sm text-emerald-400">{eventStatus}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </Card>
      <Card className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap gap-2">
          {["javascript", "python", "cpp", "java"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLanguage(value)}
              className={`rounded-md border px-3 py-1 text-xs uppercase tracking-wide ${
                language === value ? "border-primary bg-primary/20 text-primary-soft" : "border-border text-muted"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="h-[380px] w-full rounded-lg border border-border bg-[#090b10] p-3 font-mono text-sm outline-none focus:border-primary"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <Button onClick={submit}>Submit</Button>
          <Button variant="outline" onClick={surrender}>
            Surrender
          </Button>
        </div>
        {submitStatus ? <p className="text-sm text-primary-soft">{submitStatus}</p> : null}
      </Card>
    </main>
  );
}
