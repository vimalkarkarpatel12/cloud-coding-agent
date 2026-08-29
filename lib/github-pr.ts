export interface FileChangeItem {
  path: string;
  before: string;
  after: string;
  status: "added" | "modified" | "deleted";
}

export interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  headBranch: string;
  baseBranch?: string;
  token?: string;
}

export interface PRResponse {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Open a Pull Request on GitHub for agent-authored code changes.
 */
export async function openPullRequest(params: CreatePRParams): Promise<PRResponse> {
  const token = params.token || process.env.GITHUB_CLIENT_SECRET;
  const baseBranch = params.baseBranch || "main";

  if (!token) {
    return {
      success: false,
      error: "No GitHub token or App credential configured",
    };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "AgenticCodingPlatform",
        },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.headBranch,
          base: baseBranch,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `GitHub API error (${res.status}): ${errorText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      prUrl: data.html_url,
      prNumber: data.number,
    };
  } catch (err) {
    console.error("Failed to create GitHub PR", err);
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * Helper to generate standardized PR Markdown body describing agent reasoning and changes.
 */
export function generatePRBody(taskDescription: string, changes: FileChangeItem[]): string {
  const fileSummary = changes
    .map((c) => `- \`${c.path}\` (${c.status})`)
    .join("\n");

  return `
## 🤖 Automated Code Changes by OpenHands Agent

### Task Description
> ${taskDescription}

### Changed Files (${changes.length})
${fileSummary}

---
*Generated automatically by Self-Hosted Agentic Coding Platform on ${new Date().toISOString()}*
`.trim();
}

