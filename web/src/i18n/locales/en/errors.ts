import type zh from "../zh-CN/errors"

const messages: typeof zh = {
  network: "Can't connect to the server",
  requestFailed: "Request failed",
  uploadFailed: "Upload failed",
  loadFailed: "Failed to load",
  login: {
    failed: "Sign-in failed. Continuing as guest.",
    signingIn: "Signing in",
    redirecting: "Redirecting to sign-in…",
  },
}

export default messages
