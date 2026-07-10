import { defineBoot } from "#q-app";
import {
  BabylonRuntimeKey,
  createBabylonRuntime
} from "@/services/babylon-runtime.service";

export default defineBoot(({ app }) => {
  app.provide(BabylonRuntimeKey, createBabylonRuntime());
});
