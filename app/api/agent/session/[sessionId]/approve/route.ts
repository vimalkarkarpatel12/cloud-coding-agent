import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agentSession, agentAction } from "@/lib/db/schema";
import { cleanupSandbox } from "@/lib/sandbox-cleanup";
import { openPullRequest, generatePRBody, FileChangeItem } from "@/lib/github-pr";
import { eq, and } from "drizzle-orm";

const OPENHANDS_URL = process.env.OPENHANDS_API_URL || "http://127.0.0.1:3002";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const { approved, commitMessage, owner, repo, branch } = await request.json();

    // Verify session ownership
    const [sessionData] = await db
      .select()
      .from(agentSession)
      .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, session.user.id)))
      .limit(1);

    if (!sessionData) {
      return new Response("Session not found", { status: 404 });
    }

    if (approved) {
      // 1. Fetch file changes from agent actions
      const actions = await db
        .select()
        .from(agentAction)
        .where(and(eq(agentAction.sessionId, sessionId), eq(agentAction.actionType, "file_change")));

      const fileChanges: FileChangeItem[] = [];
      for (const act of actions) {
        if (Array.isArray(act.actionData?.changes)) {
          fileChanges.push(...act.actionData.changes);
        }
      }

      // 2. Open PR if repository parameters are provided
      let prResult = null;
      if (owner && repo) {
        const prBody = generatePRBody(
          sessionData.taskDescription,
          fileChanges,
          "Code changes reviewed and approved by user."
        );

        prResult = await openPullRequest({
          owner,
          repo,
          title: commitMessage || `[Agent] ${sessionData.taskDescription.slice(0, 60)}`,
          body: prBody,
          headBranch: branch || `agent-changes-${sessionId.slice(0, 8)}`,
        });
      }

      // 3. Update session status to approved
      await db
        .update(agentSession)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(agentSession.id, sessionId));

      await db.insert(agentAction).values({
        sessionId,
        actionType: "user_approval",
        actionData: { approved: true, commitMessage, prResult, timestamp: new Date().toISOString() },
      });

      return Response.json({
        success: true,
        status: "approved",
        prResult,
      });
    } else {
      // Reject: cleanup sandbox & update status to rejected
      await cleanupSandbox(sessionId);

      await db
        .update(agentSession)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(agentSession.id, sessionId));

      await db.insert(agentAction).values({
        sessionId,
        actionType: "user_rejection",
        actionData: { approved: false, timestamp: new Date().toISOString() },
      });

      return Response.json({
        success: true,
        status: "rejected",
      });
    }
  } catch (error) {
    console.error(`Failed to process approval for session ${sessionId}`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

