export default function FloatingTimeline({ activeYear, onYearChange }: { activeYear: number, onYearChange: (year: number) => void }) {
  const years = [2023, 2024, 2025, 2026];
  
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800/80 px-6 py-3 rounded-2xl shadow-2xl z-20 flex items-center gap-8 pointer-events-auto">
      <span className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase">Chronology</span>
      <div className="flex items-center gap-2">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => onYearChange(year)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all duration-300 ${
              activeYear === year 
                ? 'bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/10' 
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}