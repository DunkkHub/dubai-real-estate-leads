import { createHash } from "node:crypto";

export function hashText(value: string) {
  return createHash("sha256").update(normalizeForHash(value)).digest("hex");
}

export function opportunityDedupeHash(input: {
  platform: string;
  externalId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  sourceUrl?: string | null;
  text: string;
}) {
  const stableId = [input.platform, input.externalId, input.postId, input.commentId].filter(Boolean).join(":");
  if (stableId.length > input.platform.length + 1) return hashText(stableId);
  return hashText([input.platform, input.sourceUrl ?? "", input.text].join(":"));
}

export function normalizeForHash(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
