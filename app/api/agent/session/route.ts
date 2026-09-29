import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agentSession, agentAction } from "@/lib/db/schema";
import { getUserSecret } from "@/lib/secrets";
import { eq } from "drizzle-orm";

const OPENHANDS_URL = process.env.OPENHANDS_API_URL || "http://127.0.0.1:3002";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { taskDescription, model = "claude-3-5-sonnet-20241022" } = await request.json();

    if (!taskDescription || typeof taskDescription !== "string") {
      return new Response("Task description is required", { status: 400 });
    }

    // 1. Fetch user's encrypted Anthropic API key
    let llmApiKey = await getUserSecret(session.user.id, "ANTHROPIC_API_KEY");
    if (!llmApiKey) {
      llmApiKey = process.env.OPENHANDS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY || null;
    }

    // 2. Create agent session in DB
    const [newSession] = await db
      .insert(agentSession)
      .values({
        userId: session.user.id,
        taskDescription,
        status: "running",
      })
      .returning();

    // Record initial action
    await db.insert(agentAction).values({
      sessionId: newSession.id,
      actionType: "user_message",
      actionData: { task: taskDescription, model },
    });

    // 3. Initiate OpenHands Session
    let openhandsSessionId: string | null = null;
    try {
      const ohRes = await fetch(`${OPENHANDS_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskDescription,
          llm_api_key: llmApiKey || "",
          model,
          workspace: "docker",
        }),
      });

      if (ohRes.ok) {
        const ohData = await ohRes.json();
        openhandsSessionId = ohData.session_id || ohData.id || null;

        if (openhandsSessionId) {
          await db
            .update(agentSession)
            .set({ openhands_session_id: openhandsSessionId, updatedAt: new Date() })
            .where(eq(agentSession.id, newSession.id));
        }
      } else {
        console.warn(`OpenHands returned status ${ohRes.status}`);
      }
    } catch (ohError) {
      console.warn("Could not reach OpenHands server:", ohError);
    }

    return Response.json({
      success: true,
      sessionId: newSession.id,
      openhandsSessionId,
      status: "running",
      taskDescription,
    });
  } catch (error) {
    console.error("Failed to create agent session", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
