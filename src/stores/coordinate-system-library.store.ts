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
      buildCoordinateSystem(
        "Default",
        [
          buildCoordinateSystemNode(
            "Tip",
            [
              buildCoordinateSystemValue("ML"),
              buildCoordinateSystemValue("DV"),
              buildCoordinateSystemValue("AP")
            ],
            [
              buildCoordinateSystemValue("Pitch"),
              buildCoordinateSystemValue("Yaw"),
              buildCoordinateSystemValue("Roll")
            ],
            [0, 1, 2],
            [0, 1, 2],
            true
          )
        ],
        true
      ),
      buildCoordinateSystem("Surface Coordinate & Depth", [
        buildCoordinateSystemNode(
          "Surface Coordinate",
          [
            buildCoordinateSystemValue("ML"),
            buildCoordinateSystemValue("DV"),
            buildCoordinateSystemValue("AP")
          ],
          [
            buildCoordinateSystemValue("Pitch", [0, Math.PI / 2]),
            buildCoordinateSystemValue("Yaw", [0, 2 * Math.PI]),
            buildCoordinateSystemValue("Roll", [0, 2 * Math.PI])
          ],
          [0, 1, 2],
          [0, 1, 2],
          true
        ),
        buildCoordinateSystemNode(
          "Depth",
          [
            buildFixedCoordinateSystemValue(),
            buildCoordinateSystemValue("Depth"),
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
          "Arc",
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ],
          [
            buildCoordinateSystemValue("Arc Angle", [0, Math.PI]),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ]
        ),
        buildCoordinateSystemNode(
          "Module",
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue("Radius", 20)
          ],
          [
            buildFixedCoordinateSystemValue(),
            buildCoordinateSystemValue("Module Angle", [
              -Math.PI / 4,
              Math.PI / 4
            ]),
            buildFixedCoordinateSystemValue()
          ]
        ),
        buildCoordinateSystemNode(
          "Stage",
          [
            buildCoordinateSystemValue("X"),
            buildCoordinateSystemValue("Y"),
            buildCoordinateSystemValue("Z")
          ],
          [
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue(),
            buildFixedCoordinateSystemValue()
          ],
          [0, 1, 2],
          [0, 1, 2],
          true
        ),
        buildCoordinateSystemNode(
          "Depth",
          [
            buildFixedCoordinateSystemValue(),
            buildCoordinateSystemValue("Depth"),
            buildFixedCoordinateSystemValue()
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

    /**
     * Move a coordinate system within the library. Index 0 is the default system and is
     * pinned: it can be neither moved nor displaced.
     * @param fromIndex Index of the coordinate system to move.
     * @param toIndex Index to move it to.
     */
    function reorder(fromIndex: number, toIndex: number) {
      if (
        fromIndex === toIndex ||
        fromIndex < 1 ||
        toIndex < 1 ||
        fromIndex >= library.value.length ||
        toIndex >= library.value.length
      ) {
        return;
      }
      const [coordinateSystem] = library.value.splice(fromIndex, 1);
      library.value.splice(toIndex, 0, coordinateSystem!);
    }

    const state = { library };
    const actions = { remove, reorder };
    return { ...state, ...actions };
  },
  { persist: true }
);
