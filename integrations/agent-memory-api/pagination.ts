export type ReviewPagination = {
  limit: number;
  offset: number;
};

export function parseReviewPagination(url: URL): ReviewPagination {
  const requestedLimit = Number.parseInt(
    url.searchParams.get("limit") ?? "100",
    10,
  );
  const requestedOffset = Number.parseInt(
    url.searchParams.get("offset") ?? "0",
    10,
  );
  return {
    limit: Number.isNaN(requestedLimit)
      ? 100
      : Math.min(Math.max(requestedLimit, 0), 500),
    offset: Number.isNaN(requestedOffset) ? 0 : Math.max(requestedOffset, 0),
  };
}
