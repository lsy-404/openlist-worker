import type zh from "../zh-CN/preview"

const messages: typeof zh = {
  audio: {
    errorTitle: "Can't play this audio",
    errorDetail: "Your browser can't play this audio format, or the file failed to load.",
  },
  fallback: "Preview isn't available for this type of file",
  image: {
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fit: "Fit to window",
    original: "View original",
    errorTitle: "The image failed to load",
    errorDetail: "The file may be damaged, or your browser doesn't support this image format.",
    loading: "Loading…",
  },
  pdf: {
    title: "PDF document",
    detail: "This site doesn't allow embedding documents in the page. Open it in a new tab with your browser's built-in PDF viewer.",
    open: "Open in new tab",
  },
  notice: {
    download: "Download file",
  },
  siblings: {
    prev: "Previous",
    next: "Next",
  },
  text: {
    modeLabel: "Display mode",
    rendered: "Preview",
    source: "Source",
    reading: "Reading file…",
    largeTitle: "Large file, not loaded automatically",
    largeDetail: "The file is {size}. Loading it directly may be slow.",
    loadAnyway: "Load anyway",
    errorTitle: "Can't display the file",
    wrap: "Word wrap",
    serverStatus: "The server returned {status}",
    blocked: "Couldn't read the file. The download address may be cross-origin or blocked by the site's security policy.",
  },
  video: {
    errorTitle: "Can't play this video",
    unsupported: "Your browser can't play this video's container or codec. Download it to watch in a local player.",
    network: "Network error. The video failed to load.",
    generic: "The video can't be played.",
  },
}

export default messages
