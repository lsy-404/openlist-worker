# AList node origin routing

Set `ALIST_ORIGIN_ROUTES` to a JSON array. Each group maps the origin of an AList V3 storage's `url` to HTTPS endpoints for the same node:

```json
[{"base":"https://node.example","lanes":[{"url":"https://east.example","bytesPerSecond":10000000,"key":true},{"url":"https://west.example","bytesPerSecond":5000000,"key":true}]}]
```

`bytesPerSecond` is the estimated usable transfer rate in bytes per second. Configure all usable endpoints, including the original endpoint if it should remain eligible. Each endpoint must proxy the same node and its upload sessions, preserve paths and headers, and serve `/api/public/settings` from that node. The Worker probes this endpoint and selects the healthy route with the lowest probe time plus estimated transfer time. Health is cached per Cloudflare location for 30 seconds when healthy and 10 seconds after failure. File downloads are routed when their returned URL has the configured base origin; other URLs retain their existing behavior. A single transfer uses one route. Streamed uploads are never replayed; retry the upload after an error.

For endpoints with `key: true`, set the `ALIST_ORIGIN_KEY` deployment secret to the shared ingress key. The Worker sends it as `X-OpenList-Origin-Key` to those endpoints only. Protect each private endpoint with the same key. Do not include credentials in route URLs.
