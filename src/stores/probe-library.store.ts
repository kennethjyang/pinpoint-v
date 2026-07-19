import { defineStore } from "pinia";
import { ProbeInterfaceProbe } from "@/features/probe";
import { ref } from "vue";

export const useProbeLibraryStore = defineStore(
  "probe-library",
  () => {
    const library = ref<ProbeInterfaceProbe[]>([]);

    /**
     * Add a probe to the library. Does nothing if it already exists.
     * @param probe Probe to add.
     */
    function add(probe: ProbeInterfaceProbe) {
      if (library.value.includes(probe)) return;
      library.value.push(probe);
    }

    /**
     * Removes all instances of a probe from the library.
     * @param probe Probe to remove.
     */
    function remove(probe: ProbeInterfaceProbe) {
      library.value.filter(libraryProbe => libraryProbe !== probe);
    }

    return { library, add, remove };
  },
  { persist: true }
);
