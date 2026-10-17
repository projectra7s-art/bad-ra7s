// Number / unit formatting used by the results panel.

export function num(value, decimals = 1) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
}

// data-fmt="..." name -> formatter
export const FORMATTERS = {
  text: (v) => String(v),
  int:  (v) => num(v, 0),
  kw:   (v) => `${num(v, 2)} kW`,
  kwh:  (v) => `${num(v, 1)} kWh`,
  w:    (v) => `${num(v, 0)} W`,
  sar:  (v) => `${num(v, 0)} \u20C1`,
  pct:  (v) => `${num(v, 1)}%`,
  mps:  (v) => `${num(v, 2)} m/s`,
  wm2:  (v) => `${num(v, 1)} W/m²`,
  m:    (v) => `${num(v, 0)} m`,
  c:    (v) => `${num(v, 1)} °C`,
  rho:  (v) => `${num(v, 3)} kg/m³`,
  num3: (v) => num(v, 3),
  num2: (v) => num(v, 2),
  volt: (v) => `${num(v, 1)} V`,
  amp:  (v) => `${num(v, 0)} A`,
  ah:   (v) => `${num(v, 0)} Ah`,
  crate: (v) => `${num(v, 2)}C`,
  sarkwh: (v) => `${num(v, 3)} \u20C1/kWh`,
};
