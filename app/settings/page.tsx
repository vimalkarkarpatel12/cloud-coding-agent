"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [configuredSecrets, setConfiguredSecrets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSecret, setSavingSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/secrets")
      .then((res) => res.json())
      .then((data) => {
        if (data.configuredSecrets) {
          setConfiguredSecrets(data.configuredSecrets);
        }
      })
      .catch((err) => console.error("Failed to load settings", err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(secretName: string, value: string) {
    if (!value) return;
    setSavingSecret(secretName);
    setMessage(null);

    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretName, value }),
      });

      if (!res.ok) throw new Error("Failed to save secret");

      const data = await res.json();
      if (!configuredSecrets.includes(secretName)) {
        setConfiguredSecrets((prev) => [...prev, secretName]);
      }

      if (secretName === "ANTHROPIC_API_KEY") setAnthropicKey("");
      if (secretName === "OPENAI_API_KEY") setOpenaiKey("");

      setMessage({ type: "success", text: `${secretName} saved securely!` });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: `Failed to save ${secretName}` });
    } finally {
      setSavingSecret(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-2">Platform Settings</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Configure your encryption-backed LLM API keys for running OpenHands autonomous coding agents.
      </p>

      {message && (
        <div
          className={`p-3 rounded-md mb-6 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Anthropic Key */}
        <div className="border rounded-lg p-6 space-y-4 shadow-sm bg-card">
          <div className="flex items-center justify-between">
            <Label htmlFor="anthropic-key" className="font-semibold text-base">
              Anthropic API Key
            </Label>
            {configuredSecrets.includes("ANTHROPIC_API_KEY") ? (
              <Badge variant="default" className="bg-green-600">
                ✓ Configured
              </Badge>
            ) : (
              <Badge variant="outline">Not Set</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Used for Claude Opus / Sonnet models during agent task execution.
          </p>
          <div className="flex gap-3">
            <Input
              id="anthropic-key"
              type="password"
              placeholder={
                configuredSecrets.includes("ANTHROPIC_API_KEY")
                  ? "••••••••••••••••••••••••••••"
                  : "sk-ant-..."
              }
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
            />
            <Button
              onClick={() => handleSave("ANTHROPIC_API_KEY", anthropicKey)}
              disabled={!anthropicKey || savingSecret === "ANTHROPIC_API_KEY"}
            >
              {savingSecret === "ANTHROPIC_API_KEY" ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* OpenAI Key */}
        <div className="border rounded-lg p-6 space-y-4 shadow-sm bg-card">
          <div className="flex items-center justify-between">
            <Label htmlFor="openai-key" className="font-semibold text-base">
              OpenAI API Key
            </Label>
            {configuredSecrets.includes("OPENAI_API_KEY") ? (
              <Badge variant="default" className="bg-green-600">
                ✓ Configured
              </Badge>
            ) : (
              <Badge variant="outline">Not Set</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Used for GPT-4o models during agent task execution.
          </p>
          <div className="flex gap-3">
            <Input
              id="openai-key"
              type="password"
              placeholder={
                configuredSecrets.includes("OPENAI_API_KEY")
                  ? "••••••••••••••••••••••••••••"
                  : "sk-..."
              }
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            <Button
              onClick={() => handleSave("OPENAI_API_KEY", openaiKey)}
              disabled={!openaiKey || savingSecret === "OPENAI_API_KEY"}
            >
              {savingSecret === "OPENAI_API_KEY" ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
