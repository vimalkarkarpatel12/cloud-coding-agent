"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface AgentSessionItem {
  id: string;
  taskDescription: string;
  status: string;
  openhands_session_id?: string;
  createdAt: string;
}

export function SessionList() {
  const [sessions, setSessions] = useState<AgentSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent/sessions")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSessions(data))
      .catch((err) => console.error("Failed to load agent sessions", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading agent sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground border rounded-lg">
        No active agent sessions yet. Start an agent task from the chat input.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Agent Sessions
      </h3>
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="p-3 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition"
          >
            <div className="space-y-1 overflow-hidden pr-2">
              <p className="text-sm font-medium truncate">{session.taskDescription}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString()} at{" "}
                {new Date(session.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <Badge
              variant={
                session.status === "running"
                  ? "default"
                  : session.status === "complete"
                  ? "secondary"
                  : "outline"
              }
            >
              {session.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

