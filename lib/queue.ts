import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient?.isOpen) return redisClient;

  try {
    redisClient = createClient({ url: redisUrl }) as RedisClientType;
    redisClient.on("error", (err) => console.warn("Redis Queue client warning:", err.message));
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn("Failed to connect to Redis for queueing:", err);
    redisClient = null;
    return null;
  }
}

const QUEUE_KEY = "sandbox:jobs";

export interface SandboxJobData {
  sessionId: string;
  userId: string;
  taskDescription: string;
  model?: string;
  createdAt?: number;
}

/**
 * Enqueue a sandbox execution job into Redis queue.
 */
export async function enqueueSandboxJob(data: SandboxJobData) {
  const client = await getRedisClient();
  const payload = {
    ...data,
    createdAt: data.createdAt || Date.now(),
  };

  if (!client) {
    console.warn("Redis client unavailable — job enqueued in fallback memory mode");
    return { queued: false, fallback: true };
  }

  await client.rPush(QUEUE_KEY, JSON.stringify(payload));
  return { queued: true };
}

/**
 * Pop the next sandbox job from Redis queue.
 */
export async function popSandboxJob(timeoutSeconds = 2): Promise<SandboxJobData | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const res = await client.bLPop(QUEUE_KEY, timeoutSeconds);
    if (!res) return null;
    return JSON.parse(res.element) as SandboxJobData;
  } catch (err) {
    console.error("Error popping sandbox job from Redis queue:", err);
    return null;
  }
}
