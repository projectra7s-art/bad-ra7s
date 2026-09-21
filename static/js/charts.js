// Chart.js charts. All values come from the Python result (no fixed data).

import { getLang, t } from "./i18n.js";

const charts = {};

const isDark = () => document.documentElement.dataset.theme === "dark";

// Solar and wind colors are read from the CSS (--pv and --wind in
// static/style.css), so the cards, icons and charts always match.
// To change a color, edit it there only.
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const COLORS = {
  get solar() { return cssVar("--pv") || "#f2a900"; },
  get wind() { return cssVar("--wind") || "#1e3a8a"; },
  get grid() { return "#94a3b8"; },
  get load() { return isDark() ? "#e2e8f0" : "#0f172a"; },
  get renewable() { return isDark() ? "#2dd4bf" : "#0f766e"; },
  get gridLine() { return "#ef4444"; },
};

function applyThemeDefaults() {
  Chart.defaults.color = isDark() ? "#cbd5e1" : "#475569";
  Chart.defaults.borderColor = isDark()
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(15, 23, 42, 0.08)";
}

function draw(name, canvasId, config) {
  applyThemeDefaults();
  if (charts[name]) charts[name].destroy();
  charts[name] = new Chart(document.getElementById(canvasId), config);
}

// "January" -> "Jan" in English; Arabic month names are already short
function monthLabels() {
  return Array.from({ length: 12 }, (_, i) => {
    const name = t(`month.${i + 1}`);
    return getLang() === "en" ? name.slice(0, 3) : name;
  });
}

/** Monthly production (stacked solar + wind) versus the load line. */
export function renderMonthlyChart(monthly) {
  draw("monthly", "monthlyChart", {
    type: "bar",
    data: {
      labels: monthLabels(),
      datasets: [
        {
          type: "bar",
          label: t("chart.monthly.solar"),
          data: monthly.solar_kwh,
          backgroundColor: COLORS.solar,
          stack: "production",
        },
        {
          type: "bar",
          label: t("chart.monthly.wind"),
          data: monthly.wind_kwh,
          backgroundColor: COLORS.wind,
          stack: "production",
        },
        {
          type: "line",
          label: t("chart.monthly.load"),
          data: monthly.load_kwh,
          borderColor: COLORS.load,
          backgroundColor: COLORS.load,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: "kWh" },
        },
      },
    },
  });
}

/** Pie: share of the yearly demand served by solar, wind and the grid. */
export function renderMixChart(mix) {
  draw("mix", "mixChart", {
    type: "pie",
    data: {
      labels: [
        t("chart.mix.solar"),
        t("chart.mix.wind"),
        t("chart.mix.grid"),
      ],
      datasets: [{
        data: [mix.solar_pct, mix.wind_pct, mix.grid_pct],
        backgroundColor: [COLORS.solar, COLORS.wind, COLORS.grid],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%` },
        },
      },
    },
  });
}

/**
 * Average day: the mean of every hour of the day.
 * period = "all" (whole year) or 0..11 (one month).
 */
export function renderDailyChart(chart, period) {
  const source = period === "all" ? chart : chart.months[Number(period)];

  const line = (label, data, color, fill = false) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color + "22",
    fill,
    tension: 0.25,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
  });

  draw("daily", "energyChart", {
    type: "line",
    data: {
      labels: chart.hours.map((h) => `${h}:00`),
      datasets: [
        line(t("chart.load"), source.load, COLORS.load),
        line(t("chart.renewable"), source.renewable, COLORS.renewable, true),
        line(t("chart.grid"), source.grid, COLORS.gridLine),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "kW" } },
      },
    },
  });
}
