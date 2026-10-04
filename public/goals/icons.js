// A small coloured symbol per level, like ADO's work item icons: crown (Epic), trophy (Feature),
// page (PBI), tick box (Task). Drawn in the level's colour; the level's name is its label and tooltip.
const NS = "http://www.w3.org/2000/svg";
// each shape: [path, "fill" | "line"]
const SHAPES = {
  Epic: [["M2 12.3 1.2 4.4l3.7 3L8 2.2l3.1 5.2 3.7-3-.8 7.9zM2.2 13.4h11.6V15H2.2z", "fill"]],
  Feature: [
    ["M4.4 1.5h7.2v4.3a3.6 3.6 0 0 1-7.2 0zM7.1 9.2h1.8v2.4H7.1zM4.6 11.6h6.8V15H4.6z", "fill"],
    ["M4.4 3.2H2.2v1A2.7 2.7 0 0 0 4.8 7M11.6 3.2h2.2v1A2.7 2.7 0 0 1 11.2 7", "line"],
  ],
  PBI: [["M3 1.5h6.8L13 4.7v9.8H3zM5.3 7.3h5.4M5.3 9.7h5.4M5.3 12.1h3.4", "line"]],
  Task: [["M2.5 2.5h11v11h-11zM5 8.2l2 2.1 4-4.4", "line"]],
};

export function levelIcon(level = "Task") {
  const name = SHAPES[level] ? level : "Task";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", `lvl-ico lvl-${name.toLowerCase()}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", name);
  const title = document.createElementNS(NS, "title");
  title.textContent = name;
  svg.append(title, ...SHAPES[name].map(([d, mode]) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    if (mode === "fill") p.setAttribute("fill", "currentColor");
    else Object.entries({ fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linejoin": "round", "stroke-linecap": "round" }).forEach(([k, v]) => p.setAttribute(k, v));
    return p;
  }));
  return svg;
}
