import assert from "node:assert/strict";
import test from "node:test";
import { userPage } from "../src/github.js";

test("a token that may not read a count (gists) does not stop the profile: the query is asked again without it", async () => {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => {
    const { query } = JSON.parse(body);
    seen.push(query);
    const body2 = query.includes("gists")
      ? { data: { user: null }, errors: [{ type: "FORBIDDEN", path: ["user", "gists"], message: "Resource not accessible by personal access token" }] }
      : { data: { user: { name: "x" } } };
    return { ok: true, status: 200, text: async () => JSON.stringify(body2) };
  };
  try {
    const { data, query } = await userPage("t", "query {\n  user {\n    gists { totalCount }\n    following { totalCount }\n  }\n}", {}, "https://example.test");
    assert.equal(data.user.name, "x");
    assert.ok(seen.length === 2 && !query.includes("gists") && query.includes("following"), "only the forbidden field is dropped");
    // anything else forbidden is still an error
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: null, errors: [{ type: "FORBIDDEN", path: ["user", "repositories"] }] }) });
    await assert.rejects(userPage("t", "query { user { repositories } }", {}, "https://example.test"), /FORBIDDEN/);
  } finally {
    globalThis.fetch = real;
  }
});
