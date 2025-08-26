import { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={
        "px-4 py-2 rounded bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div className={"border rounded-lg p-4 bg-white " + className} {...props} />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={"border rounded px-3 py-2 outline-none focus:ring w-full " + className}
      {...props}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200/80 dark:bg-gray-700/30 ${className}`} aria-hidden />
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">{children}</span>
  );
}
