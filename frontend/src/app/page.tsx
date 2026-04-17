import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#08090d]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-purple-900/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-t from-cyan-900/10 to-transparent rounded-full blur-3xl" />
        {/* Floating code snippets */}
        <div className="absolute top-[15%] left-[10%] text-purple-500/10 font-mono text-sm animate-float" style={{ animationDelay: "0s" }}>
          {"function solve(n) {"}
        </div>
        <div className="absolute top-[25%] right-[15%] text-cyan-500/10 font-mono text-sm animate-float" style={{ animationDelay: "1s" }}>
          {"  return dp[n - 1];"}
        </div>
        <div className="absolute top-[40%] left-[20%] text-green-500/10 font-mono text-sm animate-float" style={{ animationDelay: "2s" }}>
          {"for (let i = 0; i < n; i++)"}
        </div>
        <div className="absolute top-[55%] right-[10%] text-yellow-500/10 font-mono text-sm animate-float" style={{ animationDelay: "0.5s" }}>
          {"// O(n log n) solution"}
        </div>
        <div className="absolute top-[70%] left-[5%] text-red-500/10 font-mono text-sm animate-float" style={{ animationDelay: "1.5s" }}>
          {"ACCEPTED"}
        </div>
      </div>

      {/* Nav */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">⚔</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            CodeClash
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-muted hover:text-white transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition shadow-lg shadow-purple-500/20"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-950/30 text-xs text-purple-300 mb-8">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live competitive coding platform
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1]">
            <span className="text-white">Code.</span>{" "}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Clash.</span>{" "}
            <span className="text-white">Conquer.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Real-time 1v1 coding battles with ELO ranking, AI-powered coaching, and
            competitive insights. Challenge opponents. Prove your skills. Rise through the ranks.
          </p>

          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="group relative px-8 py-3.5 text-base font-bold text-white rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition shadow-2xl shadow-purple-500/25 hover:shadow-purple-500/40"
            >
              Start Battling — Free
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 opacity-0 group-hover:opacity-20 blur-xl transition" />
            </Link>
            <Link
              href="/problems"
              className="px-8 py-3.5 text-base font-medium rounded-xl border border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-500 hover:text-white transition backdrop-blur"
            >
              Browse Problems
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">Why CodeClash?</h2>
          <p className="text-muted mt-3 max-w-xl mx-auto">
            Everything you need to sharpen your competitive programming skills
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: "BATTLE",
              title: "1v1 Code Battles",
              desc: "Real-time competitive matches with live timers, opponent tracking, and instant verdict feedback.",
              gradient: "from-purple-500/10 to-purple-500/0",
              border: "border-purple-500/20",
            },
            {
              icon: "🧠",
              title: "AI-Powered Insights",
              desc: "Get AI hints during battles, post-match code reviews, complexity analysis, and personalized coaching.",
              gradient: "from-cyan-500/10 to-cyan-500/0",
              border: "border-cyan-500/20",
            },
            {
              icon: "📊",
              title: "ELO Rating System",
              desc: "Track your progress with a competitive ELO system. Climb ranks from Bronze to Legend.",
              gradient: "from-amber-500/10 to-amber-500/0",
              border: "border-amber-500/20",
            },
            {
              icon: "🔥",
              title: "Dead Man's Switch",
              desc: "Stay active or lose lines of code. The idle penalty keeps battles intense and focused.",
              gradient: "from-red-500/10 to-red-500/0",
              border: "border-red-500/20",
            },
            {
              icon: "🎯",
              title: "Practice Mode",
              desc: "Solve problems outside of battles with our full-featured practice editor and test runner.",
              gradient: "from-green-500/10 to-green-500/0",
              border: "border-green-500/20",
            },
            {
              icon: "TROPHY",
              title: "Rank System",
              desc: "Bronze → Silver → Gold → Platinum → Diamond → Master → Legend. Where will you land?",
              gradient: "from-yellow-500/10 to-yellow-500/0",
              border: "border-yellow-500/20",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`rounded-2xl border ${feature.border} bg-gradient-to-br ${feature.gradient} to-surface p-6 hover:border-opacity-50 transition group`}
            >
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
              <h3 className="font-bold text-lg text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">How It Works</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-4">
          {[
            { step: "1", title: "Create Room", desc: "Set difficulty, time limit, and battle options", icon: "🏠" },
            { step: "2", title: "Challenge", desc: "Share your room code with an opponent", icon: "📨" },
            { step: "3", title: "Battle", desc: "Solve the same problem head-to-head in real time", icon: "⚔️" },
            { step: "4", title: "Level Up", desc: "Gain ELO, get AI feedback, and improve", icon: "📈" },
          ].map((item) => (
            <div key={item.step} className="text-center group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-cyan-900/30 border border-purple-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div className="w-8 h-8 mx-auto -mt-2 mb-3 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                {item.step}
              </div>
              <h3 className="font-bold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-cyan-950/10 p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-cyan-600/5" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Ready to prove yourself?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join the arena. Your first battle is waiting.
            </p>
            <Link
              href="/register"
              className="inline-flex px-10 py-4 text-lg font-bold text-white rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition shadow-2xl shadow-purple-500/25"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} CodeClash. Built for competitive programmers.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/problems" className="hover:text-white transition">Problems</Link>
            <Link href="/leaderboard" className="hover:text-white transition">Leaderboard</Link>
            <Link href="/login" className="hover:text-white transition">Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
