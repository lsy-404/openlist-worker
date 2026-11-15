import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

// Fonts, character maps, colour profiles and decoders are copied to /pdfjs by the build
const ASSETS = "/pdfjs/"

export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

export const documentOptions = {
  cMapUrl: `${ASSETS}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${ASSETS}standard_fonts/`,
  wasmUrl: `${ASSETS}wasm/`,
  iccUrl: `${ASSETS}iccs/`,
}
