"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { Problem } from "@/lib/types";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ProblemDetail = Problem & {
  testCases?: Array<{ input: string; expected_output: string; is_hidden: boolean }>;
};

type PracticeResult = {
  verdict: string;
  runtimeMs: number;
  testCasesPassed: number;
  testCasesTotal: number;
  practice: true;
  test_details: Array<{
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
};

type HintResponse = { hint: string };

const MONACO_LANG_MAP: Record<string, string> = {
  javascript: "javascript",
  python: "python",
  cpp: "cpp",
  java: "java",
};

export default function ProblemDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = useMemo(() => String(params.slug), [params.slug]);
  const router = useRouter();
  const { token } = useAuth();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");

  // Practice mode
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");

  // Hint
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<ProblemDetail>({ path: `/api/problems/${slug}`, token })
      .then((data) => {
        setProblem(data);
        if (data.starterCode) {
          const starterCodeMap = data.starterCode as Record<string, string>;
          setCode(starterCodeMap["javascript"] || starterCodeMap[Object.keys(starterCodeMap)[0]] || "");
          const firstLang = Object.keys(starterCodeMap)[0] || "javascript";
          setLanguage(firstLang);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load problem"))
      .finally(() => setLoading(false));
  }, [token, slug]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (problem?.starterCode) {
      const starterCodeMap = problem.starterCode as Record<string, string>;
      setCode(starterCodeMap[newLang] || `// Starter code for ${newLang}\n`);
    }
    setPracticeResult(null);
  };

  const handleSubmitPractice = async () => {
    if (!token || !problem) return;
    setSubmitting(true);
    setPracticeResult(null);
    try {
      const result = await apiRequest<PracticeResult>({
        path: "/api/submissions/practice",
        method: "POST",
        token,
        body: { problemId: problem.id, code, language },
      });
      setPracticeResult(result);
      setActiveTab("submissions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!token || !problem) return;
    setHintLoading(true);
    try {
      const res = await apiRequest<HintResponse>({
        path: "/api/ai/hint",
        method: "POST",
        token,
        body: { problemSlug: slug, currentCode: code, language },
      });
      setHint(res.hint);
      setShowHint(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get hint");
    } finally {
      setHintLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted">Loading problem...</p>
        </div>
      </main>
    );
  }

  if (!problem) {
    return (
      <main className="text-center py-20 space-y-4">
        <p className="text-xl text-muted">Problem not found</p>
        <Link href="/problems" className="text-primary hover:underline text-sm">Back to Problems</Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col lg:flex-row gap-4 min-h-[80vh]">
      {/* ── Left: Problem Description ── */}
      <div className="lg:w-[45%] flex flex-col gap-4">
        {/* Problem Header */}
        <Card className="bg-slate-900/80 border-slate-700/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <Link href="/problems" className="text-xs text-muted hover:text-primary">← Back to Problems</Link>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              problem.difficulty === "easy" ? "bg-green-900/60 text-green-300" :
              problem.difficulty === "medium" ? "bg-yellow-900/60 text-yellow-300" :
              "bg-red-900/60 text-red-300"
            }`}>
              {problem.difficulty?.toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{problem.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {problem.topics?.map((t) => (
              <span key={t} className="text-xs bg-primary/10 text-primary-soft px-2 py-0.5 rounded-full border border-primary/20">
                {t}
              </span>
            ))}
            {problem.companyTags?.map((t) => (
              <span key={t} className="text-xs bg-cyan-900/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-700/20">
                {t}
              </span>
            ))}
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("description")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              activeTab === "description" ? "bg-slate-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
              activeTab === "submissions" ? "bg-slate-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Results {practiceResult ? "PASSED" : ""}
          </button>
        </div>

        {activeTab === "description" && (
          <Card className="bg-slate-900/80 border-slate-700/60 p-5 flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-4 text-sm">
              <div>
                <h2 className="font-semibold text-white mb-2">Description</h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{problem.description}</p>
              </div>

              {problem.constraints && (
                <div>
                  <h2 className="font-semibold text-white mb-2">Constraints</h2>
                  <pre className="font-mono text-xs text-gray-400 bg-slate-950/60 p-3 rounded-lg whitespace-pre-wrap">
                    {problem.constraints}
                  </pre>
                </div>
              )}

              {problem.examples && problem.examples.length > 0 && (
                <div>
                  <h2 className="font-semibold text-white mb-2">Examples</h2>
                  <div className="space-y-3">
                    {problem.examples.map((ex, i) => (
                      <div key={i} className="bg-slate-950/60 rounded-xl p-3 border border-slate-700/30 font-mono text-xs">
                        <div className="mb-1.5">
                          <span className="text-blue-400 font-semibold">Input: </span>
                          <span className="text-gray-300">{ex.input}</span>
                        </div>
                        <div className="mb-1.5">
                          <span className="text-green-400 font-semibold">Output: </span>
                          <span className="text-gray-300">{ex.output}</span>
                        </div>
                        {ex.explanation && (
                          <div>
                            <span className="text-yellow-400 font-semibold">Explanation: </span>
                            <span className="text-gray-400">{ex.explanation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === "submissions" && (
          <Card className="bg-slate-900/80 border-slate-700/60 p-5 flex-1 overflow-y-auto scrollbar-thin">
            {practiceResult ? (
              <div className="space-y-4">
                {/* Verdict banner */}
                <div className={`rounded-xl p-4 text-center ${
                  practiceResult.verdict === "accepted" ? "bg-green-900/30 border border-green-600/40" :
                  "bg-red-900/30 border border-red-600/40"
                }`}>
                  <p className={`text-2xl font-black ${
                    practiceResult.verdict === "accepted" ? "text-green-400" : "text-red-400"
                  }`}>
                    {practiceResult.verdict === "accepted" ? "✓ ACCEPTED" : "✗ " + practiceResult.verdict.toUpperCase().replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {practiceResult.testCasesPassed}/{practiceResult.testCasesTotal} tests passed · {practiceResult.runtimeMs}ms
                  </p>
                </div>

                {/* Test case details */}
                <div>
                  <h3 className="font-semibold text-white mb-2 text-sm">Test Case Results</h3>
                  <div className="space-y-2">
                    {practiceResult.test_details.map((tc, i) => (
                      <div key={i} className={`rounded-lg p-3 text-xs font-mono border ${
                        tc.passed ? "bg-green-950/20 border-green-700/30" : "bg-red-950/20 border-red-700/30"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-sans text-gray-400 text-[10px] uppercase">Test {i + 1}</span>
                          <span className={`font-sans font-bold ${tc.passed ? "text-green-400" : "text-red-400"}`}>
                            {tc.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <p><span className="text-blue-400">Input:</span> {tc.input}</p>
                        <p><span className="text-green-400">Expected:</span> {tc.expected}</p>
                        <p><span className={tc.passed ? "text-green-400" : "text-red-400"}>Actual:</span> {tc.actual}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p className="text-lg mb-2">📝</p>
                <p>Submit your code to see results</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── Right: Code Editor ── */}
      <div className="lg:w-[55%] flex flex-col gap-2">
        {/* Editor toolbar */}
        <div className="flex items-center gap-2 bg-slate-900/80 rounded-xl border border-slate-700/60 px-3 py-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-gray-200 outline-none cursor-pointer"
          >
            {problem.starterCode &&
              Object.keys(problem.starterCode).map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
          </select>

          <span className="text-xs text-gray-500">{code.split("\n").length} lines</span>
          <div className="flex-1" />

          <Button
            onClick={handleHint}
            disabled={hintLoading}
            className="text-xs h-7 px-3 bg-blue-700/80 hover:bg-blue-600 border-0"
            size="sm"
          >
            {hintLoading ? "..." : "💡 Hint"}
          </Button>

          <Button
            onClick={handleSubmitPractice}
            disabled={submitting}
            className="text-xs h-7 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-0 font-bold shadow-lg"
            size="sm"
          >
            {submitting ? "Running..." : "▶ Run & Test"}
          </Button>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-[400px] rounded-xl border border-slate-700/60 overflow-hidden bg-slate-950/90">
          <MonacoEditor
            height="100%"
            language={MONACO_LANG_MAP[language] || "javascript"}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12 },
              renderLineHighlight: "all",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              bracketPairColorization: { enabled: true },
              fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
            }}
          />
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800/40 rounded-lg px-3 py-2 text-xs text-red-300">
            {error}
            <button onClick={() => setError("")} className="float-right text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
      </div>

      {/* ══ HINT MODAL ══ */}
      {showHint && hint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="max-w-lg w-full mx-4 bg-slate-800 border-blue-700/50 shadow-2xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-white">💡 AI Hint</h3>
                <button onClick={() => setShowHint(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
              </div>
              <div className="bg-blue-950/50 border border-blue-700/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-200 leading-relaxed">{hint}</p>
              </div>
              <p className="text-xs text-gray-500">Hints nudge you in the right direction without revealing the solution.</p>
              <Button onClick={() => setShowHint(false)} className="mt-3 w-full bg-blue-700">Close</Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
