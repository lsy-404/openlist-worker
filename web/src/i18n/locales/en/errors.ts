import type zh from "../zh-CN/errors"

const messages: typeof zh = {
  network: "Can't connect to the server",
  requestFailed: "Request failed",
  uploadFailed: "Upload failed",
  uploadTooLarge: "The file exceeds the single-request upload limit and this storage does not support chunked upload",
  uploadStalled: "The storage can't keep up; upload stopped",
  loadFailed: "Failed to load",
  login: {
    failed: "Sign-in failed. Continuing as guest.",
    signingIn: "Signing in",
    redirecting: "Redirecting to sign-in…",
  },
}

export default messages
