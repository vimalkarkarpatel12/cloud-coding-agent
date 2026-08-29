import { popSandboxJob, SandboxJobData } from "@/lib/queue";
import { db } from "@/lib/db/queries";
import { agentSession, agentAction } from "@/lib/db/schema";
import { getUserSecret } from "@/lib/secrets";
import { eq } from "drizzle-orm";

const OPENHANDS_URL = process.env.OPENHANDS_API_URL || "http://127.0.0.1:3002";
const JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max execution time

export async function processSandboxJob(job: SandboxJobData) {
  const { sessionId, userId, taskDescription, model = "claude-3-5-sonnet-20241022" } = job;

  console.log(`[Worker] Processing sandbox job for session ${sessionId}...`);

  try {
    // 1. Fetch user's LLM key
    let llmKey = await getUserSecret(userId, "ANTHROPIC_API_KEY");
    if (!llmKey) {
      llmKey = process.env.OPENHANDS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    }

    // 2. Record worker start action
    await db.insert(agentAction).values({
      sessionId,
      actionType: "worker_start",
      actionData: { status: "started", model, timestamp: new Date().toISOString() },
    });

    // 3. Initiate OpenHands Session
    const ohRes = await fetch(`${OPENHANDS_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: taskDescription,
        llm_api_key: llmKey,
        model,
        workspace: "docker",
      }),
    });

    if (!ohRes.ok) {
      const errText = await ohRes.text();
      console.warn(`[Worker] OpenHands creation failed: ${ohRes.status} ${errText}`);

      await db
        .update(agentSession)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(agentSession.id, sessionId));

      await db.insert(agentAction).values({
        sessionId,
        actionType: "error",
        actionData: { message: `OpenHands server returned ${ohRes.status}`, details: errText },
      });

      return { success: false, error: errText };
    }

    const ohData = await ohRes.json();
    const openhandsSessionId = ohData.session_id || ohData.id;

    // Update DB with OpenHands session ID and status running
    await db
      .update(agentSession)
      .set({
        openhands_session_id: openhandsSessionId,
        status: "running",
        updatedAt: new Date(),
      })
      .where(eq(agentSession.id, sessionId));

    await db.insert(agentAction).values({
      sessionId,
      actionType: "session_created",
      actionData: { openhandsSessionId, status: "running" },
    });

    console.log(`[Worker] Job for session ${sessionId} successfully initialized with OpenHands ID ${openhandsSessionId}`);
    return { success: true, openhandsSessionId };
  } catch (err) {
    console.error(`[Worker] Error processing sandbox job for session ${sessionId}:`, err);

    await db
      .update(agentSession)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(agentSession.id, sessionId));

    await db.insert(agentAction).values({
      sessionId,
      actionType: "error",
      actionData: { message: String(err) },
    });

    return { success: false, error: String(err) };
  }
}

/**
 * Worker loop for continuous background job polling.
 */
export async function runWorkerLoop(stopSignal?: { stop: boolean }) {
  console.log("[Worker] Starting Sandbox Worker queue loop...");

  while (!stopSignal?.stop) {
    try {
      const job = await popSandboxJob(2);
      if (job) {
        await processSandboxJob(job);
      }
    } catch (err) {
      console.error("[Worker] Error in queue loop iteration:", err);
    }
  }
}
