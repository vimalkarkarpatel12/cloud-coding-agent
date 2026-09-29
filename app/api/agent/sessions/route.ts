import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agentSession } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const userSessions = await db
      .select()
      .from(agentSession)
      .where(eq(agentSession.userId, session.user.id))
      .orderBy(desc(agentSession.createdAt));

    return Response.json(userSessions);
  } catch (error) {
    console.error("Failed to fetch user agent sessions", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
