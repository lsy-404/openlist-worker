declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface HeifImage {
    get_width(): number
    get_height(): number
    display(target: ImageData, done: (result: ImageData | null) => void): void
  }
  interface HeifModule {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] }
  }
  const factory: () => HeifModule
  export default factory
}

declare module "asciinema-player" {
  export function create(src: string | { data: string }, element: HTMLElement, options?: Record<string, unknown>): { dispose(): void }
}
