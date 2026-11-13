'use strict';

/**
 * Graphiques dessinés côté serveur en SVG (aucune librairie, aucun JavaScript nécessaire).
 * Les couleurs viennent des variables CSS du thème (clair / sombre).
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Graduation "propre" pour l'axe Y (1, 2, 5, 10, 20...). */
function niceMax(max) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= max);
  return step * 4;
}

/** Courbe lissée (Catmull-Rom → Bézier) passant par tous les points. */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    // évite que la courbe passe sous la ligne de base entre deux points à 0
    const clamp = (y) => Math.min(y, Math.max(p1[1], p2[1]));
    d += ` C${c1[0].toFixed(1)},${clamp(c1[1]).toFixed(1)} ${c2[0].toFixed(1)},${clamp(c2[1]).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const shortDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][Number(m) - 1]}`;
};

/** Graphique en aire : [{ date: 'AAAA-MM-JJ', count }] */
function areaChart(series, { width = 760, height = 300 } = {}) {
  const pad = { top: 16, right: 12, bottom: 30, left: 34 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...series.map((s) => s.count), 0));
  const x = (i) => pad.left + (series.length === 1 ? w / 2 : (i * w) / (series.length - 1));
  const y = (v) => pad.top + h - (v / max) * h;
  const pts = series.map((s, i) => [x(i), y(s.count)]);

  const grid = [0, 1, 2, 3, 4]
    .map((k) => {
      const v = (max / 4) * k;
      return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${pad.left - 8}" y="${y(v) + 4}" class="ch-axis" text-anchor="end">${v}</text>`;
    })
    .join('');
  const every = Math.ceil(series.length / 8);
  const labels = series
    .map((s, i) => (i % every === 0 || i === series.length - 1 ? `<text x="${x(i)}" y="${height - 8}" class="ch-axis" text-anchor="middle">${shortDate(s.date)}</text>` : ''))
    .join('');
  const line = smoothPath(pts);
  const area = `${line} L${x(series.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z`;
  const dots = series
    .map((s, i) => `<g class="ch-point"><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="9" class="ch-hit"/><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5" class="ch-dot"/><title>${esc(shortDate(s.date))} : ${s.count} inscription(s)</title></g>`)
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Inscriptions par jour">
    <defs><linearGradient id="chFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="ch-fill-top"/><stop offset="1" class="ch-fill-bottom"/></linearGradient></defs>
    ${grid}${labels}
    <path d="${area}" fill="url(#chFill)"/>
    <path d="${line}" class="ch-line"/>
    ${dots}
  </svg>`;
}

/** Petite courbe pour les cartes KPI. */
function sparkline(values, { width = 120, height = 36 } = {}) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i * width) / Math.max(values.length - 1, 1), height - 3 - (v / max) * (height - 6)]);
  return `<svg viewBox="0 0 ${width} ${height}" class="spark" aria-hidden="true"><path d="${smoothPath(pts)}"/></svg>`;
}

/** Anneau de progression (pourcentage). */
function ring(percent, { size = 132, stroke = 12 } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return `<svg viewBox="0 0 ${size} ${size}" class="ring" role="img" aria-label="${p} %">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-value" stroke-width="${stroke}" stroke-dasharray="${((p / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

module.exports = { areaChart, sparkline, ring, shortDate };
