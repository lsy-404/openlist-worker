// AList V3 driver — 通过 HTTP API 访问另一个 OpenList / AList 实例
// 移植自 OpenList Go 版 drivers/alist_v3。
import {
  StorageDriver,
  FileItem,
  calcFileType,
} from "../../internal/driver/base"
import { sortFileItems } from "../../internal/driver/sort"
import { AListV3Addition, AListObj, AListResp } from "./types"
import { routedOriginFetch } from "./origin"

/** Failure reported by the node's chunked upload endpoints; code is the node's envelope code. */
export class NodeUploadError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any,
  ) {
    super(message)
  }
}

export class AListV3Driver implements StorageDriver {
  private addition: AListV3Addition
  private token: string
  private onTokenUpdate?: (token: string) => void
  private originEnv?: () => any
  private mountPath?: string

  constructor(
    addition: AListV3Addition,
    onTokenUpdate?: (token: string) => void,
    originEnv?: () => any,
    mountPath?: string,
  ) {
    this.addition = addition || {}
    this.token = this.addition.token || ""
    this.mountPath = mountPath
    this.originEnv = originEnv
    this.onTokenUpdate = onTokenUpdate
  }

  private get baseUrl(): string {
    return (this.addition.url || "").replace(/\/+$/, "")
  }

  private originFetch(url: string, init: RequestInit, size = 0, retry = false, prepare?: () => void): Promise<Response> {
    return routedOriginFetch(url, init, this.originEnv?.(), size, retry, prepare, {
      baseUrl: this.baseUrl, mountPath: this.mountPath, kind: "api",
    })
  }

  async init(): Promise<void> {
    if (!this.baseUrl) {
      throw new Error("[AListV3] url is required")
    }
    // 验证 token；username 不匹配时重新登录
    try {
      const me = await this.request<{ username: string }>("/me", "GET")
      if (this.addition.username && me.username !== this.addition.username) {
        await this.login()
      }
    } catch {
      if (this.addition.username) {
        await this.login()
      }
    }
  }

  private async login(): Promise<void> {
    if (!this.addition.username) return
    const data = await this.request<{ token: string }>(
      "/auth/login",
      "POST",
      {
        username: this.addition.username,
        password: this.addition.password,
      },
      false,
    )
    this.token = data.token
    if (this.onTokenUpdate) {
      try {
        await this.onTokenUpdate(this.token)
      } catch {}
    }
  }

  private async request<T>(
    api: string,
    method: string,
    body?: any,
    retry = true,
  ): Promise<T> {
    const res = await this.originFetch(`${this.baseUrl}/api${api}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: this.token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }, 0, api === "/me" || api === "/fs/list" || api === "/fs/get")
    const data: AListResp<T> = await res.json().catch(() => ({
      code: res.status,
      message: "invalid response",
      data: null,
    }))
    if (data.code !== 200) {
      if ((data.code === 401 || data.code === 403) && retry) {
        await this.login()
        return this.request<T>(api, method, body, false)
      }
      throw new Error(
        `[AListV3] request failed: code=${data.code}, message=${data.message}`,
      )
    }
    return data.data as T
  }

  private toFileItem(obj: AListObj): FileItem {
    return {
      name: obj.name,
      size: obj.size || 0,
      is_dir: !!obj.is_dir,
      modified: obj.modified || new Date().toISOString(),
      sign: obj.sign || "",
      thumb: obj.thumb || "",
      type: obj.type ?? calcFileType(obj.name, !!obj.is_dir),
      raw_url: "",
    }
  }

  async list(_v: string, physicalPath: string): Promise<FileItem[]> {
    const data = await this.request<{ content: AListObj[] }>(
      "/fs/list",
      "POST",
      {
        path: physicalPath,
        password: this.addition.meta_password || "",
        page: 1,
        per_page: 0,
        refresh: false,
      },
    )
    const items = (data.content || []).map((f) => this.toFileItem(f))
    return sortFileItems(items, "name", "asc")
  }

  async get(_v: string, physicalPath: string): Promise<FileItem> {
    const data = await this.request<AListObj & { raw_url: string }>(
      "/fs/get",
      "POST",
      {
        path: physicalPath,
        password: this.addition.meta_password || "",
      },
    )
    return {
      ...this.toFileItem(data),
      raw_url: data.raw_url || "",
    }
  }

  async mkdir(_v: string, physicalPath: string): Promise<void> {
    await this.request("/fs/mkdir", "POST", { path: physicalPath })
  }

  async rename(
    _v: string,
    physicalPath: string,
    newName: string,
  ): Promise<void> {
    await this.request("/fs/rename", "POST", {
      path: physicalPath,
      name: newName,
    })
  }

  async remove(
    _v: string,
    physicalPath: string,
    names: string[],
  ): Promise<void> {
    const parent = physicalPath.split("/").slice(0, -1).join("/") || "/"
    await this.request("/fs/remove", "POST", { dir: parent, names })
  }

  async move(
    _srcDir: string,
    _dstDir: string,
    names: string[],
    srcPhys: string,
    dstPhys: string,
  ): Promise<void> {
    const srcParent = srcPhys.split("/").slice(0, -1).join("/") || "/"
    const dstParent = dstPhys.split("/").slice(0, -1).join("/") || "/"
    await this.request("/fs/move", "POST", {
      src_dir: srcParent,
      dst_dir: dstParent,
      names,
    })
  }

  async copy(
    _srcDir: string,
    _dstDir: string,
    names: string[],
    srcPhys: string,
    dstPhys: string,
  ): Promise<void> {
    const srcParent = srcPhys.split("/").slice(0, -1).join("/") || "/"
    const dstParent = dstPhys.split("/").slice(0, -1).join("/") || "/"
    await this.request("/fs/copy", "POST", {
      src_dir: srcParent,
      dst_dir: dstParent,
      names,
    })
  }

  /** Node identity used to detect when two mounts can copy server-side on the same remote server. */
  get nodeKey(): string {
    return `${this.baseUrl}|${this.addition.username || ""}`
  }

  /** Server-side copy between directories of this node, replacing existing targets. */
  async serverCopy(srcDir: string, dstDir: string, names: string[]): Promise<void> {
    await this.request("/fs/copy", "POST", {
      src_dir: srcDir,
      dst_dir: dstDir,
      names,
      overwrite: true,
    })
  }

  /**
   * Streams an upload of known size; the body is piped through a FixedLengthStream so the
   * node receives a Content-Length instead of a chunked body.
   */
  async putStream(
    physicalPath: string,
    body: ReadableStream,
    size: number,
    modified?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { readable, writable } = new (globalThis as any).FixedLengthStream(size)
    let piping: Promise<void> | undefined
    const mtime = modified ? Date.parse(modified) : NaN
    const res = await this.originFetch(`${this.baseUrl}/api/fs/put`, {
      method: "PUT",
      headers: {
        Authorization: this.token,
        "File-Path": encodeURIComponent(physicalPath),
        "Content-Type": "application/octet-stream",
        "X-File-Size": String(size),
        ...(Number.isFinite(mtime) ? { "Last-Modified": String(mtime) } : {}),
      },
      body: readable,
      signal,
    }, size, false, () => {
      piping = body.pipeTo(writable, { signal }).catch(() => {})
    })
    await piping
    const data: AListResp<any> = await res.json().catch(() => ({
      code: res.status,
      message: "invalid response",
      data: null,
    }))
    if (data.code === 401 || data.code === 403) {
      await this.login()
      throw new Error(`[AListV3] put rejected (code=${data.code}); token refreshed, retry`)
    }
    if (data.code !== 200) {
      throw new Error(
        `[AListV3] put failed: code=${data.code}, message=${data.message}`,
      )
    }
  }

  /** Calls a node endpoint with the node token, re-logging in once on an auth failure. */
  private async nodeCall(
    method: "GET" | "POST" | "PUT",
    api: string,
    headers: Record<string, string>,
    body?: ReadableStream | null,
    size?: number,
    signal?: AbortSignal,
    retry = true,
  ): Promise<{ status: number; envelope: AListResp<any> }> {
    let payload: BodyInit | undefined
    let piping: Promise<unknown> | undefined
    let writableStream: WritableStream | undefined
    if (body) {
      const { readable, writable } = new (globalThis as any).FixedLengthStream(size)
      payload = readable
      writableStream = writable
    }
    const res = await this.originFetch(`${this.baseUrl}/api${api}`, {
      method,
      headers: { ...(this.token ? { Authorization: this.token } : {}), ...headers },
      body: payload,
      signal,
    }, size || 0, method === "GET", body ? () => {
      piping = body.pipeTo(writableStream!, { signal }).catch(() => {})
    } : undefined)
    await piping
    const envelope: AListResp<any> = await res.json().catch(() => ({
      code: res.status,
      message: res.statusText || "invalid response",
      data: null,
    }))
    if (envelope.code === 401) {
      await this.login()
      // a consumed body cannot be replayed, so the caller retries the chunk with the fresh token
      if (retry && !body) return this.nodeCall(method, api, headers, body, size, signal, false)
    }
    return { status: res.status, envelope }
  }

  /** Starts a chunked upload session on the node; resolves to null when the node has no chunked upload. */
  async multipartInit(
    physicalPath: string,
    size: number,
    chunkSize: number,
    extra: Record<string, string> = {},
  ): Promise<any | null> {
    const { status, envelope } = await this.nodeCall("POST", "/fs/multipart/init", {
      "File-Path": encodeURIComponent(physicalPath),
      "X-File-Size": String(size),
      "X-Chunk-Size": String(chunkSize),
      ...extra,
    })
    if (envelope.code === 200) return envelope.data
    // 403/404/405: old node without the endpoint, or the feature switched off
    if (status === 404 || status === 405 || envelope.code === 404 || envelope.code === 405 || envelope.code === 403) {
      return null
    }
    throw new NodeUploadError(envelope.code, envelope.message, envelope.data)
  }

  async multipartChunk(
    uploadId: string,
    index: number,
    body: ReadableStream,
    size: number,
    signal?: AbortSignal,
  ): Promise<any> {
    const { envelope } = await this.nodeCall(
      "PUT",
      "/fs/multipart/chunk",
      {
        "X-Upload-Id": uploadId,
        "X-Chunk-Index": String(index),
        "Content-Type": "application/octet-stream",
      },
      body,
      size,
      signal,
    )
    if (envelope.code !== 200) throw new NodeUploadError(envelope.code, envelope.message, envelope.data)
    return envelope.data
  }

  async multipartComplete(uploadId: string, signal?: AbortSignal): Promise<any> {
    const { envelope } = await this.nodeCall("POST", "/fs/multipart/complete", { "X-Upload-Id": uploadId }, null, undefined, signal)
    if (envelope.code !== 200) throw new NodeUploadError(envelope.code, envelope.message, envelope.data)
    return envelope.data
  }

  async multipartStatus(uploadId: string): Promise<any> {
    const { envelope } = await this.nodeCall("GET", `/fs/multipart/status?upload_id=${encodeURIComponent(uploadId)}`, {})
    if (envelope.code !== 200) throw new NodeUploadError(envelope.code, envelope.message, envelope.data)
    return envelope.data
  }

  async multipartAbort(uploadId: string): Promise<void> {
    const { envelope } = await this.nodeCall("POST", "/fs/multipart/abort", { "X-Upload-Id": uploadId })
    if (envelope.code !== 200 && envelope.code !== 404) {
      throw new NodeUploadError(envelope.code, envelope.message, envelope.data)
    }
  }

  /** Direct-upload target reported by the node for its own storage; null when the storage has none. */
  async getDirectUploadInfo(physicalDir: string, fileName: string, fileSize: number): Promise<any | null> {
    const res = await this.originFetch(`${this.baseUrl}/api/fs/get_direct_upload_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: this.token } : {}) },
      body: JSON.stringify({ path: physicalDir, file_name: fileName, file_size: fileSize, tool: "" }),
    })
    const data: AListResp<any> = await res.json().catch(() => ({ code: res.status, message: "", data: null }))
    return data.code === 200 ? data.data ?? null : null
  }

  async put(_v: string, physicalPath: string, content: Uint8Array): Promise<void> {
    const res = await this.originFetch(`${this.baseUrl}/api/fs/put`, {
      method: "PUT",
      headers: {
        Authorization: this.token,
        "File-Path": encodeURIComponent(physicalPath),
        "Content-Type": "application/octet-stream",
      },
      body: content as any,
    }, content.byteLength)
    const data: AListResp<any> = await res.json().catch(() => ({
      code: res.status,
      message: "invalid response",
      data: null,
    }))
    if (data.code !== 200) {
      throw new Error(
        `[AListV3] put failed: code=${data.code}, message=${data.message}`,
      )
    }
  }
}
