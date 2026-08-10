import { describe, expect, it } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import CoordinateSystemInspector from "./CoordinateSystemInspector.vue";
import CoordinateSystemNodeInspector from "./CoordinateSystemNodeInspector.vue";
import CoordinateSystemValueInspector from "./CoordinateSystemValueInspector.vue";
import CoordinateSystemValueList from "./CoordinateSystemValueList.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { makeCoordinateSystem } from "@/test/fixtures";
import { usePreferencesStore } from "@/stores/preferences.store";
import enUS from "@/i18n/en-US";

const t = enUS.coordinateSystemInspector;
const axis = enUS.axis;

function fieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(field => field.props("label") === label)!;
}

/** The toggle rendering a given label. */
function findToggle(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QToggle" })
    .find(toggle => toggle.props("label") === label)!;
}

/**
 * Focus, replace a field's text, and blur it -- the sequence a real user
 * produces, which `use-field`'s handlers require in this order.
 */
async function editAndBlur(field: VueWrapper, value: string) {
  const native = field.find("input");
  await native.trigger("focusin");
  await native.setValue(value);
  await native.trigger("focusout");
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve);
  await promise;
}

function mountInspector(coordinateSystem = makeCoordinateSystem()) {
  const wrapper = mountWithQuasar(CoordinateSystemInspector, {
    props: { coordinateSystem }
  });
  return { wrapper, coordinateSystem };
}

describe("CoordinateSystemInspector", () => {
  it("trims whitespace when committing a name", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    await editAndBlur(fieldByLabel(wrapper, t.name), "  Renamed  ");

    expect(coordinateSystem.name).toBe("Renamed");
  });

  it("rejects a whitespace-only name and leaves it unchanged", async () => {
    const { wrapper, coordinateSystem } = mountInspector(
      makeCoordinateSystem({ name: "A" })
    );

    await editAndBlur(fieldByLabel(wrapper, t.name), "   ");

    expect(coordinateSystem.name).toBe("A");
  });

  it("clicking Add Transform appends exactly one node to the chain", async () => {
    const { wrapper, coordinateSystem } = mountInspector();
    expect(coordinateSystem.chain).toHaveLength(1);

    const addButton = wrapper
      .findAllComponents({ name: "QBtn" })
      .find(button => button.text().includes(t.addTransform))!;
    await addButton.trigger("click");

    expect(coordinateSystem.chain).toHaveLength(2);
    expect(
      coordinateSystem.chain[1]!.position.map(value => value.name)
    ).toEqual(["ML", "DV", "AP"]);
  });

  it("renders one CoordinateSystemNodeInspector per chain node", () => {
    const { wrapper } = mountInspector(
      makeCoordinateSystem({
        chain: [
          ...makeCoordinateSystem().chain,
          ...makeCoordinateSystem().chain
        ]
      })
    );

    expect(
      wrapper.findAllComponents(CoordinateSystemNodeInspector)
    ).toHaveLength(2);
  });

  it("toggling the offset toggle updates the coordinate system", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    await findToggle(wrapper, t.offsetByReferenceCoordinate).setValue(true);

    expect(coordinateSystem.offsetByReferenceCoordinate).toBe(true);
  });

  it("toggling the surface toggle updates the first node", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    await findToggle(wrapper, t.surfaceCoordinate).setValue(true);

    expect(coordinateSystem.chain[0]!.onSurface).toBe(true);
  });

  it("editing the first value-name field renames the value", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    await editAndBlur(fieldByLabel(wrapper, t.valueName), "  Depth  ");

    expect(coordinateSystem.chain[0]!.position[0]!.name).toBe("Depth");
  });

  it("clicking a value's X axis button swaps the display order", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    const secondPositionValue = wrapper.findAllComponents(
      CoordinateSystemValueInspector
    )[1]!;
    const xButton = secondPositionValue
      .findAllComponents({ name: "QBtn" })
      .find(button => button.text() === axis.x)!;
    await xButton.trigger("click");

    expect(coordinateSystem.chain[0]!.positionDisplayOrder).toEqual([1, 0, 2]);
  });

  it("toggling fixed on a bounded value clears its bounds and hides the bound fields", async () => {
    const coordinateSystem = makeCoordinateSystem();
    coordinateSystem.chain[0]!.position[0]!.bounds = [-1, 1];
    const { wrapper } = mountInspector(coordinateSystem);

    await findToggle(wrapper, t.fixed).setValue(true);

    expect(coordinateSystem.chain[0]!.position[0]!.bounds).toBeNull();
    expect(fieldByLabel(wrapper, t.minimum)).toBeUndefined();
  });

  it("toggling bounded seeds a zero bound and writes the maximum field", async () => {
    const { wrapper, coordinateSystem } = mountInspector();
    usePreferencesStore().positionUnit = "millimeter";
    await wrapper.vm.$nextTick();

    await findToggle(wrapper, t.bounded).setValue(true);

    expect(coordinateSystem.chain[0]!.position[0]!.bounds).toEqual([0, 0]);

    await wrapper.vm.$nextTick();
    await editAndBlur(fieldByLabel(wrapper, t.maximum), "5");

    expect(coordinateSystem.chain[0]!.position[0]!.bounds).toEqual([0, 5]);
  });

  it("drag-reorders position values, keeping axis mapping stable", async () => {
    const { wrapper, coordinateSystem } = mountInspector();

    const positionList = wrapper.findAllComponents(
      CoordinateSystemValueList
    )[0]!;
    const items = positionList.findAllComponents({ name: "QItem" });
    await wrapper.findAll(".value-row__handle")[0]!.trigger("dragstart");
    await items[2]!.trigger("dragover");
    await items[2]!.trigger("drop");

    expect(
      coordinateSystem.chain[0]!.position.map(value => value.name)
    ).toEqual(["DV", "AP", "ML"]);
    expect(coordinateSystem.chain[0]!.positionDisplayOrder).toEqual([2, 0, 1]);
  });
});
