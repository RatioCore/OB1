export type AgentMemoryConfig = {
  endpoint: string;
  accessKey: string;
  workspaceId: string;
  projectId?: string;
  requireReviewByDefault?: boolean;
  includeUnconfirmedRecall?: boolean;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
};

type ReviewQueueInput = {
  workspace_id?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
  summary_only?: boolean;
  include_content?: boolean;
};

const DEFAULT_REVIEW_QUEUE_LIMIT = 25;
const MAX_REVIEW_QUEUE_LIMIT = 100;
const MAX_REVIEW_QUEUE_CONTENT_LIMIT = 10;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function reviewQueueItems(data: unknown): Record<string, any>[] {
  if (Array.isArray(data)) return data.filter((item) => item && typeof item === "object");
  if (!data || typeof data !== "object") return [];
  const memories = (data as Record<string, unknown>).memories;
  return Array.isArray(memories)
    ? memories.filter((item) => item && typeof item === "object")
    : [];
}

function reviewTimestamp(memory: Record<string, any>) {
  return memory.freshness?.created_at || memory.source?.timestamp || memory.created_at || "";
}

function sortedReviewQueue(memories: Record<string, any>[]) {
  return [...memories].sort((left, right) => {
    const byTime = String(reviewTimestamp(right)).localeCompare(String(reviewTimestamp(left)));
    if (byTime !== 0) return byTime;
    return String(left.memory_id || "").localeCompare(String(right.memory_id || ""));
  });
}

function groupedCounts(memories: Record<string, any>[], valueFor: (memory: Record<string, any>) => unknown) {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    const value = String(valueFor(memory) || "unknown");
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function withoutContent(memory: Record<string, any>) {
  const { content: _content, ...metadata } = memory;
  return metadata;
}

function requestInput(input: Record<string, unknown>) {
  return input && typeof input === "object" ? input : {};
}

function projectIdFrom(input: Record<string, unknown>, configuredProjectId?: string) {
  if (typeof input.project_id === "string" || input.project_id === null) return input.project_id;
  if (configuredProjectId) return configuredProjectId;
  return null;
}

export class AgentMemoryClient {
  private endpoint: string;
  private accessKey: string;

  constructor(private config: AgentMemoryConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, "");
    this.accessKey = config.accessKey;
    if (!this.accessKey) {
      throw new Error("OB1 Agent Memory access key missing. Configure plugins.entries.nbj-ob1-agent-memory.config.accessKey.");
    }
  }

  async request(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${this.endpoint}${path}`, {
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        "x-brain-key": this.accessKey,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`OB1 Agent Memory API ${response.status}: ${data.error || text}`);
    }
    return data;
  }

  recall(input: Record<string, unknown>) {
    const request = requestInput(input);
    const projectId = projectIdFrom(request, this.config.projectId);
    return this.request("/recall", {
      method: "POST",
      body: {
        ...request,
        schema_version: "openbrain.openclaw.recall.v1",
        workspace_id: this.config.workspaceId,
        project_id: projectId,
        scope: {
          include_unconfirmed: this.config.includeUnconfirmedRecall ?? false,
          ...(typeof request.scope === "object" && request.scope ? request.scope : {}),
        },
      },
    });
  }

  writeback(input: Record<string, unknown>) {
    const request = requestInput(input);
    const projectId = projectIdFrom(request, this.config.projectId);
    return this.request("/writeback", {
      method: "POST",
      body: {
        ...request,
        schema_version: "openbrain.openclaw.writeback.v1",
        workspace_id: this.config.workspaceId,
        project_id: projectId,
        provenance: {
          default_status: "generated",
          confidence: 0.5,
          requires_review: this.config.requireReviewByDefault ?? true,
          ...(typeof request.provenance === "object" && request.provenance ? request.provenance : {}),
        },
      },
    });
  }

  reportUsage(requestId: string, input: Record<string, unknown>) {
    return this.request(`/recall/${requestId}/usage`, { method: "POST", body: input });
  }

  inspectMemory(memoryId: string) {
    return this.request(`/memories/${memoryId}`);
  }

  async listReviewQueue(input: ReviewQueueInput = {}) {
    const workspaceId = input.workspace_id || this.config.workspaceId;
    const projectId = input.project_id || this.config.projectId;
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (projectId) params.set("project_id", projectId);
    const data = await this.request(`/memories/review?${params.toString()}`);
    const memories = sortedReviewQueue(reviewQueueItems(data));
    const requestedLimit = boundedInteger(input.limit, DEFAULT_REVIEW_QUEUE_LIMIT, 1, MAX_REVIEW_QUEUE_LIMIT);
    const limit = input.include_content
      ? Math.min(requestedLimit, MAX_REVIEW_QUEUE_CONTENT_LIMIT)
      : requestedLimit;
    const offset = boundedInteger(input.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const summaryOnly = input.summary_only === true;
    const page = summaryOnly ? [] : memories.slice(offset, offset + limit);
    const visiblePage = input.include_content ? page : page.map(withoutContent);
    const nextOffset = offset + visiblePage.length;
    const hasMore = !summaryOnly && nextOffset < memories.length;

    return {
      queue: {
        total: memories.length,
        limit,
        offset,
        returned: visiblePage.length,
        has_more: hasMore,
        next_offset: hasMore ? nextOffset : null,
        ordering: "created_at_desc_memory_id_asc",
        content_included: input.include_content === true,
      },
      summary: {
        by_status: groupedCounts(memories, (memory) => memory.provenance?.status),
        by_source_kind: groupedCounts(memories, (memory) => memory.source?.kind),
      },
      memories: visiblePage,
    };
  }

  reviewMemory(memoryId: string, input: Record<string, unknown>) {
    return this.request(`/memories/${memoryId}/review`, { method: "PATCH", body: input });
  }

  getRecallTrace(requestId: string) {
    return this.request(`/recall-traces/${requestId}`);
  }
}
