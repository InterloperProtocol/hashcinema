"use client";

import type { ReactNode } from "react";

export function HyperflowAssemblyScaffold(input: {
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hyperflow-shell">
      <div className="hyperflow-layout">
        <aside className="hyperflow-left-rail">{input.leftRail}</aside>
        <main className="hyperflow-main">{input.children}</main>
        <aside className="hyperflow-right-rail">{input.rightRail}</aside>
      </div>
    </div>
  );
}
