import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getToolsForRole } from "@/lib/ai/tools";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export const maxDuration = 60;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  // Authenticate the user and resolve their role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const role: UserRole = (user.app_metadata?.role as UserRole) || "viewer";

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: getSystemPrompt(role),
    messages: await convertToModelMessages(messages),
    tools: getToolsForRole(role),
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
