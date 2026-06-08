"use client";

import { Avatar } from "./Avatar";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar name="Marie" color="green" size="sm" className="shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold" style={{ color: "#15803D" }}>
          Marie
        </span>
        <div className="flex items-center gap-1 py-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
