export function FiibAdmissionAd({ wide = false }: { wide?: boolean }) {
  return (
    <section aria-label="FIIB advertisement" className={`relative isolate overflow-hidden rounded-xl bg-slate-950 text-white ${wide ? "mx-auto my-3 flex min-h-24 max-w-4xl items-center sm:min-h-28" : "flex min-h-36 items-end sm:min-h-48 lg:min-h-72"}`}>
      <img src="/brand/fiib-campus.jpg" alt="FIIB campus" width="504" height="372"
        className={`absolute inset-y-0 right-0 -z-20 h-full object-cover ${wide ? "w-1/2 object-center" : "w-full"}`} />
      <div aria-hidden="true" className={`absolute inset-0 -z-10 ${wide ? "bg-gradient-to-r from-slate-950 via-slate-950 to-transparent" : "bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent"}`} />
      <span className="absolute right-2 top-2 rounded bg-slate-950/85 px-2 py-1 text-[10px] text-white">Advertisement</span>
      <div className="px-4 py-4 sm:px-6">
        <p className="max-w-[18ch] text-xs font-medium text-white sm:max-w-none">Fortune Institute of International Business</p>
        <p className="mt-1 text-xl font-bold leading-tight sm:text-3xl">FIIB <span className="text-amber-300">Admission 2027</span></p>
      </div>
    </section>
  );
}
