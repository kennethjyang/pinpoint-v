export default {
  atlasPicker: {
    title: "Atlas",
    brainglobeHosted: "BrainGlobe Hosted",
    customHTTPHost: "Custom HTTP Host",
    sourceUrl: "Source URL",
    search: "Search",
    atlasCount: "no atlases | one atlas | {count} atlases",
    noAtlases: "No atlases found.",
    noAtlasesCaption: "Check your connection to the source.",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites"
  },
  atlasHierarchy: {
    search: "Search",
    clear: "Clear"
  },
  currentExperiment: {
    defaultName: "My First Experiment"
  },
  newExperiment: {
    title: "New Experiment",
    experimentName: "Experiment name",
    cancel: "Cancel",
    create: "Create",
    pickNameAndAtlas: "Pick an experiment name and atlas",
    failedToFetchAtlas: "Failed to fetch atlas.",
    checkAtlas:
      "Please check your connection to the source and the atlas's existence."
  },
  splash: {
    title: "Pinpoint V",
    new: "New",
    resume: "Resume",
    open: "Open",
    userGuide: "User Guide",
    vblWebsite: "VBL Website",
    recentExperiment: "Some Recent Experiment {n}",
    deleteExperiment: "Delete Experiment",
    confirmDelete: 'Are you sure you wish to delete "{name}"?',
    delete: "Delete"
  },
  sceneCanvas: {
    problemLoadingAtlasMeshes:
      "There was a problem loading the meshes for this atlas.",
    atlasLikelyNotSupportedYet: "It's likely not fully supported yet."
  },
  installProbe: {
    title: "Install Probe",
    manufacturer: "Manufacturer",
    search: "Search",
    cancel: "Cancel",
    uploadCustom: "Upload Custom Probe",
    install: "Install",
    selectProbeHint: "Select a probe to add!",
    installFailed: "Unable to install probe.",
    installFailedCaption: "Check your connection and try again.",
    invalidProbeFile: "Unable to read probe file.",
    invalidProbeFileCaption:
      "Check that the file is a valid ProbeInterface JSON file."
  },
  experimentFile: {
    invalidExperimentFile: "Unable to read experiment file.",
    invalidExperimentFileCaption:
      "Check that the file is a Pinpoint experiment JSON file.",
    downloadFailed: "Unable to download experiment.",
    downloadFailedCaption:
      "Check your browser's download settings and try again.",
    atlasUnavailable: "Loaded the experiment, but its atlas is unavailable.",
    atlasUnavailableCaption:
      "Check your connection to the atlas source. Probes are shown without the brain."
  },
  layout: {
    file: "File",
    new: "New",
    open: "Open",
    download: "Download",
    edit: "Edit",
    preferences: "Preferences",
    probeLibrary: "Probe Library",
    view: "View",
    splashScreen: "Splash Screen",
    toggleDarkMode: "Toggle Dark Mode",
    scene: "Scene",
    channelMaps: "Channel Maps",
    atlas: "Atlas",
    help: "Help"
  },
  probeLibrary: {
    title: "Probe Library",
    installProbe: "Install Probe",
    close: "Close"
  },
  sceneHierarchy: {
    addProbe: "Add Probe",
    manageProbes: "Manage probes..."
  },
  inspector: {
    emptyHint: "Pick something from the scene to inspect."
  },
  probeInspector: {
    name: "Name",
    probeType: "Probe Type",
    tipPosition: "Tip Position",
    orientation: "Orientation",
    color: "Color",
    ap: "AP",
    dv: "DV",
    ml: "ML",
    roll: "Roll",
    yaw: "Yaw",
    pitch: "Pitch",
    nameRequired: "Name is required.",
    mustBeNumber: "Must be a number."
  },
  slice: {
    zoom: "Zoom",
    center: "Center along probe",
    extent: "{extent} mm",
    loading: "Loading annotations...",
    noAnnotations: "No annotation volume for this atlas.",
    noContour: "This probe has no contour to slice through."
  },
  errorNotFound: {
    code: "404",
    message: "Oops. Nothing here...",
    goHome: "Go Home"
  }
};
