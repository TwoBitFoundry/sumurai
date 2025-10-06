import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/18 p-6 shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/25 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
      </div>
      <div className={`relative z-10 ${className}`.trim()}>
        {children}
      </div>
    </div>
  );
}

export default Card;
