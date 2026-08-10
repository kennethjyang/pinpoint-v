import { describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SceneObjectInspector from "./SceneObjectInspector.vue";
import { flushMicrotasks, mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  makeSceneObject,
  makeTransformChain,
  makeTransformInputs
} from "@/test/fixtures";
import {
  DEFAULT_TRANSFORM_CHAIN_ID,
  TRANSFORM_INPUT_GROUPS,
  type TransformChain,
  type TransformInputComponent
} from "@/features/scene";
import enUS from "@/i18n/en-US";

// `useCurrentExperimentStore`'s `manifest`/`terminologyRows` are
// `computedAsync` and fetch on store creation -- mock the leaf module (not
// the `@/features/atlas` barrel) or mounting triggers real network calls.
// Mirrors the mocking approach in `ProbeInspector.spec.ts`.
vi.mock("@/features/atlas/api/source.api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/atlas/api/source.api")
  >("@/features/atlas/api/source.api");
  return {
    ...actual,
    getTerminologyRows: vi.fn().mockResolvedValue([])
  };
});

const t = enUS.sceneObjectInspector;
const axis = enUS.axis;
const transformChain = enUS.transformChain;

/** Every component slot of an input group, for iterating the twelve inputs. */
const COMPONENTS: readonly TransformInputComponent[] = [0, 1, 2];

/**
 * A user chain whose single translation step reads only the global translation
 * group, leaving the other nine inputs unused.
 */
const TRANSLATION_ONLY_CHAIN: TransformChain = {
  id: "translation-only",
  name: "Translation only",
  isBuiltIn: false,
  steps: [
    {
      kind: "translation",
      arguments: [
        { group: "globalTranslation", component: 0 },
        { group: "globalTranslation", component: 1 },
        { group: "globalTranslation", component: 2 }
      ]
    }
  ],
  depthAxis: null
};

/**
 * A user chain driving all twelve inputs, one step per group -- unlike the
 * built-in default, which fixes every local rotation and every local
 * translation but its depth axis.
 */
const ALL_INPUTS_CHAIN = makeTransformChain();

function fieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(field => field.props("label") === label)!;
}

/**
 * Finds a transform input field by its preference name, disambiguated from the
 * scale row - whose labels repeat AP/DV/ML - by its unit suffix.
 */
function transformFieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(
      field =>
        field.props("label") === label &&
        field.props("suffix") !== t.scaleSuffix
    )!;
}

/** Finds a scale field by label, disambiguated from the position row by its `×` suffix. */
function scaleFieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(
      field =>
        field.props("label") === label &&
        field.props("suffix") === t.scaleSuffix
    )!;
}

function buttonByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAll("button")
    .find(button => button.attributes("aria-label") === label)!;
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
  await flushMicrotasks();
}

function mountInspector(
  sceneObject = makeSceneObject(),
  chains: TransformChain[] = []
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  usePreferencesStore(pinia).transformChains = chains;
  const store = useCurrentExperimentStore(pinia);
  store.experiment.sceneObjects = [sceneObject];

  const wrapper = mountWithQuasar(SceneObjectInspector, {
    pinia,
    props: { sceneObject: store.experiment.sceneObjects[0]! }
  });
  return { wrapper, store, sceneObject: store.experiment.sceneObjects[0]! };
}

describe("SceneObjectInspector", () => {
  it("commits the trimmed name on blur", async () => {
    const { wrapper, sceneObject } = mountInspector(
      makeSceneObject({ name: "A" })
    );

    await editAndBlur(fieldByLabel(wrapper, t.name), "  Renamed  ");

    expect(sceneObject.name).toBe("Renamed");
  });

  it("commits every one of the twelve transform inputs, under its preference name", async () => {
    const { wrapper, sceneObject } = mountInspector(
      makeSceneObject({ transformChainId: ALL_INPUTS_CHAIN.id }),
      [ALL_INPUTS_CHAIN]
    );
    const names = usePreferencesStore().transformInputNames;

    for (const [row, group] of TRANSFORM_INPUT_GROUPS.entries()) {
      for (const component of COMPONENTS) {
        const typed = row * 3 + component + 1;
        const field = transformFieldByLabel(wrapper, names[group][component]);
        expect(field, `${group}[${component}] field`).toBeDefined();

        await editAndBlur(field, String(typed));

        // Rotation groups display degrees, translation groups millimeters.
        const expected = group.endsWith("Rotation")
          ? (typed * Math.PI) / 180
          : typed;
        expect(
          sceneObject.transformInputs[group][component],
          `${group}[${component}] value`
        ).toBeCloseTo(expected, 6);
      }
    }
  });

  it("captions each input row with its group and suffixes it with the group's unit", () => {
    const { wrapper } = mountInspector();
    const names = usePreferencesStore().transformInputNames;

    for (const group of TRANSFORM_INPUT_GROUPS) {
      expect(wrapper.text()).toContain(transformChain[group]);
    }
    expect(
      transformFieldByLabel(wrapper, names.globalTranslation[0]).props("suffix")
    ).toBe("mm");
    expect(
      transformFieldByLabel(wrapper, names.globalRotation[0]).props("suffix")
    ).toBe("°");
  });

  it("labels an input from the user's renamed preference", async () => {
    const { wrapper } = mountInspector();
    const preferences = usePreferencesStore();

    preferences.transformInputNames.localTranslation[2] = "Depth";
    await wrapper.vm.$nextTick();

    expect(transformFieldByLabel(wrapper, "Depth").exists()).toBe(true);
  });

  it("displays the object's stored inputs in the active units", async () => {
    const { wrapper } = mountInspector(
      makeSceneObject({
        transformInputs: makeTransformInputs({
          globalTranslation: [1, 0, 0],
          localRotation: [0, 0, Math.PI / 2]
        })
      })
    );
    const names = usePreferencesStore().transformInputNames;

    expect(
      transformFieldByLabel(wrapper, names.globalTranslation[0]).props(
        "modelValue"
      )
    ).toBe("1.000");
    expect(
      transformFieldByLabel(wrapper, names.localRotation[2]).props("modelValue")
    ).toBe("90.000");
  });

  it("disables the five inputs the built-in default chain fixes at zero, leaving the other seven editable", () => {
    const { wrapper } = mountInspector();
    const names = usePreferencesStore().transformInputNames;

    for (const label of [
      names.globalRotation[0],
      names.localRotation[1],
      names.localRotation[2],
      names.localTranslation[1],
      names.localTranslation[2]
    ]) {
      expect(
        transformFieldByLabel(wrapper, label).props("disable"),
        `${label} disabled`
      ).toBe(true);
    }
    for (const label of [
      ...names.globalTranslation,
      names.globalRotation[1],
      names.globalRotation[2],
      names.localRotation[0],
      names.localTranslation[0]
    ]) {
      expect(
        transformFieldByLabel(wrapper, label).props("disable"),
        `${label} editable`
      ).toBe(false);
    }
  });

  it("disables the inputs its chain never reads, leaving the bound ones editable", async () => {
    const { wrapper } = mountInspector(
      makeSceneObject({ transformChainId: TRANSLATION_ONLY_CHAIN.id })
    );
    const preferences = usePreferencesStore();
    preferences.transformChains = [TRANSLATION_ONLY_CHAIN];
    await wrapper.vm.$nextTick();

    const names = preferences.transformInputNames;
    for (const component of COMPONENTS) {
      expect(
        transformFieldByLabel(
          wrapper,
          names.globalTranslation[component]
        ).props("disable")
      ).toBe(false);
    }
    for (const group of [
      "globalRotation",
      "localRotation",
      "localTranslation"
    ] as const) {
      for (const component of COMPONENTS) {
        expect(
          transformFieldByLabel(wrapper, names[group][component]).props(
            "disable"
          ),
          `${group}[${component}] disabled`
        ).toBe(true);
      }
    }
  });

  it("switches the object's chain from the chain selector", async () => {
    const { wrapper, sceneObject } = mountInspector();
    usePreferencesStore().transformChains = [TRANSLATION_ONLY_CHAIN];
    await wrapper.vm.$nextTick();

    const select = wrapper.findComponent({ name: "QSelect" });
    expect(select.props("options")).toEqual([
      {
        label: transformChain.defaultChainName,
        value: DEFAULT_TRANSFORM_CHAIN_ID
      },
      { label: TRANSLATION_ONLY_CHAIN.name, value: TRANSLATION_ONLY_CHAIN.id }
    ]);

    select.vm.$emit("update:modelValue", TRANSLATION_ONLY_CHAIN.id);
    await wrapper.vm.$nextTick();

    expect(sceneObject.transformChainId).toBe(TRANSLATION_ONLY_CHAIN.id);
  });

  it("toggles lock on lock button click", async () => {
    const { wrapper, sceneObject } = mountInspector(
      makeSceneObject({ lock: false })
    );

    await buttonByLabel(wrapper, t.lock).trigger("click");

    expect(sceneObject.lock).toBe(true);
  });

  it("disables the transform, scale, and chain controls while locked, leaving the name field editable", () => {
    // A chain driving all twelve inputs, so the lock alone disables them.
    const { wrapper } = mountInspector(
      makeSceneObject({ lock: true, transformChainId: ALL_INPUTS_CHAIN.id }),
      [ALL_INPUTS_CHAIN]
    );
    const names = usePreferencesStore().transformInputNames;

    for (const group of TRANSFORM_INPUT_GROUPS) {
      for (const component of COMPONENTS) {
        expect(
          transformFieldByLabel(wrapper, names[group][component]).props(
            "disable"
          ),
          `${group}[${component}] disabled`
        ).toBe(true);
      }
    }
    for (const label of [axis.ap, axis.dv, axis.ml]) {
      expect(scaleFieldByLabel(wrapper, label).props("disable")).toBe(true);
    }
    expect(wrapper.findComponent({ name: "QSelect" }).props("disable")).toBe(
      true
    );
    expect(fieldByLabel(wrapper, t.name).props("disable")).toBeFalsy();
  });

  it("toggles collidable when the collision detection toggle changes", async () => {
    const { wrapper, sceneObject } = mountInspector(
      makeSceneObject({ collidable: true })
    );

    await wrapper.findComponent({ name: "QToggle" }).setValue(false);

    expect(sceneObject.collidable).toBe(false);
  });
});
