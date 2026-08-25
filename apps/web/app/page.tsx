export default function Home() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <section
        className="w-full max-w-2xl rounded-xl border border-border bg-surface p-[clamp(1.5rem,5vw,3rem)]"
        aria-labelledby="page-title"
      >
        <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
          Aurbit
        </p>
        <h1
          className="text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.1] tracking-[-0.035em]"
          id="page-title"
        >
          Public web application
        </h1>
        <p className="mt-4 max-w-lg leading-[1.6] text-secondary">
          The public Aurbit experience will be implemented in a later stage.
        </p>
      </section>
    </main>
  );
}
