import { describe, expect, it } from "vitest";
import SplashDialog from "./SplashDialog.vue";
import { mountWithQuasar } from "@/test/mount-helper";

describe("SplashCard", () => {
  it("emits 'new' when the new button is clicked", async () => {
    const wrapper = mountWithQuasar(SplashDialog);

    // The first q-btn is the "new" action.
    await wrapper.findComponent({ name: "QBtn" }).trigger("click");

    expect(wrapper.emitted("new")).toHaveLength(1);
  });

  it("renders 20 recent experiment placeholder items", () => {
    const wrapper = mountWithQuasar(SplashDialog);

    const items = wrapper.findAllComponents({ name: "QItem" });

    expect(items).toHaveLength(20);
  });
});
