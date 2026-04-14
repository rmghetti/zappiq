import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Logging interno do SDK apenas em dev (evita ruido em producao)
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'zappiq-api';
const deploymentEnv = process.env.NODE_ENV ?? 'development';

const otlpBase = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '2.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
    'service.instance.id': process.env.FLY_MACHINE_ID ?? process.env.HOSTNAME ?? 'local',
  }),
  traceExporter: new OTLPTraceExporter({
    // OTEL_EXPORTER_OTLP_ENDPOINT eh usado automaticamente se presente,
    // mas forcamos o suffix /v1/traces para o exporter HTTP do Grafana Cloud.
    url: otlpBase ? `${otlpBase}/v1/traces` : undefined,
  }),
  // Logs via OTLP: reusa mesmo gateway e credencial dos traces.
  // Grafana Cloud roteia /v1/logs direto pro Loki, com correlacao automatica
  // por resource attributes (service.name) e trace_id/span_id injetados.
  logRecordProcessors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: otlpBase ? `${otlpBase}/v1/logs` : undefined,
      }),
    ),
  ],
  // Metrics via OTLP: http/express instrumentation gera http_server_request_duration
  // automaticamente. Export periodico a cada 30s para Prometheus via /v1/metrics.
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: otlpBase ? `${otlpBase}/v1/metrics` : undefined,
    }),
    exportIntervalMillis: 30_000,
    exportTimeoutMillis: 10_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs/dns geram ruido enorme sem valor de negocio
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
  // eslint-disable-next-line no-console
  console.log(`[OTel] SDK started. service=${serviceName} env=${deploymentEnv}`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[OTel] SDK start failed (continuing without tracing):', err);
}

const shutdown = () => {
  sdk
    .shutdown()
    // eslint-disable-next-line no-console
    .then(() => console.log('[OTel] SDK shut down'))
    // eslint-disable-next-line no-console
    .catch((err) => console.error('[OTel] SDK shutdown error:', err));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
