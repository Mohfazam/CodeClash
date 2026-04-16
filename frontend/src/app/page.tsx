export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-surface/90 p-10 shadow-[0_20px_80px_-30px_rgba(124,58,237,0.5)] backdrop-blur">
        <p className="mb-3 text-sm uppercase tracking-[0.22em] text-primary-soft">CodeClash Platform</p>
        <h1 className="text-4xl font-semibold tracking-tight">Realtime 1v1 coding battles for serious builders.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Compete in timed arena matches, climb your ELO, and get AI-driven insights. This frontend is synced to your existing backend API.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/login"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-soft"
          >
            Login
          </a>
          <a
            href="/register"
            className="rounded-lg border border-border bg-surface-soft px-5 py-2.5 text-sm font-medium transition hover:border-primary-soft"
          >
            Create account
          </a>
        </div>
      </div>
    </main>
  );
}
