"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { Problem } from "@/lib/types";

type ProblemListResponse = {
  problems: Problem[];
  total: number;
  limit: number;
  offset: number;
};

export default function ProblemsPage() {
  const { token } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    let path = `/api/problems?limit=${limit}&offset=${offset}`;
    if (difficulty) path += `&difficulty=${difficulty}`;
    if (topic) path += `&topic=${topic}`;

    apiRequest<ProblemListResponse>({ path, token })
      .then((res) => {
        setProblems(res.problems);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load problems"))
      .finally(() => setLoading(false));
  }, [token, difficulty, topic, offset, limit]);

  const filteredProblems = search
    ? problems.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.topics.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : problems;

  const handleRandomProblem = async () => {
    if (!token) return;
    try {
      let path = "/api/problems/random";
      if (difficulty) path += `?difficulty=${difficulty}`;
      const problem = await apiRequest<Problem>({ path, token });
      window.location.href = `/problems/${problem.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No problems found");
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const difficultyColor = (d: string) => {
    switch (d) {
      case "easy": return "bg-green-900/40 text-green-300 border-green-700/30";
      case "medium": return "bg-yellow-900/40 text-yellow-300 border-yellow-700/30";
      case "hard": return "bg-red-900/40 text-red-300 border-red-700/30";
      default: return "bg-gray-900/40 text-gray-300";
    }
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Problems</h1>
          <p className="text-muted text-sm mt-1">{total} problems available</p>
        </div>
        <Button
          onClick={handleRandomProblem}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
        >
          🎲 Random Problem
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search problems..."
          className="max-w-xs"
        />

        <div className="flex gap-1.5">
          {["", "easy", "medium", "hard"].map((d) => (
            <button
              key={d}
              onClick={() => { setDifficulty(d); setOffset(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                difficulty === d
                  ? d === "" ? "bg-primary text-white border-primary" : difficultyColor(d)
                  : "bg-transparent text-gray-400 border-border hover:border-gray-500"
              } ${difficulty === d && d !== "" ? "ring-1 ring-current" : ""}`}
            >
              {d === "" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <Input
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setOffset(0); }}
          placeholder="Filter by topic..."
          className="max-w-[160px]"
        />
      </div>

      {/* Problem List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : filteredProblems.length === 0 ? (
        <Card className="py-8 text-center text-muted">
          <p className="text-lg mb-2">📚</p>
          <p>No problems found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProblems.map((problem) => (
            <Link key={problem.id} href={`/problems/${problem.slug}`}>
              <Card className="p-4 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="font-semibold text-white group-hover:text-primary-soft transition truncate">
                      {problem.title}
                    </h2>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${difficultyColor(problem.difficulty)}`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {problem.topics?.slice(0, 4).map((t) => (
                      <span key={t} className="text-xs bg-slate-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                    {problem.companyTags?.slice(0, 2).map((t) => (
                      <span key={t} className="text-xs bg-cyan-900/20 text-cyan-400 px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-primary opacity-0 group-hover:opacity-100 transition font-medium">
                  Solve →
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between gap-4 pt-4">
          <p className="text-xs text-muted">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-surface-soft transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-muted">
              Page {currentPage} of {pages}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= pages}
              className="px-3 py-1 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-surface-soft transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
