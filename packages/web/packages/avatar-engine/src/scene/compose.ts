// Thin re-export so import sites read by intent (`scene/compose`) rather than
// by file layout — the implementation lives entirely in `rig.ts`, where the
// tree walk, the compositor and the filter over its output stay adjacent.
export { compose, cropList, type DisplayItem, type DisplayList } from "./rig";
