"use client";

import { CodeDiffViewer } from "@/components/code-diff-viewer";

export interface AgentEvent {
  type: "tool_call" | "observation" | "file_change" | "user_message" | "agent_message" | string;
  data: any;
  createdAt?: string;
}

interface AgentEventViewProps {
  events: AgentEvent[];
}

export function AgentEventView({ events }: AgentEventViewProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-3 my-3">
      {events.map((event, idx) => {
        if (event.type === "tool_call") {
          return (
            <div key={idx} className="border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <span>🔧 Tool Call:</span>
                <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  {event.data?.tool || event.data?.action || "agent_tool"}
                </code>
              </p>
              {event.data?.input && (
                <pre className="bg-blue-100/60 dark:bg-blue-950 p-2 rounded text-[11px] overflow-x-auto font-mono">
                  {typeof event.data.input === "string"
                    ? event.data.input
                    : JSON.stringify(event.data.input, null, 2)}
                </pre>
              )}
            </div>
          );
        }

        if (event.type === "observation") {
          return (
            <div key={idx} className="border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-green-800 dark:text-green-300">📊 Execution Result:</p>
              <pre className="bg-green-100/60 dark:bg-green-950 p-2 rounded text-[11px] overflow-x-auto font-mono text-green-950 dark:text-green-200">
                {typeof event.data === "string" ? event.data : JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          );
        }

        if (event.type === "file_change" && Array.isArray(event.data?.changes)) {
          return <CodeDiffViewer key={idx} changes={event.data.changes} />;
        }

        return null;
      })}
    </div>
  );
}

