/**
 * @file Composable to inject the Axios instance.
 */

import { inject } from "vue";
import { AxiosKey } from "@/boot/axios.boot";

/**
 * Inject the Axios instance and return it.
 *
 * @throws Error if the injection doesn't return something.
 */
export function useAxios() {
  const axios = inject(AxiosKey);

  if (!axios) {
    throw new Error("Axios was not provided.");
  }

  return axios;
}
