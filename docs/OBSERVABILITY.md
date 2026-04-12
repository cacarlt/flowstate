# Observability Setup

The app exposes Prometheus metrics at `GET /metrics`. This doc covers how to hook it into your existing Prometheus + Grafana stack.

## Metrics Endpoint

```
http://<app-host>:3001/metrics
```

Returns standard Prometheus text format with these custom metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `todo_app_http_requests_total` | Counter | method, route, status_code | Total HTTP requests |
| `todo_app_http_request_duration_seconds` | Histogram | method, route, status_code | Request latency |
| `todo_app_http_active_requests` | Gauge | — | In-flight requests |
| `todo_app_ado_sync_total` | Counter | status | ADO sync operations |
| `todo_app_github_sync_total` | Counter | status | GitHub sync operations |
| `todo_app_db_size_bytes` | Gauge | — | SQLite DB file size |
| `todo_app_projects_total` | Gauge | — | Number of projects |
| `todo_app_todos_total` | Gauge | status | Todos by status |

Plus `prom-client` default Node.js metrics (prefixed `todo_app_`): CPU, memory, heap, event loop lag, GC, etc.

## Prometheus Config

Add a scrape target to your existing `prometheus.yml`:

### Docker Compose (same network)

```yaml
scrape_configs:
  - job_name: 'flowstate'
    static_configs:
      - targets: ['<container-name-or-ip>:3001']
```

If the app runs in the same Docker network as Prometheus, use the container/service name:
```yaml
      - targets: ['flowstate-app:3001']  # or whatever your container is named
```

### Kubernetes (ServiceMonitor)

If your Prometheus is deployed via kube-prometheus-stack, create a `ServiceMonitor`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: flowstate
  namespace: monitoring          # or wherever your Prometheus operator watches
  labels:
    release: kube-prometheus-stack  # must match your Prometheus operator's serviceMonitorSelector
spec:
  namespaceSelector:
    matchNames:
      - flowstate                # namespace where the app runs
  selector:
    matchLabels:
      app: flowstate
  endpoints:
    - port: http                 # must match the port name in your Service
      path: /metrics
      interval: 15s
```

And make sure your `Service` has a named port:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: flowstate
  namespace: flowstate
  labels:
    app: flowstate
spec:
  ports:
    - name: http                 # ServiceMonitor references this name
      port: 3001
      targetPort: 3001
```

### Homelab (different network from Prometheus)

If Prometheus runs on a different host/VM than the app:

```yaml
scrape_configs:
  - job_name: 'flowstate'
    static_configs:
      - targets: ['<app-host-ip>:3001']
        labels:
          environment: 'homelab'   # useful for distinguishing in Grafana
```

For the work laptop instance, add a separate target:
```yaml
  - job_name: 'flowstate-office'
    static_configs:
      - targets: ['<work-laptop-ip>:3001']
        labels:
          environment: 'work'
```

If both instances are scraped by the same Prometheus, the `environment` label lets you filter in Grafana.

## Grafana Dashboard

Import `grafana/dashboard.json` into your Grafana:

1. **Grafana UI** → Dashboards → Import → Upload JSON file → select `grafana/dashboard.json`
2. Select your Prometheus datasource when prompted
3. Done

The dashboard includes:
- Request rate and latency (p50/p95)
- Error rate (5xx) with threshold coloring
- Active requests, project count, todos by status
- ADO and GitHub sync counts
- DB size
- Node.js memory (RSS + heap) and event loop lag

### Multi-environment filtering

If you scrape both work and homelab instances, add a Grafana template variable:

1. Dashboard Settings → Variables → New
2. Name: `environment`, Type: Query
3. Query: `label_values(todo_app_http_requests_total, environment)`
4. Then update each panel's queries to include: `{environment="$environment"}`

This lets you toggle between Work and Personal views in a single dashboard.
