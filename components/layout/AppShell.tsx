"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BottomNav } from "@/components/navigation/BottomNav";
import { cn } from "@/lib/utils";

export function AppShell({ children, showNav = true, className }: { children: React.ReactNode; showNav?: boolean; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <main
      id="main-content"
      className="relative mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col bg-canvas shadow-soft md:my-6 md:min-h-[880px] md:overflow-hidden md:rounded-[2.25rem] md:border md:border-line"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={cn("flex-1 px-5 pb-[calc(7.5rem+var(--safe-bottom))] pt-[calc(1.5rem+var(--safe-top))]", className)}
      >
        {children}
      </motion.div>
      {showNav ? <BottomNav /> : null}
    </main>
  );
}
