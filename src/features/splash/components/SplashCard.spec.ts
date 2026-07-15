import { describe, it, expect } from "vitest";
import SplashCard from "./SplashCard.vue";
import { mountWithQuasar } from "@/test/mount-helper";

describe("SplashCard", () => {
  it("emits 'new' when the new button is clicked", async () => {
    const wrapper = mountWithQuasar(SplashCard);

    // The first q-btn is the "new" action.
    await wrapper.findComponent({ name: "QBtn" }).trigger("click");

    expect(wrapper.emitted("new")).toHaveLength(1);
  });

  it("renders 20 recent experiment placeholder items", () => {
    const wrapper = mountWithQuasar(SplashCard);

    const items = wrapper.findAllComponents({ name: "QItem" });

    expect(items).toHaveLength(20);
  });
});
