import { assertEquals } from "@std/assert";
import { parseReviewPagination } from "./pagination.ts";

Deno.test("parseReviewPagination preserves an explicit zero limit", () => {
  const pagination = parseReviewPagination(
    new URL("https://example.test/memories/review?limit=0&offset=200"),
  );

  assertEquals(pagination, { limit: 0, offset: 200 });
});

Deno.test("parseReviewPagination defaults invalid values and clamps valid bounds", () => {
  assertEquals(
    parseReviewPagination(
      new URL("https://example.test/memories/review?limit=999&offset=-4"),
    ),
    { limit: 500, offset: 0 },
  );
  assertEquals(
    parseReviewPagination(
      new URL(
        "https://example.test/memories/review?limit=not-a-number&offset=invalid",
      ),
    ),
    { limit: 100, offset: 0 },
  );
});
