import { db } from "@/lib/db/queries";
import { agentSession, agentAction } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";

const OPENHANDS_URL = process.env.OPENHANDS_API_URL || "http://127.0.0.1:3002";

/**
 * Cleanup a specific agent sandbox by session ID.
 */
export async function cleanupSandbox(sessionId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const [sessionData] = await db
      .select()
      .from(agentSession)
      .where(eq(agentSession.id, sessionId))
      .limit(1);

    if (!sessionData) {
      return { success: false, message: "Session not found" };
    }

    if (sessionData.openhands_session_id) {
      try {
        await fetch(`${OPENHANDS_URL}/api/sessions/${sessionData.openhands_session_id}`, {
          method: "DELETE",
        });
      } catch (ohErr) {
        console.warn(`Failed to delete OpenHands session ${sessionData.openhands_session_id}:`, ohErr);
      }
    }

    // Update status in DB
    await db
      .update(agentSession)
      .set({ status: "cleaned_up", updatedAt: new Date() })
      .where(eq(agentSession.id, sessionId));

    await db.insert(agentAction).values({
      sessionId,
      actionType: "sandbox_cleanup",
      actionData: { status: "cleaned_up", timestamp: new Date().toISOString() },
    });

    return { success: true };
  } catch (err) {
    console.error(`Error cleaning up sandbox for session ${sessionId}:`, err);
    return { success: false, message: String(err) };
  }
}

/**
 * Cleanup expired sessions older than maxAgeHours (default 24h).
 */
export async function cleanupExpiredSessions(maxAgeHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  try {
    const expiredSessions = await db
      .select()
      .from(agentSession)
      .where(and(lt(agentSession.createdAt, cutoff), eq(agentSession.status, "complete")));

    let cleanedCount = 0;
    for (const sessionItem of expiredSessions) {
      const res = await cleanupSandbox(sessionItem.id);
      if (res.success) cleanedCount++;
    }

    return cleanedCount;
  } catch (err) {
    console.error("Error during expired sessions cleanup:", err);
    return 0;
  }
}

