import { defineBoot } from "#q-app";
import {
  BabylonRuntimeServiceKey,
  createBabylonRuntimeService
} from "@/services/babylon-runtime.service";
import { registerBuiltInLoaders } from "@babylonjs/loaders";

export default defineBoot(({ app }) => {
  app.provide(BabylonRuntimeServiceKey, createBabylonRuntimeService());

  registerBuiltInLoaders();
});
