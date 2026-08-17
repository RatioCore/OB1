import fs from "node:fs";

const typeStub = new Proxy({}, { get: () => (...args) => ({ args }) });
let code = fs.readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");

code = code
  .replace('import { Type as Type2 } from "typebox";\n', "const Type2 = typeStub;\n")
  .replace('import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";\n', "const definePluginEntry = (entry) => entry;\n")
  .replace(
    'import { resolveConfiguredSecretInputString } from "openclaw/plugin-sdk/secret-input-runtime";\n',
    'const resolveConfiguredSecretInputString = async ({ value }) => ({ value: typeof value === "string" ? value : "test-key" });\n',
  )
  .replace('import { Type } from "typebox";\n', "const Type = typeStub;\n")
  .replace(/export \{\s*index_default as default\s*\};\s*$/s, "return index_default;");

const plugin = new Function("typeStub", code)(typeStub);
const registered = new Map();
const api = {
  pluginConfig: {
    endpoint: "https://example.invalid/agent-memory-api",
    accessKey: "test-key",
    workspaceId: "ratiocore",
    projectId: "ratiocore-ops",
  },
  config: {},
  registerTool(tool) {
    registered.set(tool.name, tool);
  },
};

plugin.register(api);

const memories = Array.from({ length: 30 }, (_, index) => ({
  memory_id: `memory-${String(index).padStart(2, "0")}`,
  summary: `review item ${index}`,
  content: `private-content-marker-${index}`,
  source: {
    kind: index % 2 === 0 ? "agent_memory" : "import",
    timestamp: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
  },
  provenance: { status: index % 3 === 0 ? "generated" : "user_confirmed" },
}));

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  async text() {
    return JSON.stringify({ memories });
  },
});

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, error: message, ...details }, null, 2));
  process.exit(1);
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) fail(`${name} mismatch`, { actual, expected });
}

const tool = registered.get("openbrain_list_review_queue");
const defaultPage = await tool.execute("default", {});
assertEqual("default total", defaultPage.details.queue.total, 30);
assertEqual("default limit", defaultPage.details.queue.limit, 25);
assertEqual("default returned", defaultPage.details.queue.returned, 25);
assertEqual("default has_more", defaultPage.details.queue.has_more, true);
assertEqual("default next_offset", defaultPage.details.queue.next_offset, 25);
assertEqual("default first id", defaultPage.details.memories[0].memory_id, "memory-29");
assertEqual("default content redacted", "content" in defaultPage.details.memories[0], false);
assertEqual("default output marker absent", defaultPage.content[0].text.includes("private-content-marker"), false);

const summary = await tool.execute("summary", { summary_only: true });
assertEqual("summary returned", summary.details.queue.returned, 0);
assertEqual("summary memories", summary.details.memories.length, 0);
assertEqual("summary has_more", summary.details.queue.has_more, false);
assertEqual("summary next_offset", summary.details.queue.next_offset, null);
assertEqual("summary generated", summary.details.summary.by_status.generated, 10);
assertEqual("summary confirmed", summary.details.summary.by_status.user_confirmed, 20);
assertEqual("summary output marker absent", summary.content[0].text.includes("private-content-marker"), false);

const explicitPage = await tool.execute("explicit", { limit: 30, offset: 20, include_content: true });
assertEqual("explicit content limit", explicitPage.details.queue.limit, 10);
assertEqual("explicit returned", explicitPage.details.queue.returned, 10);
assertEqual("explicit first id", explicitPage.details.memories[0].memory_id, "memory-09");
assertEqual("explicit content present", explicitPage.details.memories[0].content, "private-content-marker-9");

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  async text() {
    return JSON.stringify({
      memories: [
        null,
        "malformed-record",
        {
          memory_id: "control-record",
          content: "private-control-marker\u0000",
          source: { kind: "agent\u0000memory", timestamp: "2026-08-30T00:00:00Z" },
          provenance: { status: "generated\nreview" },
        },
      ],
    });
  },
});

const malformedSummary = await tool.execute("malformed-summary", { summary_only: true });
assertEqual("malformed records ignored", malformedSummary.details.queue.total, 1);
assertEqual("control status counted", malformedSummary.details.summary.by_status["generated\nreview"], 1);
assertEqual("control source counted", malformedSummary.details.summary.by_source_kind["agent\u0000memory"], 1);
assertEqual("control marker absent", malformedSummary.content[0].text.includes("private-control-marker"), false);
assertEqual("raw null absent", malformedSummary.content[0].text.includes("\u0000"), false);

console.log(JSON.stringify({
  ok: true,
  default_page: defaultPage.details.queue,
  summary: summary.details.summary,
  explicit_page: explicitPage.details.queue,
}, null, 2));
