import { defineStore } from "pinia";
import { ref } from "vue";
import type { ProbeInterfaceProbe } from "@/features/probe";
import { getProbeIdentifier } from "@/features/probe";

export const useProbeLibraryStore = defineStore(
  "probe-library",
  () => {
    const library = ref<ProbeInterfaceProbe[]>([]);

    /**
     * Add a probe to the library. Does nothing if it already exists.
     * @param probe Probe to add.
     */
    function add(probe: ProbeInterfaceProbe) {
      if (
        library.value.some(
          libraryProbe =>
            getProbeIdentifier(libraryProbe) === getProbeIdentifier(probe)
        )
      )
        return;
      library.value.push(probe);
    }

    /**
     * Remove all instances of a probe from the library.
     * @param probe Probe to remove.
     */
    function remove(probe: ProbeInterfaceProbe) {
      const identifier = getProbeIdentifier(probe);
      for (let i = library.value.length - 1; i >= 0; i--) {
        if (getProbeIdentifier(library.value[i]!) === identifier) {
          library.value.splice(i, 1);
        }
      }
    }

    const state = { library };
    const actions = { add, remove };
    return { ...state, ...actions };
  },
  { persist: true }
);
