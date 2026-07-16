/** A tiny zero-dependency SVG line chart — the rating-trend visual on the
 * Player Insights page. `el()` in dom.ts only builds HTML elements, so this
 * gets its own small SVG-namespace builder rather than extending that. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  /** A reference line drawn at this value (e.g. the Solver Score's starting
   * point of 50), omitted if not given. */
  baseline?: number;
  /** The value range the chart plots against; defaults to the data's own
   * min/max (padded slightly) if not given. */
  min?: number;
  max?: number;
}

/** Build an `<svg>` line chart from a series of values, oldest first. Values
 * are expected in a bounded, human-scale domain (e.g. 0–100 Solver Score) —
 * this component doesn't know or care what the numbers mean. */
export function sparkline(values: number[], opts: SparklineOptions = {}): SVGSVGElement {
  const width = opts.width ?? 240;
  const height = opts.height ?? 64;
  const pad = 4;

  const svg = svgEl('svg', {
    class: 'sparkline', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true',
  });

  if (values.length === 0) return svg;

  const dataMin = Math.min(...values, opts.baseline ?? Infinity);
  const dataMax = Math.max(...values, opts.baseline ?? -Infinity);
  const min = opts.min ?? (dataMin === dataMax ? dataMin - 1 : dataMin);
  const max = opts.max ?? (dataMin === dataMax ? dataMax + 1 : dataMax);

  const x = (i: number): number => values.length === 1
    ? width / 2
    : pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number): number => height - pad - ((v - min) / (max - min)) * (height - pad * 2);

  if (opts.baseline !== undefined) {
    svg.append(svgEl('line', {
      class: 'sparkline-baseline',
      x1: pad, x2: width - pad, y1: y(opts.baseline), y2: y(opts.baseline),
    }));
  }

  if (values.length > 1) {
    const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    svg.append(svgEl('polyline', { class: 'sparkline-line', points, fill: 'none' }));
  }

  const lastIndex = values.length - 1;
  svg.append(svgEl('circle', {
    class: 'sparkline-dot', cx: x(lastIndex), cy: y(values[lastIndex]!), r: 3,
  }));

  return svg;
}
