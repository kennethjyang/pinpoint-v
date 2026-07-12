import { defineBoot } from "#q-app";
import { AtlasServiceKey, createAtlasService } from "@/services/atlas.service";

export default defineBoot(({ app }) => {
  app.provide(AtlasServiceKey, createAtlasService());
});
