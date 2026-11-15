export const HEIF_EXTENSIONS = new Set(["heic", "heif"])

/** Decodes a HEIC/HEIF file to a PNG blob for browsers that cannot display it natively. */
export async function decodeHeif(buffer: ArrayBuffer): Promise<Blob> {
  const { default: factory } = await import("libheif-js/libheif-wasm/libheif-bundle.mjs")
  const images = new (factory().HeifDecoder)().decode(new Uint8Array(buffer))
  const image = images[0]
  if (!image) throw new Error("no image")
  const width = image.get_width()
  const height = image.get_height()
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!
  const data = context.createImageData(width, height)
  await new Promise<void>((resolve, reject) =>
    image.display(data, (result) => (result ? resolve() : reject(new Error("decode failed")))),
  )
  context.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/png"))
}
