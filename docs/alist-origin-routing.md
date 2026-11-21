# AList node origin routing

Set `ALIST_ORIGIN_ROUTES` to a JSON array. Select an AList V3 storage by its exact mount path:

```json
[{"mountPath":"/server/home","rawOrigins":["https://download.example"],"lanes":[{"url":"https://east.example","bytesPerSecond":10000000,"key":true},{"url":"https://west.example","bytesPerSecond":5000000,"key":true}]}]
```

A group can instead use `base`, the origin of the storage's configured URL. An exact `mountPath` match takes precedence over `base`; a group with `mountPath` applies only to that mount. When routed, API requests omit the configured base URL's path prefix. Without a matching route, the configured URL is used unchanged.

`bytesPerSecond` is the estimated usable transfer rate in bytes per second. Configure all usable endpoints, including the original endpoint if it should remain eligible. Each endpoint must proxy the same node and its upload sessions, preserve paths and headers, and serve `/api/public/settings` from that node. The Worker probes this endpoint and selects the healthy route with the lowest probe time plus estimated transfer time. Health is cached per Cloudflare location for 30 seconds when healthy and 10 seconds after failure. A single transfer uses one route. Streamed uploads are never replayed; retry the upload after an error.

For downloads from the selected storage, `/d` and `/p` URLs are routed when their origin matches the configured storage URL or an exact origin in `rawOrigins`; other URLs retain their existing behavior. Configure an alias only when it serves the same node and the same paths.

For endpoints with `key: true`, set the `ALIST_ORIGIN_KEY` deployment secret to the shared ingress key. The Worker sends it as `X-OpenList-Origin-Key` to those endpoints only. Protect each private endpoint with the same key. Do not include credentials in route URLs.
