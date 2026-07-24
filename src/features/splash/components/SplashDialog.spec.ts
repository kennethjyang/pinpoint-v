import { describe, expect, it, vi, afterEach } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import SplashDialog from "./SplashDialog.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { NewExperimentDialog } from "@/features/experiment";

type DialogWrapper = VueWrapper<
  InstanceType<typeof SplashDialog> & { show(): void }
>;

// Dialog content is teleported to `document.body` rather than into
// `wrapper.element`'s subtree, so each mounted dialog must be unmounted after
// its test or a later test's `document.body.querySelector` could pick up a
// leftover teleported node from a previous test.
const mountedWrappers: DialogWrapper[] = [];

// The dialog plugin only renders its content once `show()` (exposed by
// useDialogPluginComponent) is called, and needs to be attached to the DOM
// for its teleported content to be queryable.
async function mountDialog(): Promise<DialogWrapper> {
  const wrapper = mountWithQuasar(SplashDialog, {
    attachTo: document.body
  }) as DialogWrapper;
  mountedWrappers.push(wrapper);
  wrapper.vm.show();
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe("SplashDialog", () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount());
  });

  it("opens the new-experiment dialog when the new button is clicked", async () => {
    const wrapper = await mountDialog();
    // The `Dialog` Quasar plugin isn't registered by `mountWithQuasar`
    // (only `Notify` is), so `$q.dialog` doesn't exist to spy on yet;
    // stub it directly instead.
    const dialogSpy = vi.fn();
    wrapper.vm.$q.dialog = dialogSpy;

    // The first q-btn is the "new" action.
    await wrapper.findComponent({ name: "QBtn" }).trigger("click");

    expect(dialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ component: NewExperimentDialog })
    );
  });

  it("renders 20 recent experiment placeholder items", async () => {
    const wrapper = await mountDialog();

    const items = wrapper.findAllComponents({ name: "QItem" });

    expect(items).toHaveLength(20);
  });
});
