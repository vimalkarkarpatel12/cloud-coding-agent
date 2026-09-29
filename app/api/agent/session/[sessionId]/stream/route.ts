import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agentSession, agentAction } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = await params;

  // Verify ownership
  const [sessionData] = await db
    .select()
    .from(agentSession)
    .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, session.user.id)))
    .limit(1);

  if (!sessionData) {
    return new Response("Session not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial connection event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected", sessionId, status: sessionData.status })}\n\n`
          )
        );

        // Fetch past actions
        const pastActions = await db
          .select()
          .from(agentAction)
          .where(eq(agentAction.sessionId, sessionId))
          .orderBy(asc(agentAction.createdAt));

        for (const act of pastActions) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: act.actionType,
                data: act.actionData,
                createdAt: act.createdAt,
              })}\n\n`
            )
          );
        }

        // Close stream
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "end" })}\n\n`));
        controller.close();
      } catch (err) {
        console.error("Error in SSE event stream", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

