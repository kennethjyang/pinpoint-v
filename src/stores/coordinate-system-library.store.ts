import { defineStore } from "pinia";
import type { CoordinateSystem } from "@/features/coordinate-system";
import {
  buildCoordinateSystem,
  buildCoordinateSystemNode,
  buildCoordinateSystemValue,
  buildFixedCoordinateSystemValue
} from "@/features/coordinate-system";
import { ref } from "vue";

export const useCoordinateSystemLibraryStore = defineStore(
  "coordinate-system-library",
  () => {
    const library = ref<CoordinateSystem[]>([
      buildCoordinateSystem("CCF", [
        buildCoordinateSystemNode(
          [
            buildCoordinateSystemValue("ML"),
            buildCoordinateSystemValue("DV"),
            buildCoordinateSystemValue("AP")
          ],
          [
            buildCoordinateSystemValue("Pitch"),
            buildCoordinateSystemValue("Yaw"),
            buildCoordinateSystemValue("Roll")
          ]
        )
      ]),
      buildCoordinateSystem("Sensapex uMp-4 Surface Coordinate & Depth", [
        buildCoordinateSystemNode(
          [
            buildCoordinateSystemValue("ML", [-10, 10]),
            buildCoordinateSystemValue("DV", [-10, 10]),
            buildCoordinateSystemValue("AP", [-10, 10])
          ],
          [
            buildCoordinateSystemValue("Pitch", [-Math.PI / 2, Math.PI / 2]),
            buildCoordinateSystemValue("Yaw", [0, 2 * Math.PI]),
            buildCoordinateSystemValue("Roll", [0, 2 * Math.PI])
          ]
        ),
        buildCoordinateSystemNode(
          [
            buildFixedCoordinateSystemValue(),
            buildCoordinateSystemValue("Depth", [-10, 10]),
            buildFixedCoordinateSystemValue()
          ],
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ]
        )
      ]),
      buildCoordinateSystem("NewScale MIS", [
        buildCoordinateSystemNode(
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ],
          [
            buildCoordinateSystemValue("Pitch", [0, Math.PI]),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ]
        ),
        buildCoordinateSystemNode(
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue("Radius", 20)
          ],
          [
            buildFixedCoordinateSystemValue(),
            buildCoordinateSystemValue("Yaw", [-Math.PI / 4, Math.PI / 4]),
            buildFixedCoordinateSystemValue()
          ]
        ),
        buildCoordinateSystemNode(
          [
            buildCoordinateSystemValue("X", [-7.5, 7.5]),
            buildCoordinateSystemValue("Y", [-7.5, 7.5]),
            buildCoordinateSystemValue("Depth", [-7.5, 7.5], 20)
          ],
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ]
        )
      ])
    ]);

    /**
     * Remove a coordinate system from the library by id.
     * @param coordinateSystem Coordinate system to remove.
     */
    function remove(coordinateSystem: CoordinateSystem) {
      const index = library.value.findIndex(
        ({ id }) => id === coordinateSystem.id
      );
      if (index === -1) return;
      library.value.splice(index, 1);
    }

    const state = { library };
    const actions = { remove };
    return { ...state, ...actions };
  },
  { persist: true }
);
