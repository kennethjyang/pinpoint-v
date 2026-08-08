import { defineStore } from "pinia";
import type { CoordinateSystem } from "@/features/coordinate-system";
import { ref } from "vue";

export const useCoordinateSystemLibraryStore = defineStore(
  "coordinate-system-library",
  () => {
    const library = ref<CoordinateSystem[]>([
      {
        inspectableKind: "coordinateSystem",
        id: crypto.randomUUID(),
        name: "CCF",
        chain: [
          {
            position: [
              {
                name: "ML",
                value: 0,
                fixed: false,
                bounds: null
              },
              {
                name: "DV",
                value: 0,
                fixed: false,
                bounds: null
              },
              {
                name: "AP",
                value: 0,
                fixed: false,
                bounds: null
              }
            ],
            rotation: [
              {
                name: "Pitch",
                value: 0,
                fixed: false,
                bounds: null
              },
              {
                name: "Yaw",
                value: 0,
                fixed: false,
                bounds: null
              },
              {
                name: "Roll",
                value: 0,
                fixed: false,
                bounds: null
              }
            ]
          }
        ]
      },
      {
        inspectableKind: "coordinateSystem",
        id: crypto.randomUUID(),
        name: "Sensapex uMp-4 Surface Coordinate & Depth",
        chain: [
          {
            position: [
              {
                name: "ML",
                value: 0,
                fixed: false,
                bounds: [-10, 10]
              },
              {
                name: "DV",
                value: 0,
                fixed: false,
                bounds: [-10, 10]
              },
              {
                name: "AP",
                value: 0,
                fixed: false,
                bounds: [-10, 10]
              }
            ],
            rotation: [
              {
                name: "Pitch",
                value: 0,
                fixed: false,
                bounds: [-Math.PI / 2, Math.PI / 2]
              },
              {
                name: "Yaw",
                value: 0,
                fixed: false,
                bounds: [0, 2 * Math.PI]
              },
              {
                name: "Roll",
                value: 0,
                fixed: false,
                bounds: [0, 2 * Math.PI]
              }
            ]
          },
          {
            position: [
              { name: "", value: 0, fixed: true, bounds: null },
              { name: "Depth", value: 0, fixed: false, bounds: [-10, 10] },
              { name: "", value: 0, fixed: true, bounds: null }
            ],
            rotation: [
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              }
            ]
          }
        ]
      },
      {
        inspectableKind: "coordinateSystem",
        id: crypto.randomUUID(),
        name: "NewScale MIS",
        chain: [
          {
            position: [
              { name: "", value: 0, fixed: true, bounds: null },
              { name: "", value: 0, fixed: true, bounds: null },
              { name: "", value: 0, fixed: true, bounds: null }
            ],
            rotation: [
              {
                name: "Pitch",
                value: 0,
                fixed: false,
                bounds: [0, Math.PI]
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              }
            ]
          },
          {
            position: [
              { name: "", value: 0, fixed: true, bounds: null },
              { name: "", value: 0, fixed: true, bounds: null },
              { name: "Radius", value: 20, fixed: true, bounds: null }
            ],
            rotation: [
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "Yaw",
                value: 0,
                fixed: false,
                bounds: [-Math.PI / 4, Math.PI / 4]
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              }
            ]
          },
          {
            position: [
              { name: "X", value: 0, fixed: false, bounds: [-7.5, 7.5] },
              { name: "Y", value: 0, fixed: false, bounds: [-7.5, 7.5] },
              { name: "Depth", value: 20, fixed: false, bounds: [-7.5, 7.5] }
            ],
            rotation: [
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              },
              {
                name: "",
                value: 0,
                fixed: true,
                bounds: null
              }
            ]
          }
        ]
      }
    ]);

    const state = { library };

    return { ...state };
  },
  { persist: true }
);
