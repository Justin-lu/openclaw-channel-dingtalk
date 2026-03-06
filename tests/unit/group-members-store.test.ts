import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    formatGroupMembers,
    noteGroupMember,
    resolveMentionedUserIds,
} from "../../src/group-members-store";

function makeStorePath(): { rootDir: string; storePath: string } {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "dingtalk-members-test-"));
    return { rootDir, storePath: path.join(rootDir, "session", "store.json") };
}

describe("group-members-store", () => {
    const tempDirs: string[] = [];

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("persists and formats members for a group", () => {
        const { rootDir, storePath } = makeStorePath();
        tempDirs.push(rootDir);

        noteGroupMember(storePath, "cid_group_1", "user_1", "Alice");
        noteGroupMember(storePath, "cid_group_1", "user_2", "Bob");

        const members = formatGroupMembers(storePath, "cid_group_1");
        expect(members).toContain("Alice (user_1)");
        expect(members).toContain("Bob (user_2)");
    });

    it("returns undefined when group member cache does not exist", () => {
        const { rootDir, storePath } = makeStorePath();
        tempDirs.push(rootDir);

        const members = formatGroupMembers(storePath, "cid_missing");
        expect(members).toBeUndefined();
    });

    it("updates member name and sanitizes group file id", () => {
        const { rootDir, storePath } = makeStorePath();
        tempDirs.push(rootDir);

        const groupId = "cid+/with/slash";
        noteGroupMember(storePath, groupId, "user_1", "Alice");
        noteGroupMember(storePath, groupId, "user_1", "Alice New");

        const cacheFile = path.join(path.dirname(storePath), "dingtalk-members", "cid-_with_slash.json");
        expect(fs.existsSync(cacheFile)).toBe(true);
        expect(formatGroupMembers(storePath, groupId)).toContain("Alice New (user_1)");
    });

    it("resolves mentioned names to user ids", () => {
        const { rootDir, storePath } = makeStorePath();
        tempDirs.push(rootDir);

        noteGroupMember(storePath, "cid_group_1", "user_1", "协作同事A");
        noteGroupMember(storePath, "cid_group_1", "user_2", "协作AgentB");

        const mentions = resolveMentionedUserIds(
            storePath,
            "cid_group_1",
            "请 @协作同事A 协助，再让@协作AgentB 看一下。",
        );

        expect(mentions).toEqual(["user_1", "user_2"]);
    });

    it("returns empty array when no mention can be resolved", () => {
        const { rootDir, storePath } = makeStorePath();
        tempDirs.push(rootDir);

        noteGroupMember(storePath, "cid_group_1", "user_1", "Alice");

        const mentions = resolveMentionedUserIds(storePath, "cid_group_1", "@Unknown 帮我看看");
        expect(mentions).toEqual([]);
    });
});
