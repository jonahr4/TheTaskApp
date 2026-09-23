"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "taskapp.theme";

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "auto") return choice;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ThemeCtx = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (c: ThemeChoice) => void;
};

const Ctx = createContext<ThemeCtx>({ choice: "auto", resolved: "light", setChoice: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Load saved choice once
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "auto") {
        setChoiceState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Resolve + apply, and follow OS changes when on "auto"
  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(choice);
      setResolved(next);
      document.documentElement.dataset.theme = next;
    };
    apply();
    // Enable smooth transitions only after the first paint
    const t = setTimeout(() => document.body.classList.add("theme-anim"), 50);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (choice === "auto") apply();
    };
    mq.addEventListener("change", onChange);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", onChange);
    };
  }, [choice]);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // ignore storage errors
    }
  };

  return <Ctx.Provider value={{ choice, resolved, setChoice }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
