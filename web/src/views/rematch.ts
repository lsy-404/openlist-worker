import { api } from "@/api"
import { basePath, session } from "@/stores/session"
import { normalizePath } from "@/utils/path"

function stripPrefix(path: string, prefix: string): string | null {
  if (prefix === "/") return null
  if (path === prefix) return "/"
  return path.startsWith(prefix + "/") ? path.slice(prefix.length) : null
}

// A link copied by someone with a different root is off by that root: retry without ours, then under the guest root
export function rematchCandidates(path: string, userBase: string, guestBase: string): string[] {
  const candidates: string[] = []
  const own = stripPrefix(path, normalizePath(userBase))
  if (own) candidates.push(own)
  const guest = normalizePath(guestBase)
  if (guest !== "/" && guest !== normalizePath(userBase) && stripPrefix(path, guest) === null) {
    candidates.push(normalizePath(guest + path))
    if (own) candidates.push(normalizePath(guest + own))
  }
  return [...new Set(candidates)].filter((candidate) => candidate !== path)
}

export async function findRematch(path: string, signal: AbortSignal): Promise<string | null> {
  const guestBase = String(session.settings?.guest_base_path || "/")
  for (const candidate of rematchCandidates(path, basePath.value, guestBase)) {
    try {
      await api.fsGet(candidate, "", { signal })
      return candidate
    } catch {
      if (signal.aborted) return null
    }
  }
  return null
}
