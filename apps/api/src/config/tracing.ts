import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Logging interno do SDK apenas em dev (evita ruido em producao)
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'zappiq-api';
const deploymentEnv = process.env.NODE_ENV ?? 'development';

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
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`
      : undefined,
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
