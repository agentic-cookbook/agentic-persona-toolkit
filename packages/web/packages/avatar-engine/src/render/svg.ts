import type { CharacterConfig } from "../config/types";
import type { DisplayItem, DisplayList } from "../scene/rig";

const NS = "http://www.w3.org/2000/svg";

const matrixOf = (item: DisplayItem): string => `matrix(${item.m.join(",")})`;

/**
 * Write one display item's attributes onto one <path>. Every renderer on every
 * platform does exactly this and nothing else — the interesting work happened in
 * the compositor, which is why swapping this file for CAShapeLayer changes no
 * behaviour.
 */
function applyItem(el: SVGPathElement, item: DisplayItem, config: CharacterConfig): void {
  el.setAttribute("d", item.d);
  el.setAttribute("transform", matrixOf(item));
  el.setAttribute("opacity", String(item.paint.alpha));
  if (item.paint.fill) {
    el.setAttribute("fill", item.paint.ink);
    el.setAttribute("stroke", "none");
  } else {
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", item.paint.ink);
    el.setAttribute("stroke-width", String(item.paint.width ?? config.character.strokeStyle.width));
    el.setAttribute("stroke-linecap", config.character.strokeStyle.linecap);
    el.setAttribute("stroke-linejoin", config.character.strokeStyle.linejoin);
  }
}

export interface SvgRenderer {
  /** The <svg> element to mount. Created once. */
  element: SVGSVGElement;
  /** Apply a display list. Reuses nodes; never rebuilds the tree. */
  render(list: DisplayList): void;
  destroy(): void;
}

export function createSvgRenderer(config: CharacterConfig, doc: Document = document): SvgRenderer {
  const { w, h } = config.character.canvas;
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("xmlns", NS);
  const paths = new Map<string, SVGPathElement>();

  return {
    element: svg,
    render(list) {
      for (const item of list) {
        let el = paths.get(item.id);
        if (!el) {
          el = doc.createElementNS(NS, "path");
          el.setAttribute("data-id", item.id);
          svg.appendChild(el);       // first frame fixes paint order forever
          paths.set(item.id, el);
        }
        applyItem(el, item, config);
      }
    },
    destroy() {
      paths.clear();
      svg.replaceChildren();
    },
  };
}

const attrs = (item: DisplayItem, config: CharacterConfig): string => {
  const s = config.character.strokeStyle;
  const paint = item.paint.fill
    ? `fill="${item.paint.ink}" stroke="none"`
    : `fill="none" stroke="${item.paint.ink}" stroke-width="${item.paint.width ?? s.width}"` +
      ` stroke-linecap="${s.linecap}" stroke-linejoin="${s.linejoin}"`;
  return `data-id="${item.id}" d="${item.d}" transform="${matrixOf(item)}"` +
    ` opacity="${item.paint.alpha}" ${paint}`;
};

/** DOM-free rendering, for tests and for the static/menu-bar render path. */
export function renderToString(config: CharacterConfig, list: DisplayList): string {
  const { w, h } = config.character.canvas;
  const body = list.map((item) => `<path ${attrs(item, config)}/>`).join("");
  return `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
