import { describe, expect, it } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import CoordinateSystemInspector from "./CoordinateSystemInspector.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { makeCoordinateSystem } from "@/test/fixtures";
import enUS from "@/i18n/en-US";

const t = enUS.coordinateSystemInspector;

function fieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(field => field.props("label") === label)!;
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

  it("renders an empty chain list", () => {
    const { wrapper } = mountInspector();

    const list = wrapper.findComponent({ name: "QList" });
    expect(list.exists()).toBe(true);
    expect(list.findAllComponents({ name: "QItem" })).toHaveLength(0);
  });
});
