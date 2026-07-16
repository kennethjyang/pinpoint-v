import axios from "axios";
import { ProbeInterfaceFile, ProbeInterfaceProbe } from "@/features/probe";

interface GitHubItem {
  name: string;
  type: string;
}
interface GitHub404 {
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
 * Check if a GitHub response was a 404 message.
 * @param response response data from a GitHub content fetch.
 */
function isGitHub404(response: GitHubItemResponse): response is GitHub404 {
  return !Array.isArray(response) && response.status === "404";
}

/**
 * Return the list of probe vendors.
 *
 * Computed as the top level non-scripting folders.
 */
export async function getVendors(): Promise<string[]> {
  try {
    const { data } = await githubApi.get<GitHubItemResponse>("/");

    // Exit if we can't find vendors.
    if (!data || isGitHub404(data)) return [];

    return data
      .filter(
        item =>
          item.type === "dir" &&
          !item.name.startsWith(".") &&
          !["apps", "scripts"].includes(item.name)
      )
      .map(item => item.name);
  } catch {
    return [];
  }
}

/**
 * Return the list of probes by the vendor.
 *
 * Computed as the names of directories in a vendor folder.
 *
 * @param vendor Vendor to get probes from.
 */
export async function getProbes(vendor: string): Promise<string[]> {
  try {
    const { data } = await githubApi.get<GitHubItemResponse>(`/${vendor}`);

    // Exit if we can't find any probes.
    if (!data || isGitHub404(data)) return [];

    return data.filter(item => item.type === "dir").map(item => item.name);
  } catch {
    return [];
  }
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
