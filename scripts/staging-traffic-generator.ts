import axios, { AxiosInstance } from 'axios';

interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  errors: number;
  total: number;
}

class TrafficGenerator {
  private client: AxiosInstance;
  private latencies: number[] = [];
  private errors: number = 0;
  private webhookUrl: string;
  private orgs: number;
  private messagesPerOrg: number;
  private concurrency: number;
  private duration?: number;

  constructor(config: {
    webhookUrl: string;
    orgs: number;
    messagesPerOrg: number;
    concurrency: number;
    duration?: number;
  }) {
    this.webhookUrl = config.webhookUrl;
    this.orgs = config.orgs;
    this.messagesPerOrg = config.messagesPerOrg;
    this.concurrency = config.concurrency;
    this.duration = config.duration;

    this.client = axios.create({
      timeout: 30000,
      validateStatus: () => true,
    });
  }

  private generatePayload(orgId: string): object {
    const phone = `55${Math.random().toString().slice(2, 13)}`;
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: orgId,
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5511987654321',
                  phone_number_id: '123456789',
                  business_account_id: orgId,
                },
                messages: [
                  {
                    from: phone,
                    id: `msg_${Math.random().toString(36).substring(7)}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: {
                      body: `Staging traffic test message ${Math.random()}. Qual é o horário de funcionamento?`,
                    },
                  },
                ],
                contacts: [
                  {
                    profile: {
                      name: `Test Contact ${Math.random().toString(36).substring(7)}`,
                    },
                    wa_id: phone,
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
  }

  async sendRequest(): Promise<number> {
    const orgId = `org_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();

    try {
      const response = await this.client.post(this.webhookUrl, this.generatePayload(orgId));
      const latency = Date.now() - startTime;

      if (response.status < 200 || response.status >= 300) {
        this.errors++;
      } else {
        this.latencies.push(latency);
      }

      return latency;
    } catch (error) {
      this.errors++;
      return Date.now() - startTime;
    }
  }

  private calculatePercentile(percentile: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private async runWithConcurrency(): Promise<void> {
    const totalMessages = this.orgs * this.messagesPerOrg;
    let completed = 0;
    const startTime = Date.now();

    console.log(`[TRAFFIC] Starting load test`);
    console.log(`[TRAFFIC] Config: ${this.orgs} orgs, ${this.messagesPerOrg} msg/org, ${this.concurrency} concurrent`);
    console.log(`[TRAFFIC] Webhook: ${this.webhookUrl}`);
    console.log(`[TRAFFIC] Target messages: ${totalMessages}`);
    console.log('');

    const sendBatch = async (): Promise<void> => {
      while (completed < totalMessages) {
        if (this.duration && Date.now() - startTime > this.duration * 1000) {
          break;
        }

        const latency = await this.sendRequest();
        completed++;

        if (completed % 10 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const rps = Math.round(completed / (elapsed || 1));
          process.stdout.write(`\r[TRAFFIC] Progress: ${completed}/${totalMessages} | RPS: ${rps} | Errors: ${this.errors}`);
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(sendBatch());
    }

    await Promise.all(workers);
    console.log('\n');
  }

  async run(): Promise<LatencyMetrics> {
    await this.runWithConcurrency();

    const metrics: LatencyMetrics = {
      p50: this.calculatePercentile(50),
      p95: this.calculatePercentile(95),
      p99: this.calculatePercentile(99),
      min: Math.min(...this.latencies, 0),
      max: Math.max(...this.latencies, 0),
      mean: this.latencies.length > 0 ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0,
      errors: this.errors,
      total: this.latencies.length + this.errors,
    };

    return metrics;
  }

  printResults(metrics: LatencyMetrics): void {
    console.log('='.repeat(60));
    console.log('TRAFFIC GENERATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Total requests: ${metrics.total}`);
    console.log(`Successful: ${metrics.total - metrics.errors}`);
    console.log(`Failed: ${metrics.errors}`);
    console.log('');
    console.log('Latency percentiles (ms):');
    console.log(`  P50:  ${metrics.p50.toFixed(2)}ms`);
    console.log(`  P95:  ${metrics.p95.toFixed(2)}ms`);
    console.log(`  P99:  ${metrics.p99.toFixed(2)}ms`);
    console.log(`  Min:  ${metrics.min.toFixed(2)}ms`);
    console.log(`  Max:  ${metrics.max.toFixed(2)}ms`);
    console.log(`  Mean: ${metrics.mean.toFixed(2)}ms`);
    console.log('='.repeat(60));

    if (metrics.p95 > 1000) {
      console.warn('[WARNING] P95 latency exceeds 1000ms — performance degradation detected');
    }
    if (metrics.errors > metrics.total * 0.05) {
      console.warn('[WARNING] Error rate > 5% — check webhook endpoint');
    }
  }
}

function parseArgs(): {
  orgs: number;
  messagesPerOrg: number;
  concurrency: number;
  webhookUrl: string;
  duration?: number;
} {
  const args = process.argv.slice(2);
  const config = {
    orgs: 5,
    messagesPerOrg: 20,
    concurrency: 3,
    webhookUrl: 'http://localhost:3001/api/webhook/whatsapp',
    duration: undefined as number | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--orgs') config.orgs = parseInt(args[i + 1], 10);
    if (args[i] === '--messages-per-org') config.messagesPerOrg = parseInt(args[i + 1], 10);
    if (args[i] === '--concurrency') config.concurrency = parseInt(args[i + 1], 10);
    if (args[i] === '--duration') config.duration = parseInt(args[i + 1], 10);
    if (args[i] === '--real-webhook') config.webhookUrl = args[i + 1];
  }

  return config;
}

async function main() {
  const config = parseArgs();

  const generator = new TrafficGenerator({
    webhookUrl: config.webhookUrl,
    orgs: config.orgs,
    messagesPerOrg: config.messagesPerOrg,
    concurrency: config.concurrency,
    duration: config.duration,
  });

  try {
    const metrics = await generator.run();
    generator.printResults(metrics);
  } catch (error) {
    console.error('[ERROR] Traffic generation failed:', error);
    process.exit(1);
  }
}

main();
