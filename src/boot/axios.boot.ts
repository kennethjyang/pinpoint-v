/**
 * @file Provide Axios through the Quasar API.
 */

import { defineBoot } from "#q-app";
import { InjectionKey } from "vue";
import axios, { AxiosInstance } from "axios";

const instance = axios.create();

export const AxiosKey: InjectionKey<AxiosInstance> = Symbol("Axios");

export default defineBoot(({ app }) => {
  app.provide(AxiosKey, instance);
});
