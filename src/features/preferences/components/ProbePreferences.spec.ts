import { describe, expect, it } from "vitest";
import ProbePreferences from "./ProbePreferences.vue";
import type { DOMWrapper, VueWrapper } from "@vue/test-utils";
import {
  BUILT_IN_TRANSFORM_CHAINS,
  copyTransformChain,
  DEFAULT_TRANSFORM_CHAIN_ID,
  type TransformInputComponent,
  type TransformInputGroup
} from "@/features/scene";
import { flushMicrotasks, mountWithQuasar } from "@/test/mount-helper";
import { usePreferencesStore } from "@/stores/preferences.store";
import enUS from "@/i18n/en-US";

const t = enUS.preferences;

/** Every input name field, with the axis its label names. */
const INPUT_NAME_FIELDS: Array<
  [TransformInputGroup, TransformInputComponent, string]
> = [
  ["globalTranslation", 0, t.axisAp],
  ["globalTranslation", 1, t.axisDv],
  ["globalTranslation", 2, t.axisMl],
  ["globalRotation", 0, t.axisRoll],
  ["globalRotation", 1, t.axisYaw],
  ["globalRotation", 2, t.axisPitch],
  ["localRotation", 0, t.axisRoll],
  ["localRotation", 1, t.axisYaw],
  ["localRotation", 2, t.axisPitch],
  ["localTranslation", 0, t.axisAp],
  ["localTranslation", 1, t.axisDv],
  ["localTranslation", 2, t.axisMl]
];

/**
 * Accessible name of one input's name field, as `ProbePreferences` renders it.
 * @param group Group the input belongs to.
 * @param axis Axis label of the input.
 */
function nameFieldLabel(group: TransformInputGroup, axis: string): string {
  return t.transformInputNameLabel
    .replace("{group}", enUS.transformChain[group])
    .replace("{axis}", axis);
}

/**
 * Locate one input's name field by its accessible name.
 * @param wrapper Mounted `ProbePreferences` wrapper.
 * @param group Group the input belongs to.
 * @param axis Axis label of the input.
 */
function nameField(
  wrapper: VueWrapper,
  group: TransformInputGroup,
  axis: string
): DOMWrapper<Element> {
  return wrapper.find(`input[aria-label="${nameFieldLabel(group, axis)}"]`);
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
 * Locate a `q-input` in `ProbePreferences` by its label.
 * @param wrapper Mounted `ProbePreferences` wrapper.
 * @param label Field label to search for.
 */
function fieldByLabel(
  wrapper: ReturnType<typeof mountWithQuasar>,
  label: string
) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(field => field.props("label") === label)!;
}

describe("ProbePreferences", () => {
  it("typing 50 into Rod Length writes 50 to probeRodLengthMillimeters", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();

    await fieldByLabel(wrapper, t.rodLength).vm.$emit(
      "update:modelValue",
      "50"
    );

    expect(preferences.probeRodLengthMillimeters).toBe(50);
  });

  it("typing 0 into Shank Thickness clamps to the 0.001 minimum", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();

    await fieldByLabel(wrapper, t.shankThickness).vm.$emit(
      "update:modelValue",
      "0"
    );

    expect(preferences.probeShankThicknessMillimeters).toBe(0.001);
  });

  it("clamps a negative value to a non-negative minimum for every geometry field", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();
    const fields: Array<
      [string, keyof ReturnType<typeof usePreferencesStore>]
    > = [
      [t.shankThickness, "probeShankThicknessMillimeters"],
      [t.headStageLength, "probeHeadStageLengthMillimeters"],
      [t.headStageCutDepth, "probeHeadStageCutDepthMillimeters"],
      [t.rodDiameter, "probeRodDiameterMillimeters"],
      [t.rodLength, "probeRodLengthMillimeters"]
    ];

    for (const [label, key] of fields) {
      await fieldByLabel(wrapper, label).vm.$emit("update:modelValue", "-5");

      expect(preferences[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it("displays every geometry field in the preferences store's position unit", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();
    preferences.probeShankThicknessMillimeters = 1;
    preferences.positionUnit = "micrometer";
    await wrapper.vm.$nextTick();

    const shankThickness = fieldByLabel(wrapper, t.shankThickness);
    expect(shankThickness.props("modelValue")).toBe(1000);
    expect(shankThickness.props("suffix")).toBe("µm");
  });

  it("writes a value entered in the display unit back in millimeters", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();
    preferences.positionUnit = "micrometer";
    await wrapper.vm.$nextTick();

    await fieldByLabel(wrapper, t.rodLength).vm.$emit(
      "update:modelValue",
      "500"
    );

    expect(preferences.probeRodLengthMillimeters).toBe(0.5);
  });

  it("writes every one of the twelve transform input names", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();

    for (const [group, component, axis] of INPUT_NAME_FIELDS) {
      await editAndBlur(
        nameField(wrapper, group, axis),
        `${group} ${component}`
      );

      expect(preferences.transformInputNames[group][component]).toBe(
        `${group} ${component}`
      );
    }
  });

  it("trims a transform input name before saving it", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();

    await editAndBlur(
      nameField(wrapper, "globalTranslation", t.axisAp),
      "  Stage X  "
    );

    expect(preferences.transformInputNames.globalTranslation[0]).toBe(
      "Stage X"
    );
  });

  it("rejects a blank transform input name, keeping the previous one", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();

    await editAndBlur(nameField(wrapper, "localTranslation", t.axisAp), "   ");

    expect(preferences.transformInputNames.localTranslation[0]).toBe(
      enUS.transformChain.localDepth
    );
  });

  it("lists every chain in the default probe chain select and writes the pick", async () => {
    const wrapper = mountWithQuasar(ProbePreferences);
    const preferences = usePreferencesStore();
    const chain = copyTransformChain(BUILT_IN_TRANSFORM_CHAINS[0]!, "Arm");
    preferences.transformChains.push(chain);
    await wrapper.vm.$nextTick();

    const select = wrapper
      .findAllComponents({ name: "QSelect" })
      .find(field => field.props("label") === t.defaultProbeChain)!;
    expect(select.props("options")).toEqual([
      {
        label: enUS.transformChain.defaultChainName,
        value: DEFAULT_TRANSFORM_CHAIN_ID
      },
      { label: "Arm", value: chain.id }
    ]);

    await select.vm.$emit("update:modelValue", chain.id);

    expect(preferences.defaultProbeChainId).toBe(chain.id);
  });
});
