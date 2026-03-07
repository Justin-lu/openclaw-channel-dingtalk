import * as fs from "node:fs";
import * as path from "node:path";

function groupMembersFilePath(storePath: string, groupId: string): string {
  const dir = path.join(path.dirname(storePath), "dingtalk-members");
  const safeId = groupId.replace(/\+/g, "-").replace(/\//g, "_");
  return path.join(dir, `${safeId}.json`);
}

export function noteGroupMember(
  storePath: string,
  groupId: string,
  userId: string,
  name: string,
): void {
  if (!userId || !name) {
    return;
  }
  const filePath = groupMembersFilePath(storePath, groupId);
  let roster: Record<string, string> = {};
  try {
    roster = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {}
  if (roster[userId] === name) {
    return;
  }
  roster[userId] = name;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(roster, null, 2));
}

export function formatGroupMembers(storePath: string, groupId: string): string | undefined {
  const filePath = groupMembersFilePath(storePath, groupId);
  let roster: Record<string, string> = {};
  try {
    roster = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
  const entries = Object.entries(roster);
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map(([id, name]) => `${name} (${id})`).join(", ");
}

function extractMentionNames(text: string): string[] {
  if (!text) {
    return [];
  }

  const matches = text.match(/@[^\s@]+/g) || [];
  const names = matches
    .map((raw) =>
      raw
        .slice(1)
        .trim()
        .replace(/[，。,.!?！？:：;；）)】\]}>]+$/g, ""),
    )
    .filter(Boolean);

  return Array.from(new Set(names));
}

export interface ResolveMentionOptions {
  mentionAliases?: Record<string, string>;
}

export function resolveMentionedUserIds(
  storePath: string,
  groupId: string,
  text: string,
  options?: ResolveMentionOptions,
): string[] {
  const mentionedNames = extractMentionNames(text);
  if (mentionedNames.length === 0) {
    return [];
  }

  const filePath = groupMembersFilePath(storePath, groupId);
  let roster: Record<string, string> = {};
  try {
    roster = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    // no stored roster, continue with empty
  }

  const lowerNameMap = new Map<string, string[]>();
  for (const [userId, name] of Object.entries(roster)) {
    const key = name.toLowerCase();
    const ids = lowerNameMap.get(key) || [];
    ids.push(userId);
    lowerNameMap.set(key, ids);
  }

  const mentionAliases = options?.mentionAliases || {};
  const lowerAliasMap = new Map<string, string>();
  for (const [aliasName, userId] of Object.entries(mentionAliases)) {
    lowerAliasMap.set(aliasName.toLowerCase(), userId);
  }

  const resolvedIds: string[] = [];
  for (const name of mentionedNames) {
    const lowerName = name.toLowerCase();
    const rosterIds = lowerNameMap.get(lowerName) || [];
    if (rosterIds.length > 0) {
      resolvedIds.push(...rosterIds);
    } else {
      const aliasId = lowerAliasMap.get(lowerName);
      if (aliasId) {
        resolvedIds.push(aliasId);
      }
    }
  }

  return Array.from(new Set(resolvedIds));
}
