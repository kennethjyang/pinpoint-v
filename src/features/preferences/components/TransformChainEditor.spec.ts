import { describe, expect, it } from "vitest";
import type { DOMWrapper, VueWrapper } from "@vue/test-utils";
import TransformChainEditor from "./TransformChainEditor.vue";
import TransformChainStepRow from "./TransformChainStepRow.vue";
import CommittedInput from "@/components/CommittedInput.vue";
import {
  BUILT_IN_TRANSFORM_CHAINS,
  DEFAULT_TRANSFORM_CHAIN_ID
} from "@/features/scene";
import { makeTransformChain } from "@/test/fixtures";
import { flushMicrotasks, mountWithQuasar } from "@/test/mount-helper";
import { usePreferencesStore } from "@/stores/preferences.store";
import enUS from "@/i18n/en-US";

const t = enUS.preferences;

/** Kinds of the built-in default chain's five steps. */
const BUILT_IN_KINDS = [
  "translation",
  "rotation",
  "rotation",
  "rotation",
  "translation"
];

/**
 * Locate a `q-btn` by its label or its accessible name.
 * @param wrapper Mounted editor wrapper.
 * @param label Label or accessible name to search for.
 */
function buttonByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QBtn" })
    .find(
      button =>
        button.props("label") === label ||
        button.attributes("aria-label") === label
    );
}

/**
 * Locate a `q-select` by its label.
 * @param wrapper Mounted editor wrapper.
 * @param label Field label to search for.
 */
function selectByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QSelect" })
    .find(field => field.props("label") === label);
}

/**
 * Selects of one step row: its kind select, then its three argument selects.
 * @param wrapper Mounted editor wrapper.
 * @param index Index of the step row.
 */
function stepSelects(wrapper: VueWrapper, index: number) {
  return wrapper
    .findAllComponents(TransformChainStepRow)
    [index]!.findAllComponents({ name: "QSelect" });
}

/**
 * Kind each step row of the shown chain is set to, read off its kind select.
 * @param wrapper Mounted editor wrapper.
 */
function shownStepKinds(wrapper: VueWrapper): unknown[] {
  return wrapper
    .findAllComponents(TransformChainStepRow)
    .map((_, index) => stepSelects(wrapper, index)[0]!.props("modelValue"));
}

/**
 * Locate the edited chain's name field.
 * @param wrapper Mounted editor wrapper.
 */
function chainNameField(wrapper: VueWrapper): DOMWrapper<HTMLInputElement> {
  return wrapper.findComponent(CommittedInput).find("input");
}

/**
 * Focus, replace a field's text, and blur it -- the sequence a real user
 * produces, which `CommittedInput` requires in this order.
 */
async function editAndBlur(native: DOMWrapper<Element>, value: string) {
  await native.trigger("focusin");
  await native.setValue(value);
  await native.trigger("focusout");
  await flushMicrotasks();
}

/**
 * Mount the editor and add a user chain copied from the built-in default, the
 * starting point of every editing test.
 */
async function mountWithUserChain() {
  const wrapper = mountWithQuasar(TransformChainEditor);
  const preferences = usePreferencesStore();

  await buttonByLabel(wrapper, t.addChain)!.trigger("click");

  return { wrapper, preferences, chain: preferences.transformChains[0]! };
}

describe("TransformChainEditor", () => {
  it("shows the built-in chain locked, with nothing to rename, add or delete", () => {
    const wrapper = mountWithQuasar(TransformChainEditor);

    expect(wrapper.findAllComponents({ name: "QItem" })).toHaveLength(1);
    expect(
      wrapper
        .findAllComponents({ name: "QIcon" })
        .some(icon => icon.props("name") === "lock")
    ).toBe(true);
    expect(buttonByLabel(wrapper, t.deleteChain)).toBeUndefined();
    expect(buttonByLabel(wrapper, t.deleteStep)).toBeUndefined();
    expect(buttonByLabel(wrapper, t.addStep)).toBeUndefined();
    // The only text fields shown are the locked fixed values of the built-in's
    // three single-angle rotation steps and its depth step -- there is no chain
    // name field to rename.
    const fixedValueFields = wrapper
      .findAllComponents(CommittedInput)
      .map(field => field.findComponent({ name: "QInput" }));
    expect(fixedValueFields).toHaveLength(8);
    expect(
      fixedValueFields.every(field => field.props("label") === t.fixedValue)
    ).toBe(true);
    expect(
      fixedValueFields.every(field => field.props("disable") === true)
    ).toBe(true);
    expect(
      stepSelects(wrapper, 0).every(select => select.props("disable") === true)
    ).toBe(true);
    expect(selectByLabel(wrapper, t.depthAxis)!.props("disable")).toBe(true);
    expect(wrapper.find(".step-row__handle").exists()).toBe(false);
  });

  it("adds an editable copy of the shown chain", async () => {
    const { wrapper, chain, preferences } = await mountWithUserChain();

    expect(preferences.transformChains).toHaveLength(1);
    expect(chain.isBuiltIn).toBe(false);
    expect(chain.name).toBe(
      t.chainCopyName.replace("{name}", enUS.transformChain.defaultChainName)
    );
    expect(chain.steps).toEqual(BUILT_IN_TRANSFORM_CHAINS[0]!.steps);
    expect(chain.depthAxis).toEqual(BUILT_IN_TRANSFORM_CHAINS[0]!.depthAxis);
    expect(chainNameField(wrapper).element.value).toBe(chain.name);
    expect(
      stepSelects(wrapper, 0).every(select => select.props("disable") === false)
    ).toBe(true);
  });

  it("renames a user chain, trimming the typed name", async () => {
    const { wrapper, chain } = await mountWithUserChain();

    await editAndBlur(chainNameField(wrapper), "  Stereotax arm  ");

    expect(chain.name).toBe("Stereotax arm");
  });

  it("edits only the copy, never the built-in chain it came from", async () => {
    const { wrapper, chain } = await mountWithUserChain();

    await stepSelects(wrapper, 0)[0]!.vm.$emit("update:modelValue", "rotation");

    expect(chain.steps[0]!.kind).toBe("rotation");
    expect(BUILT_IN_TRANSFORM_CHAINS[0]!.steps.map(step => step.kind)).toEqual(
      BUILT_IN_KINDS
    );
  });

  it("switches a step argument to a fixed value and back to an input", async () => {
    const { wrapper, chain } = await mountWithUserChain();

    await stepSelects(wrapper, 0)[1]!.vm.$emit("update:modelValue", "");
    expect(chain.steps[0]!.arguments[0]).toBe(0);

    const row = wrapper.findAllComponents(TransformChainStepRow)[0]!;
    await editAndBlur(row.findComponent(CommittedInput).find("input"), "2.5");
    expect(chain.steps[0]!.arguments[0]).toBe(2.5);

    await stepSelects(wrapper, 0)[1]!.vm.$emit(
      "update:modelValue",
      "localRotation:2"
    );
    expect(chain.steps[0]!.arguments[0]).toEqual({
      group: "localRotation",
      component: 2
    });
    expect(
      wrapper
        .findAllComponents(TransformChainStepRow)[0]!
        .findAllComponents(CommittedInput)
    ).toHaveLength(0);
  });

  it("stores a rotation step's fixed value in radians, entered in degrees", async () => {
    const { wrapper, chain } = await mountWithUserChain();
    const selects = stepSelects(wrapper, 0);

    await selects[0]!.vm.$emit("update:modelValue", "rotation");
    await selects[1]!.vm.$emit("update:modelValue", "");
    const row = wrapper.findAllComponents(TransformChainStepRow)[0]!;
    await editAndBlur(row.findComponent(CommittedInput).find("input"), "90");

    expect(chain.steps[0]!.arguments[0]).toBeCloseTo(Math.PI / 2);
    expect(row.findComponent({ name: "QInput" }).props("suffix")).toBe(
      enUS.units.degree
    );
  });

  it("appends a translation step reading nothing", async () => {
    const { wrapper, chain } = await mountWithUserChain();

    await buttonByLabel(wrapper, t.addStep)!.trigger("click");

    expect(chain.steps).toHaveLength(6);
    expect(chain.steps[5]).toEqual({
      kind: "translation",
      arguments: [0, 0, 0]
    });
  });

  it("deletes the step whose delete button is clicked", async () => {
    const { wrapper, chain } = await mountWithUserChain();
    const builtInSteps = BUILT_IN_TRANSFORM_CHAINS[0]!.steps;

    await wrapper
      .findAll(`[aria-label="${t.deleteStep}"]`)[1]!
      .trigger("click");

    expect(chain.steps).toEqual([
      builtInSteps[0],
      builtInSteps[2],
      builtInSteps[3],
      builtInSteps[4]
    ]);
  });

  it("reorders a step when its handle is dragged onto another row", async () => {
    const { wrapper, chain } = await mountWithUserChain();
    const builtInSteps = BUILT_IN_TRANSFORM_CHAINS[0]!.steps;
    const rows = wrapper.findAll(".step-row");

    await rows[0]!.find(".step-row__handle").trigger("dragstart");
    await rows[2]!.trigger("dragover");
    await rows[2]!.trigger("drop");

    expect(chain.steps).toEqual([
      builtInSteps[1],
      builtInSteps[2],
      builtInSteps[0],
      builtInSteps[3],
      builtInSteps[4]
    ]);
    expect(shownStepKinds(wrapper)).toEqual([
      "rotation",
      "rotation",
      "translation",
      "rotation",
      "translation"
    ]);
  });

  it("sets and clears the chain's depth axis", async () => {
    const { wrapper, chain } = await mountWithUserChain();
    const select = selectByLabel(wrapper, t.depthAxis)!;

    await select.vm.$emit("update:modelValue", "globalRotation:1");
    expect(chain.depthAxis).toEqual({ group: "globalRotation", component: 1 });

    await select.vm.$emit("update:modelValue", "");
    expect(chain.depthAxis).toBeNull();
  });

  it("labels every input option with its group and its user-given name", async () => {
    const { wrapper, preferences } = await mountWithUserChain();
    preferences.transformInputNames.globalTranslation[0] = "Stage X";
    await wrapper.vm.$nextTick();

    expect(
      selectByLabel(wrapper, t.depthAxis)!.props("options")
    ).toContainEqual({
      label: t.transformInputOption
        .replace("{group}", enUS.transformChain.globalTranslation)
        .replace("{name}", "Stage X"),
      value: "globalTranslation:0"
    });
  });

  it("reports which inputs the edited chain leaves unused", async () => {
    const wrapper = mountWithQuasar(TransformChainEditor);
    const preferences = usePreferencesStore();

    // The built-in default fixes the global roll, two of the three local
    // rotations and two of the three local translations, so those five inputs
    // drive nothing.
    expect(wrapper.find(".text-caption").text()).toBe(
      t.unusedInputs.replace(
        "{names}",
        "Roll, Local Yaw, Local Pitch, Local Forward, Local Right"
      )
    );

    const everyInputChain = makeTransformChain();
    preferences.transformChains.push(everyInputChain);
    await wrapper.vm.$nextTick();
    await wrapper
      .find(
        `[aria-label="${t.editChain.replace("{name}", everyInputChain.name)}"]`
      )
      .trigger("click");

    expect(wrapper.find(".text-caption").text()).toBe(t.allInputsUsed);

    await wrapper
      .findAll(`[aria-label="${t.deleteStep}"]`)[0]!
      .trigger("click");

    expect(wrapper.find(".text-caption").text()).toBe(
      t.unusedInputs.replace("{names}", "AP, DV, ML")
    );
  });

  it("deletes a user chain, resetting the default probe chain it named", async () => {
    const { wrapper, chain, preferences } = await mountWithUserChain();
    preferences.defaultProbeChainId = chain.id;
    await wrapper.vm.$nextTick();

    await buttonByLabel(wrapper, t.deleteChain)!.trigger("click");

    expect(preferences.transformChains).toHaveLength(0);
    expect(preferences.defaultProbeChainId).toBe(DEFAULT_TRANSFORM_CHAIN_ID);
    expect(
      wrapper
        .findAllComponents(CommittedInput)
        .some(
          field =>
            field.findComponent({ name: "QInput" }).props("label") ===
            t.chainName
        )
    ).toBe(false);
  });

  it("keeps the default probe chain when another user chain is deleted", async () => {
    const { wrapper, chain, preferences } = await mountWithUserChain();
    preferences.defaultProbeChainId = DEFAULT_TRANSFORM_CHAIN_ID;
    await wrapper.vm.$nextTick();

    await buttonByLabel(wrapper, t.deleteChain)!.trigger("click");

    expect(preferences.transformChains).toHaveLength(0);
    expect(preferences.defaultProbeChainId).toBe(DEFAULT_TRANSFORM_CHAIN_ID);
    expect(chain.id).not.toBe(DEFAULT_TRANSFORM_CHAIN_ID);
  });
});
