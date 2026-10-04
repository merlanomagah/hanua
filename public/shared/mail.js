// Key emails as the room shows them (server/gmail.js reads them; the page draws the letter tray).
// Shared so the rules are tested once.

// Gmail's own filters decide what's key: the Key label, plus anything starred, from the last fortnight
export const KEY_QUERY = "(label:key OR is:starred) newer_than:14d";

// "Lisa Brown <lisa@agency.co.nz>" → "Lisa Brown"; a bare address → the part before @
export function senderName(from = "") {
  const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m && m[1].trim()) return m[1].trim();
  const addr = (m ? m[2] : String(from)).trim();
  return addr.split("@")[0] || "Someone";
}

// Opens that conversation in Gmail, in the right one of several accounts
export const gmailLink = (account, threadId) =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(threadId)}`;

// Gmail's message (format=metadata) → a tray item: who, what, when, and the link. No body.
export function mailItem(m, account) {
  const header = (n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";
  const labels = m.labelIds || [];
  return {
    id: m.id, threadId: m.threadId, account,
    from: senderName(header("from")),
    subject: header("subject").trim() || "(No subject)",
    at: Number(m.internalDate) || Date.parse(header("date")) || 0,
    starred: labels.includes("STARRED"),
    unread: labels.includes("UNREAD"),
    link: gmailLink(account, m.threadId || m.id),
  };
}
