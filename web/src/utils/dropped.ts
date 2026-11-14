import type { UploadSelection } from "@/stores/uploads"

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  // readEntries returns at most ~100 entries per call and an empty batch at the end
  for (;;) {
    const batch = await readEntries(reader)
    if (!batch.length) return all
    all.push(...batch)
  }
}

async function walk(entry: FileSystemEntry, prefix: string, out: UploadSelection): Promise<void> {
  const rel = prefix + entry.name
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    out.files.push({ file, relPath: rel })
    return
  }
  const children = await readAll((entry as FileSystemDirectoryEntry).createReader())
  if (!children.length) out.dirs.push(rel)
  for (const child of children) await walk(child, rel + "/", out)
}

/** Files and folders from a drop; must be called synchronously in the drop handler before any await. */
export function collectDropped(data: DataTransfer): Promise<UploadSelection> {
  const out: UploadSelection = { files: [], dirs: [] }
  const entries: FileSystemEntry[] = []
  const loose: File[] = []
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const file = item.getAsFile()
      if (file) loose.push(file)
    }
  }
  for (const file of loose) out.files.push({ file, relPath: file.name })
  return Promise.all(entries.map((entry) => walk(entry, "", out))).then(() => out)
}

/** Selection from a file input; folder pickers report each file's path below the chosen folder. */
export function collectInput(files: FileList): UploadSelection {
  return {
    files: Array.from(files).map((file) => ({ file, relPath: file.webkitRelativePath || file.name })),
    dirs: [],
  }
}

export function hasFiles(data: DataTransfer | null): boolean {
  return !!data && Array.from(data.types).includes("Files")
}
