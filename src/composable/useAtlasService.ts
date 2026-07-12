import { inject } from "vue";
import { AtlasServiceKey } from "@/services/atlas.service";

export function useAtlasService() {
  const service = inject(AtlasServiceKey);

  if (!service) {
    throw new Error("Atlas service was not provided.");
  }

  return service;
}
