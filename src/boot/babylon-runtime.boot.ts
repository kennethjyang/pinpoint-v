import { defineBoot } from "#q-app";
import {
  BabylonRuntimeKey,
  createBabylonRuntime
} from "@/services/babylon-runtime.service";
import { registerBuiltInLoaders } from "@babylonjs/loaders";

export default defineBoot(({ app }) => {
  app.provide(BabylonRuntimeKey, createBabylonRuntime());

  registerBuiltInLoaders();
});
