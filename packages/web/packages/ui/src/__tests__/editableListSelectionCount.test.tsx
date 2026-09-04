// @vitest-environment jsdom
//
// What the bar's count is counting.
//
// `selectedIds` and `selectedRows` agree almost always, which is why the difference between them
// went unnoticed: `selectedRows` is a `useMemo` intersection with `allRows`, and `selectedIds` is
// pruned back to that same intersection by a PASSIVE EFFECT — one render later, by definition.
// For the render in between, a row that has just left the list (deleted, or dropped by a refetch)
// is still an id in the set and matches no row anywhere, so a bar counting ids reports a row the
// operator cannot find and none of the bar's verbs can reach — in the exact moment, a delete they
// just confirmed, when a phantom count reads as the delete having failed.
//
// That render cannot be observed through the DOM: `act` flushes the effect and the re-render it
// schedules before any assertion runs, so a test that deletes a row passes against BOTH spellings.
// So the disagreement is held still instead. `EditableList` takes its controller as a PROP, and
// the fixture below hands it the exact state the hook passes through — a set carrying an id no row
// answers to — rather than racing React for a glimpse of it.
import { describe, expect, it } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { EditableList } from "../blocks/editable-list"
import type { EditableListController } from "../blocks/use-editable-list"
import type { EditableListColumn } from "../blocks/editable-list-types"

afterEach(cleanup)

interface Row {
  id: string
  name: string
}

const ADA: Row = { id: "a", name: "Ada" }
const BO: Row = { id: "b", name: "Bo" }

const columns: EditableListColumn<Row>[] = [{ key: "name", header: "Name", value: (r) => r.name }]

/**
 * A controller in whatever state the test needs, with the two selection views given separately.
 *
 * The hook is not used here on purpose: its whole job is to keep these two in agreement, so
 * driving this through the hook could only ever assert what the hook already guarantees. What is
 * under test is which of the two the BAR reads when they disagree.
 */
function controller(state: {
  rows: Row[]
  allRows: Row[]
  selectedIds: string[]
  selectedRows: Row[]
}): EditableListController<Row> {
  return {
    columns,
    getRowId: (r) => r.id,
    rows: state.rows,
    allRows: state.allRows,
    search: "",
    setSearch: () => {},
    sort: null,
    setSort: () => {},
    selectedIds: new Set(state.selectedIds),
    setSelectedIds: () => {},
    clearSelection: () => {},
    selectedRows: state.selectedRows,
    facets: [],
    facetOptions: {},
    facetSelection: {},
    setFacetSelection: () => {},
    textFilters: [],
    textFilterValues: {},
    setTextFilterValue: () => {},
    filtered: state.rows.length !== state.allRows.length,
  }
}

function renderList(list: EditableListController<Row>) {
  render(
    <EditableList<Row>
      list={list}
      ariaLabel="People"
      columnWidthsKey="editable-list-selection-count-test"
      describeRow={(r) => r.name}
    />,
  )
}

/** The bar's count, which is a button because the selection has to be clearable in one press. */
function countButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: /selected/ })
}

describe("the count in the bar", () => {
  it("ignores an id no row answers to, rather than reporting it as hidden", () => {
    // `ghost` is a row that has left the list. Counting ids gives "2 selected (1 not shown)" —
    // a row the operator is told exists, cannot see, and cannot reach.
    renderList(
      controller({
        rows: [ADA, BO],
        allRows: [ADA, BO],
        selectedIds: ["a", "ghost"],
        selectedRows: [ADA],
      }),
    )
    const button = countButton()
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain("1 selected")
    expect(button!.textContent).not.toContain("not shown")
  })

  it("draws no count at all when every selected id has left the list", () => {
    // The bar's verbs act on `selectedRows`, so with none of them left there is nothing for a
    // Clear button to clear and nothing for the count to be about.
    renderList(
      controller({
        rows: [ADA, BO],
        allRows: [ADA, BO],
        selectedIds: ["ghost"],
        selectedRows: [],
      }),
    )
    expect(countButton()).toBeNull()
  })

  it("still reports a row the FILTER is hiding, which is the count this exists for", () => {
    // The other direction, and the reason the number is drawn at all: selection deliberately
    // survives a filter change, so the set the bar's buttons reach is larger than the set on
    // screen — and a bulk delete reaching off the end of a filter is the accident the whole
    // selection model exists to prevent. Said out loud rather than fixed by resetting.
    renderList(
      controller({
        rows: [BO],
        allRows: [ADA, BO],
        selectedIds: ["a"],
        selectedRows: [ADA],
      }),
    )
    const button = countButton()
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain("1 selected")
    expect(button!.textContent).toContain("1 not shown")
  })

  it("counts a hidden row and a departed one apart, in the one render that has both", () => {
    // The delete-under-a-filter case, which is where the two spellings differ most loudly:
    // `a` is selected and filtered out, `ghost` is selected and gone. Counting ids says
    // "2 selected (2 not shown)" and names one row too many in both halves.
    renderList(
      controller({
        rows: [BO],
        allRows: [ADA, BO],
        selectedIds: ["a", "ghost"],
        selectedRows: [ADA],
      }),
    )
    const button = countButton()
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain("1 selected")
    expect(button!.textContent).toContain("1 not shown")
    expect(button!.textContent).not.toContain("2")
  })
})
