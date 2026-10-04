// Day arithmetic on "YYYY-MM-DD" strings, shared by the page and the server.

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const dayOf = (iso) => (iso || "").slice(0, 10);
export const timeOf = (iso) => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
export const parseDay = (iso) => { const [y, m, d] = dayOf(iso).split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
export const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return ymd(d); };
