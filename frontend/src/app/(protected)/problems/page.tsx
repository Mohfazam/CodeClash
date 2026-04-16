"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type Problem = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  description: string;
  constraints: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  acceptanceRate?: number;
  attemptCount?: number;
};

type ProblemsResponse = {
  problems: Problem[];
  total: number;
};

const DIFFICULTIES = ["easy", "medium", "hard"];
const TOPICS = [
  "Arrays",
  "Strings",
  "Trees",
  "Graphs",
  "Hashing",
  "Sorting",
  "Dynamic Programming",
  "Recursion",
  "Stacks",
  "Queues",
  "Linked Lists",
  "Binary Search",
];

export default function ProblemsPage() {
  const { token } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);
    if (selectedDifficulty) params.append("difficulty", selectedDifficulty);
    if (selectedTopic) params.append("topic", selectedTopic);

    apiRequest<ProblemsResponse>({
      path: `/api/problems?${params.toString()}`,
      token,
    })
      .then((res) => {
        setProblems(res.problems);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load problems"))
      .finally(() => setLoading(false));
  }, [token, search, selectedDifficulty, selectedTopic, limit, offset]);

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-900/30 text-green-300 border-green-600";
      case "medium":
        return "bg-yellow-900/30 text-yellow-300 border-yellow-600";
      case "hard":
        return "bg-red-900/30 text-red-300 border-red-600";
      default:
        return "bg-gray-900/30 text-gray-300 border-gray-600";
    }
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Problem Browser</h1>
        <p className="text-sm text-muted mt-1">Explore and practice coding problems</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <div>
          <label className="text-sm font-semibold text-muted block mb-2">Search</label>
          <Input
            type="text"
            placeholder="Search by problem title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-muted block mb-2">Difficulty</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setSelectedDifficulty(null);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 rounded border text-sm transition ${
                  selectedDifficulty === null
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  onClick={() => {
                    setSelectedDifficulty(diff);
                    setOffset(0);
                  }}
                  className={`px-3 py-1.5 rounded border text-sm transition capitalize ${
                    selectedDifficulty === diff
                      ? `${getDifficultyColor(diff)} border-current`
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted block mb-2">Topic</label>
            <select
              value={selectedTopic || ""}
              onChange={(e) => {
                setSelectedTopic(e.target.value || null);
                setOffset(0);
              }}
              className="w-full rounded border border-border bg-surface-soft px-3 py-1.5 text-sm"
            >
              <option value="">All Topics</option>
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {/* Problems List */}
      {loading ? (
        <Card className="py-12 text-center text-muted">Loading problems...</Card>
      ) : problems.length === 0 ? (
        <Card className="py-12 text-center text-muted">No problems found</Card>
      ) : (
        <>
          <div className="space-y-3">
            {problems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block"
              >
                <Card className="p-4 hover:bg-surface-soft transition cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">{problem.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded border ${getDifficultyColor(problem.difficulty)}`}>
                          {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-muted line-clamp-2">{problem.description}</p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {problem.topics.slice(0, 3).map((topic) => (
                          <span key={topic} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {topic}
                          </span>
                        ))}
                        {problem.topics.length > 3 && (
                          <span className="text-xs text-muted">+{problem.topics.length - 3} more</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {problem.acceptanceRate !== undefined && (
                        <p className="text-sm text-muted">{Math.round(problem.acceptanceRate * 100)}%</p>
                      )}
                      {problem.attemptCount !== undefined && (
                        <p className="text-xs text-muted/70">{problem.attemptCount} attempts</p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 pt-6">
            <div className="text-sm text-muted">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-surface-soft"
              >
                ← Previous
              </button>
              <span className="text-sm text-muted">
                Page {currentPage} of {pages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= pages}
                className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-surface-soft"
              >
                Next →
              </button>
            </div>
            <div className="text-sm text-muted">
              Show:
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="ml-2 rounded border border-border bg-surface-soft px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
