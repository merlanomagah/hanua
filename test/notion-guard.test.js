// A sample server never changes Notion (server/notion.js blockPageWrites, 10 Oct 2026): creating, changing or binning
// a page is refused before anything is sent, whatever a route forgot. Reads (a database query is a POST) still go.
import { test } from "node:test";
import assert from "node:assert/strict";
import { archivePage, blockPageWrites, createPage, queryArea, updatePage } from "../server/notion.js";

test("on a sample server, page writes never leave Hanua; reads still do", async () => {
  const sent = [];
  const realFetch = globalThis.fetch, realToken = process.env.NOTION_TOKEN;
  globalThis.fetch = async (url, opts) => { sent.push(`${opts?.method || "GET"} ${url}`); return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 }); };
  process.env.NOTION_TOKEN = "invented-token";
  try {
    blockPageWrites(true);
    await assert.rejects(updatePage("abc", {}), /never changes Notion/);
    await assert.rejects(createPage({ notionDatabaseId: "db" }, {}), /never changes Notion/);
    await assert.rejects(archivePage("abc"), /never changes Notion/);
    assert.deepEqual(sent, []);
    await queryArea({ notionDatabaseId: "db", fields: {} }, 10);
    assert.equal(sent.length, 1);
    assert.match(sent[0], /^POST .*\/databases\/db\/query$/);
    blockPageWrites(false);
    await updatePage("abc", {}).catch(() => {});
    assert.match(sent.at(-1), /^PATCH .*\/pages\/abc$/);
  } finally {
    blockPageWrites(false);
    globalThis.fetch = realFetch;
    if (realToken === undefined) delete process.env.NOTION_TOKEN; else process.env.NOTION_TOKEN = realToken;
  }
});
