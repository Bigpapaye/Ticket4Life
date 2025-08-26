"use client";

import React, { useState } from "react";

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <span className="absolute z-40 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-black text-white text-xs px-2 py-1 shadow">
          {content}
        </span>
      )}
    </span>
  );
}
