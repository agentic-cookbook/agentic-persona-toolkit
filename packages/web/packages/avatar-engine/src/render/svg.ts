import type { CharacterConfig } from "../config/types";
import type { DisplayItem, DisplayList } from "../scene/rig";

const NS = "http://www.w3.org/2000/svg";

const matrixOf = (item: DisplayItem): string => `matrix(${item.m.join(",")})`;

/**
 * How one display item paints, as ordered attribute pairs, and the ONE place
 * that is decided.
 *
 * There are two render paths here — a live DOM one that mutates reused nodes and
 * a string one for the static and menu-bar renders — and they must agree
 * attribute for attribute or the same character paints two ways. Two hand-written
 * serialisers agreeing today is not the same claim as their still agreeing after
 * someone adds a paint attribute to one of them, so neither writes attributes: a
 * new attribute is added here once, and both paths gain it.
 *
 * Identity (`data-id`) is deliberately NOT in this list. It is written once when
 * a node is created and never rewritten, so it is not a paint attribute.
 */
function attrsOf(
  item: DisplayItem,
  config: CharacterConfig,
): readonly (readonly [string, string])[] {
  const s = config.character.strokeStyle;
  const paint: (readonly [string, string])[] = item.paint.fill
    ? [["fill", item.paint.ink], ["stroke", "none"]]
    : [
        ["fill", "none"],
        ["stroke", item.paint.ink],
        ["stroke-width", String(item.paint.width ?? s.width)],
        ["stroke-linecap", s.linecap],
        ["stroke-linejoin", s.linejoin],
      ];
  return [
    ["d", item.d],
    ["transform", matrixOf(item)],
    ["opacity", String(item.paint.alpha)],
    ...paint,
  ];
}

/**
 * Write one display item's attributes onto one <path>. Every renderer on every
 * platform does exactly this and nothing else — the interesting work happened in
 * the compositor, which is why swapping this file for CAShapeLayer changes no
 * behaviour.
 */
function applyItem(el: SVGPathElement, item: DisplayItem, config: CharacterConfig): void {
  for (const [name, value] of attrsOf(item, config)) el.setAttribute(name, value);
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

const attrs = (item: DisplayItem, config: CharacterConfig): string =>
  [`data-id="${item.id}"`, ...attrsOf(item, config).map(([n, v]) => `${n}="${v}"`)].join(" ");

/** DOM-free rendering, for tests and for the static/menu-bar render path. */
export function renderToString(config: CharacterConfig, list: DisplayList): string {
  const { w, h } = config.character.canvas;
  const body = list.map((item) => `<path ${attrs(item, config)}/>`).join("");
  return `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
