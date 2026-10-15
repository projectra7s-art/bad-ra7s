// Block diagram of the chosen system, drawn as SVG from the scenario data.
//
//   PV array ─ MPPT ─┐                 ┌─ Wind ─ Rectifier
//                    ╞═══ DC bus ═══╡
//   Battery bank ────┘                 └─ Hybrid inverter ─ AC loads / Grid
//
// Colours come from the CSS tokens (solar yellow, wind dark blue, battery
// green, grid grey), so the diagram follows night / day mode. Components
// with quantity 0 are drawn faded with "not used".

import { num } from "./format.js";
import { t } from "./i18n.js";

const NS = "http://www.w3.org/2000/svg";
const W = 520;
const H = 540;

function node(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text !== undefined) n.textContent = text;
  return n;
}

// one equipment box: title + up to 3 detail lines
function box(svg, { x, y, w, h, color, title, lines = [], off = false }) {
  const g = node("g", { class: off ? "bd-box bd-off" : "bd-box" });
  g.append(node("rect", {
    x, y, width: w, height: h, rx: 10,
    fill: "var(--panel)", stroke: color, "stroke-width": 2,
  }));
  g.append(node("rect", { x, y, width: 6, height: h, rx: 3, fill: color }));

  const cx = x + w / 2 + 3;
  const rows = off ? [t("design.d.unused")] : lines;
  const top = y + h / 2 - (rows.length * 19) / 2 + 2;

  g.append(node("text", { x: cx, y: top, class: "bd-title" }, title));
  rows.forEach((line, i) =>
    g.append(node("text", { x: cx, y: top + 21 + i * 19, class: "bd-line" }, line))
  );
  svg.append(g);
}

// connection line with an optional label (power or current)
function wire(svg, points, { color = "var(--muted)", label, lx, ly, off = false, dash } = {}) {
  svg.append(node("polyline", {
    points: points.map((p) => p.join(",")).join(" "),
    fill: "none", stroke: color, "stroke-width": 3,
    "stroke-linecap": "round", "stroke-linejoin": "round",
    class: off ? "bd-off" : "",
    ...(dash ? { "stroke-dasharray": dash } : {}),
  }));
  if (label && !off) {
    svg.append(node("text", { x: lx, y: ly, class: "bd-label" }, label));
  }
}

export function renderBlockDiagram(container, scenario) {
  const design = scenario.system_design;
  const rec = scenario.recommended;
  container.replaceChildren();

  if (!design || !design.dc_bus_v) {
    container.append(Object.assign(document.createElement("p"), {
      className: "hint", textContent: t("design.d.none"),
    }));
    return;
  }

  const v = design.dc_bus_v;
  const cur = design.currents;
  const inv = design.inverter;
  const bat = design.battery;
  const noPv = rec.pv_panels === 0;
  const noWind = rec.wind_turbines === 0;
  const noBat = !bat;

  const svg = node("svg", {
    viewBox: `0 0 ${W} ${H}`, class: "bd-svg", direction: "ltr",
    "aria-label": t("design.title"),
  });

  // ---- wires first (boxes are drawn on top)
  // PV -> MPPT -> bus
  wire(svg, [[130, 98], [130, 140]], { color: "var(--pv)", off: noPv,
    label: `${num(rec.pv_kw, 2)} kW`, lx: 140, ly: 124 });
  wire(svg, [[130, 200], [130, 246]], { color: "var(--pv)", off: noPv,
    label: `${num(cur.pv_a, 0)} A`, lx: 140, ly: 228 });
  // wind -> rectifier -> bus
  wire(svg, [[390, 98], [390, 140]], { color: "var(--wind)", off: noWind,
    label: `${num(rec.wind_kw, 2)} kW`, lx: 400, ly: 124 });
  wire(svg, [[390, 200], [390, 246]], { color: "var(--wind)", off: noWind,
    label: `${num(cur.wind_a, 0)} A`, lx: 400, ly: 228 });
  // bus <-> battery (both directions)
  wire(svg, [[130, 260], [130, 304]], { color: "var(--battery)", off: noBat,
    label: noBat ? "" : `≤ ${num(bat.max_charge_a, 0)} A ⇅`, lx: 140, ly: 288 });
  // bus -> inverter
  wire(svg, [[390, 260], [390, 304]], { color: "var(--ink)",
    label: inv.units > 1
      ? `${inv.units} × ${num(cur.inverter_dc_a, 0)} A`
      : `${num(cur.inverter_dc_a, 0)} A`, lx: 400, ly: 288 });
  // inverter -> AC bus -> loads / grid
  wire(svg, [[390, 384], [390, 420]], { color: "var(--ink)" });
  wire(svg, [[130, 420], [390, 420], [390, 420]], { color: "var(--ink)" });
  wire(svg, [[130, 420], [130, 450]], { color: "var(--ink)" });
  wire(svg, [[390, 420], [390, 450]], { color: "var(--grid)", dash: "7 6" });
  svg.append(node("text", { x: 260, y: 412, class: "bd-label bd-center" },
    t("design.d.ac_bus")));

  // ---- DC bus bar
  svg.append(node("rect", { x: 20, y: 246, width: 480, height: 14, rx: 7,
    fill: "var(--accent)" }));
  svg.append(node("text", { x: 260, y: 240, class: "bd-bus" },
    t("design.d.bus", { v })));

  // ---- boxes
  box(svg, { x: 20, y: 18, w: 220, h: 80, color: "var(--pv)", off: noPv,
    title: t("design.d.pv"),
    lines: [`${num(rec.pv_panels, 0)} × ${num(rec.pv_panel_w, 0)} W`,
            `= ${num(rec.pv_kw, 2)} kW`] });
  box(svg, { x: 280, y: 18, w: 220, h: 80, color: "var(--wind)", off: noWind,
    title: t("design.d.wind"),
    lines: [`${num(rec.wind_turbines, 0)} × ${num(rec.wind_turbine_kw, 1)} kW`,
            `= ${num(rec.wind_kw, 2)} kW`] });
  box(svg, { x: 20, y: 140, w: 220, h: 60, color: "var(--pv)", off: noPv,
    title: t("design.d.mppt"), lines: [`DC → ${v} V DC`] });
  box(svg, { x: 280, y: 140, w: 220, h: 60, color: "var(--wind)", off: noWind,
    title: t("design.d.rect"), lines: [`AC → ${v} V DC`] });

  box(svg, { x: 20, y: 304, w: 220, h: 80, color: "var(--battery)", off: noBat,
    title: t("design.d.battery", { chem: bat ? bat.chemistry : "" }),
    lines: bat ? [
      `${num(bat.packs_parallel, 0)} × ${num(bat.pack_voltage_v, 1)} V (${bat.cells_series}S)`,
      `${num(bat.nominal_kwh, 1)} kWh • ${num(bat.bank_ah, 0)} Ah`,
    ] : [] });
  box(svg, { x: 280, y: 304, w: 220, h: 80, color: "var(--ink)",
    title: t("design.d.inverter"),
    lines: [`${inv.units} × ${num(inv.unit_kw, 1)} kW`, `${v} V DC → 230 V AC`] });

  box(svg, { x: 20, y: 450, w: 220, h: 70, color: "var(--ink)",
    title: t("design.d.load"),
    lines: [t("design.d.peak"), `${num(design.peak_load_kw, 2)} kW`] });
  box(svg, { x: 280, y: 450, w: 220, h: 70, color: "var(--grid)",
    title: t("design.d.grid"), lines: [t("design.d.grid_line")] });

  container.append(svg);
  container.setAttribute("aria-label", t("design.title"));
}
