"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { KeyRound, ChevronRight } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>
        <div className="mt-6 space-y-2">
          <Link
            href="/settings/agents"
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 hover:bg-[var(--bg-hover)]"
          >
            <span className="flex items-center gap-3">
              <KeyRound size={18} className="text-[var(--text-secondary)]" />
              <span>
                <span className="block text-sm font-medium text-[var(--text-primary)]">Agents</span>
                <span className="block text-xs text-[var(--text-tertiary)]">
                  API keys for AI agents (MCP)
                </span>
              </span>
            </span>
            <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
