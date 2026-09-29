import { auth } from "@/app/(auth)/auth";
import { saveUserSecret, getUserSecretNames } from "@/lib/secrets";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const secrets = await getUserSecretNames(session.user.id);
    return Response.json({ configuredSecrets: secrets });
  } catch (error) {
    console.error("Failed to fetch user secrets", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { secretName, value } = await request.json();

    if (!secretName || typeof secretName !== "string") {
      return new Response("Invalid secretName", { status: 400 });
    }

    if (typeof value !== "string") {
      return new Response("Invalid value", { status: 400 });
    }

    // Save encrypted secret
    await saveUserSecret(session.user.id, secretName.trim(), value.trim());

    return Response.json({ success: true, secretName });
  } catch (error) {
    console.error("Failed to save user secret", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
