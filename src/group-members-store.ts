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

export function resolveMentionedUserIds(
  storePath: string,
  groupId: string,
  text: string,
): string[] {
  const filePath = groupMembersFilePath(storePath, groupId);
  let roster: Record<string, string> = {};
  try {
    roster = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }

  const mentionedNames = extractMentionNames(text);
  if (mentionedNames.length === 0) {
    return [];
  }

  const lowerNameMap = new Map<string, string[]>();
  for (const [userId, name] of Object.entries(roster)) {
    const key = name.toLowerCase();
    const ids = lowerNameMap.get(key) || [];
    ids.push(userId);
    lowerNameMap.set(key, ids);
  }

  const resolvedIds: string[] = [];
  for (const name of mentionedNames) {
    const ids = lowerNameMap.get(name.toLowerCase()) || [];
    resolvedIds.push(...ids);
  }

  return Array.from(new Set(resolvedIds));
}
