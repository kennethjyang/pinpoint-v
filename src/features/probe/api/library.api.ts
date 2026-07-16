import axios from "axios";

const githubApi = axios.create({
  baseURL: `https://api.github.com/repos/SpikeInterface/probeinterface_library/contents`,
  headers: {
    Accept: 'application/vnd.github+json',
  },
})