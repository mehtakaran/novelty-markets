// The only place we talk to the Anthropic API. Every AI call in this app goes through
// `callClaudeForJson`, so error handling, model choice, and output validation all live here
// once, instead of being copy-pasted into every caller.
//
// We ask Claude to answer by calling a "tool" whose input has to match our zod schema, rather
// than asking it to write JSON in plain text and hoping we can parse it back out. That matters
// in practice — plain-text JSON occasionally got cut off mid-string and failed to parse (see
// the `triage.ai_call_failed` audit entries saying "Unterminated string in JSON"). Forcing the
// tool call avoids that failure mode entirely.
//
// Whatever comes back, we still run it through the zod schema before trusting it. If it
// doesn't match (wrong enum value, price out of range, a missing field), we treat that exactly
// like a network failure: throw, and let the caller fall back to "needs manual review" rather
// than quietly accepting something that looks close enough.

import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodType } from "zod";
import { config, requireAnthropicKey } from "@/lib/config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  client = new Anthropic({ apiKey: requireAnthropicKey() });
  return client;
}

export class AiCallError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiCallError";
  }
}

const RESPONSE_TOOL_NAME = "respond_with_json";

/**
 * Sends one prompt to Claude and gets back a response shaped by `schema`, validated against
 * that same schema. Throws AiCallError on any failure — no response, a malformed one, or one
 * that doesn't match the schema. Callers must catch this and fall back to "needs manual
 * review" rather than swallowing it.
 */
export async function callClaudeForJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  let toolInput: unknown;
  try {
    const response = await getClient().messages.create({
      model: config.anthropicModel,
      // Triage can look at dozens of items in one go and shortlist a dozen-plus candidates,
      // each with several fields of reasoning — this budget just makes sure we never cut a
      // response off partway through. Padded above the typical need specifically because the
      // occasional double-encoding quirk below (escaped quotes everywhere) costs noticeably
      // more tokens than the same content written natively.
      max_tokens: 12000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: RESPONSE_TOOL_NAME,
          description: "Provide the structured response for this request.",
          input_schema: z.toJSONSchema(schema) as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: RESPONSE_TOOL_NAME },
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new AiCallError("Model response contained no tool_use block");
    }
    toolInput = toolUse.input;
  } catch (error) {
    if (error instanceof AiCallError) throw error;
    throw new AiCallError(`Anthropic API call failed: ${(error as Error).message}`, error);
  }

  const result = schema.safeParse(toolInput);
  if (result.success) return result.data;

  // Observed quirk: occasionally the model writes its whole answer as a JSON *string* inside
  // one of the tool's own fields, instead of filling the tool's structured fields directly —
  // most often when a field name (e.g. "shortlisted") echoes the shape shown to it elsewhere
  // in the prompt. If the input is a single string field that itself parses as valid JSON,
  // try validating that instead before giving up — this recovers the response instead of
  // discarding a perfectly good answer that just arrived wrapped oddly.
  const unwrapped = tryUnwrapStringifiedJson(toolInput);
  if (unwrapped !== undefined) {
    const retry = schema.safeParse(unwrapped);
    if (retry.success) return retry.data;
  }

  throw new AiCallError(`Model response failed schema validation: ${result.error.message}`, toolInput);
}

function tryUnwrapStringifiedJson(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return undefined;
  const values = Object.values(input as Record<string, unknown>);
  if (values.length !== 1 || typeof values[0] !== "string") return undefined;
  try {
    return JSON.parse(values[0]);
  } catch {
    return undefined;
  }
}
