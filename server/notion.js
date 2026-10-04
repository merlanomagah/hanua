// Thin wrapper over the Notion REST API. Pinned to 2022-06-28, which still
// supports /databases/{id}/query for single-source databases.
const NOTION_VERSION = "2022-06-28";
const BASE = "https://api.notion.com/v1";

export class NotionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new NotionError(res.status, json.message || res.statusText);
  return json;
}

export const notionEnabled = () => Boolean(process.env.NOTION_TOKEN);

// Flatten any Notion property value into display text (or a number/date).
function propValue(p) {
  if (!p) return null;
  switch (p.type) {
    case "title":
    case "rich_text":
      return p[p.type].map((t) => t.plain_text).join("");
    case "number":
      return p.number;
    case "select":
    case "status":
      return p[p.type]?.name ?? null;
    case "multi_select":
      return p.multi_select.map((o) => o.name).join(", ");
    case "date":
      return p.date?.start ?? null;
    case "checkbox":
      return p.checkbox;
    case "url":
    case "email":
    case "phone_number":
      return p[p.type];
    case "formula":
      return p.formula[p.formula.type] ?? null;
    case "people":
      return p.people.map((u) => u.name).filter(Boolean).join(", ");
    case "relation":
      return p.relation.map((r) => r.id);
    case "created_time":
    case "last_edited_time":
      return p[p.type];
    default:
      return null;
  }
}

function findTitleKey(props) {
  return Object.keys(props).find((k) => props[k].type === "title");
}

// Normalise a page into the shape the UI renders, using the area's field map.
function normalisePage(page, fields = {}) {
  const props = page.properties;
  const titleKey = props[fields.title] ? fields.title : findTitleKey(props);
  const all = {};
  for (const [name, p] of Object.entries(props)) {
    const v = propValue(p);
    if (v !== null && v !== "") all[name] = v;
  }
  return {
    id: page.id,
    url: page.url,
    title: propValue(props[titleKey]) || "Untitled",
    date: propValue(props[fields.date]) ?? null,
    amount: propValue(props[fields.amount]) ?? null,
    status: propValue(props[fields.status]) ?? null,
    fields: all,
  };
}

// Reads up to `limit` rows, a page of 100 at a time (Notion's maximum per request).
export async function queryArea(area, limit = 50) {
  const sorts = area.fields?.date ? [{ property: area.fields.date, direction: "descending" }] : undefined;
  const fetchPage = async (cursor, sortBy) => call(`/databases/${area.notionDatabaseId}/query`, {
    method: "POST",
    body: { page_size: Math.min(100, limit), ...(sortBy ? { sorts: sortBy } : {}), ...(cursor ? { start_cursor: cursor } : {}) },
  });
  let sortBy = sorts;
  const rows = [];
  let cursor;
  do {
    let json;
    try {
      json = await fetchPage(cursor, sortBy);
    } catch (err) {
      // Configured date column missing or renamed: fall back to newest-edited first.
      if (err.status !== 400 || !sortBy || cursor) throw err;
      sortBy = [{ timestamp: "last_edited_time", direction: "descending" }];
      json = await fetchPage(cursor, sortBy);
    }
    rows.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor && rows.length < limit);
  return rows.slice(0, limit).map((p) => normalisePage(p, area.fields));
}

// Property name -> type, so Claude knows what it can fill in.
export async function getSchema(area) {
  const db = await call(`/databases/${area.notionDatabaseId}`);
  const schema = {};
  for (const [name, p] of Object.entries(db.properties)) {
    const entry = { type: p.type };
    if (p.type === "select" || p.type === "status") entry.options = p[p.type].options.map((o) => o.name);
    if (p.type === "multi_select") entry.options = p.multi_select.options.map((o) => o.name);
    schema[name] = entry;
  }
  return schema;
}

// Convert Claude's {name, value} strings into Notion property payloads.
// Properties of types we can't safely write are skipped.
export function toNotionProperties(schema, values) {
  const out = {};
  for (const { name, value } of values) {
    const def = schema[name];
    if (!def || value === "" || value == null) continue;
    switch (def.type) {
      case "title":
        out[name] = { title: [{ text: { content: value } }] };
        break;
      case "rich_text":
        out[name] = { rich_text: [{ text: { content: value } }] };
        break;
      case "number": {
        const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
        if (!Number.isNaN(n)) out[name] = { number: n };
        break;
      }
      case "select":
        out[name] = { select: { name: value } };
        break;
      case "status":
        out[name] = { status: { name: value } };
        break;
      case "multi_select":
        out[name] = { multi_select: value.split(",").map((s) => ({ name: s.trim() })).filter((o) => o.name) };
        break;
      case "date":
        out[name] = { date: { start: value } };
        break;
      case "checkbox":
        out[name] = { checkbox: /^(true|yes|1)$/i.test(value) };
        break;
      case "url":
      case "email":
      case "phone_number":
        out[name] = { [def.type]: value };
        break;
      case "relation":
        out[name] = { relation: String(value).split(",").map((id) => ({ id: id.trim() })).filter((r) => r.id) };
        break;
    }
  }
  return out;
}

// Empty values for columns the user deliberately cleared in a form.
export function clearedProperties(schema, names) {
  const out = {};
  for (const name of names) {
    const def = schema[name];
    if (!def) continue;
    if (def.type === "rich_text") out[name] = { rich_text: [] };
    else if (def.type === "relation") out[name] = { relation: [] };
    else if (["date", "number", "select", "status", "url", "email", "phone_number"].includes(def.type)) out[name] = { [def.type]: null };
    else if (def.type === "multi_select") out[name] = { multi_select: [] };
  }
  return out;
}

export async function updatePage(pageId, properties) {
  await call(`/pages/${pageId}`, { method: "PATCH", body: { properties } });
}

export async function createPage(area, properties) {
  const page = await call("/pages", {
    method: "POST",
    body: { parent: { database_id: area.notionDatabaseId }, properties },
  });
  return normalisePage(page, area.fields);
}

// Moves a page to Notion's trash (restorable there for 30 days). Never a permanent delete.
export async function archivePage(pageId) {
  await call(`/pages/${pageId}`, { method: "PATCH", body: { archived: true } });
}
