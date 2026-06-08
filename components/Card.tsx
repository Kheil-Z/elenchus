import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddingClasses = {
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "bg-surface rounded-xl border border-border",
        paddingClasses[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
