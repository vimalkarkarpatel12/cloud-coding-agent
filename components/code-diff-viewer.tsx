"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FileChange {
  path: string;
  before: string;
  after: string;
  status: "added" | "modified" | "deleted";
}

interface CodeDiffViewerProps {
  changes: FileChange[];
  onApprove?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}

export function CodeDiffViewer({
  changes,
  onApprove,
  onReject,
  isLoading = false,
}: CodeDiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [selectedFile, setSelectedFile] = useState<string>(changes[0]?.path || "");

  if (!changes || changes.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground border rounded-lg">
        No code changes recorded.
      </div>
    );
  }

  const currentChange = changes.find((c) => c.path === selectedFile) || changes[0];

  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>📝 Agent Code Changes</span>
          <span className="text-xs font-normal text-muted-foreground">
            ({changes.length} file{changes.length > 1 ? "s" : ""})
          </span>
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === "unified" ? "default" : "outline"}
            onClick={() => setViewMode("unified")}
          >
            Unified
          </Button>
          <Button
            size="sm"
            variant={viewMode === "split" ? "default" : "outline"}
            onClick={() => setViewMode("split")}
          >
            Split
          </Button>
        </div>
      </div>

      {/* File selector tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b">
        {changes.map((change) => (
          <button
            key={change.path}
            onClick={() => setSelectedFile(change.path)}
            className={`text-xs px-3 py-1.5 rounded-md transition font-mono whitespace-nowrap flex items-center gap-1.5 ${
              selectedFile === change.path
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <span>
              {change.status === "added"
                ? "➕"
                : change.status === "modified"
                ? "✏️"
                : "🗑️"}
            </span>
            {change.path}
          </button>
        ))}
      </div>

      {/* Diff content view */}
      <div className="bg-muted/40 rounded-md p-3 font-mono text-xs overflow-x-auto border max-h-96">
        {viewMode === "unified" ? (
          <UnifiedView before={currentChange.before} after={currentChange.after} />
        ) : (
          <SplitView before={currentChange.before} after={currentChange.after} />
        )}
      </div>

      {/* Action buttons */}
      {(onApprove || onReject) && (
        <div className="flex gap-3 pt-2 border-t">
          {onApprove && (
            <Button
              onClick={onApprove}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              ✓ Approve & Commit
            </Button>
          )}
          {onReject && (
            <Button onClick={onReject} disabled={isLoading} variant="outline" className="flex-1">
              ✗ Reject Changes
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function UnifiedView({ before, after }: { before: string; after: string }) {
  const beforeLines = (before || "").split("\n");
  const afterLines = (after || "").split("\n");

  return (
    <div className="space-y-0.5">
      {beforeLines.map((line, i) => (
        <div key={`b-${i}`} className="bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded">
          <span className="select-none text-red-500 mr-2">-</span>
          {line}
        </div>
      ))}
      {afterLines.map((line, i) => (
        <div key={`a-${i}`} className="bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-300 px-2 py-0.5 rounded">
          <span className="select-none text-green-500 mr-2">+</span>
          {line}
        </div>
      ))}
    </div>
  );
}

function SplitView({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Original</p>
        <pre className="bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300 p-2 rounded overflow-x-auto whitespace-pre">
          {before}
        </pre>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Modified</p>
        <pre className="bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-300 p-2 rounded overflow-x-auto whitespace-pre">
          {after}
        </pre>
      </div>
    </div>
  );
}

