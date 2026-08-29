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

  try {
    const [agentSessionData] = await db
      .select()
      .from(agentSession)
      .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, session.user.id)))
      .limit(1);

    if (!agentSessionData) {
      return new Response("Session not found", { status: 404 });
    }

    const actions = await db
      .select()
      .from(agentAction)
      .where(eq(agentAction.sessionId, sessionId))
      .orderBy(asc(agentAction.createdAt));

    return Response.json({
      session: agentSessionData,
      actions,
    });
  } catch (error) {
    console.error("Failed to fetch session details", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

