import axios from "axios";
import { ProbeInterfaceFile, ProbeInterfaceProbe } from "@/features/probe";

interface GitHubItem {
  name: string;
  type: string;
}
interface GitHub404 {
  message: string;
  status: string;
}
type GitHubItemResponse = GitHubItem[] | GitHub404;

/**
 * Fetch URL for GitHub repository contents.
 */
const githubApi = axios.create({
  baseURL:
    "https://api.github.com/repos/SpikeInterface/probeinterface_library/contents",
  headers: {
    Accept: "application/vnd.github+json"
  }
});

/**
 * Fetch URL for the contents of a file in GitHub.
 */
const fileApi = axios.create({
  baseURL:
    "https://raw.githubusercontent.com/SpikeInterface/probeinterface_library/main"
});

/**
 * Return the list of probe vendors.
 *
 * Computed as the top level non-scripting folders.
 */
export async function getVendors(): Promise<string[]> {
  const { data } = await githubApi.get<GitHubItemResponse>("/");

  if (!data) return [];

  return data
    .filter(
      item =>
        item.type === "dir" &&
        !item.name.startsWith(".") &&
        !["app", "scripts"].includes(item.name)
    )
    .map(item => item.name);
}

/**
 * Return the list of probes by the vendor.
 *
 * Computed as the names of directories in a vendor folder.
 *
 * @param vendor Vendor to get probes from.
 */
export async function getProbes(vendor: string): Promise<string[]> {
  const { data } = await githubApi.get<GitHubItemResponse>(`/${vendor}`);

  // Exit if we can't find any probes.
  if (!data) return [];

  return data.filter(item => item.type === "dir").map(item => item.name);
}

/**
 * Return a probe's ProbeInterface specification.
 *
 * Returns null if there are problems getting the spec.
 *
 * @remarks Will currently only extract the first probe in a ProbeInterface file.
 *
 * @param vendor Vendor to get probe from.
 * @param name Probe from vendor.
 */
export async function getProbeSpecification(
  vendor: string,
  name: string
): Promise<ProbeInterfaceProbe | null> {
  const { data } = await fileApi.get<ProbeInterfaceFile>(
    `/${vendor}/${name}/${name}.json`
  );

  // Exit if we can't find the probe.
  if (!data) return null;

  // Exit if no probes exist.
  if (!data.probes[0]) return null;

  // Extract first one.
  return data.probes[0];
}
