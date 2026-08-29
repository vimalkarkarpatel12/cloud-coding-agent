// Pure TypeScript Prometheus metrics collector (zero external dependencies)

class Counter {
  public name: string;
  public help: string;
  private labelNames: string[];
  private values: Map<string, number> = new Map();

  constructor(opts: { name: string; help: string; labelNames?: string[] }) {
    this.name = opts.name;
    this.help = opts.help;
    this.labelNames = opts.labelNames || [];
  }

  inc(labels: Record<string, string> = {}, value = 1) {
    const key = JSON.stringify(labels);
    const curr = this.values.get(key) || 0;
    this.values.set(key, curr + value);
  }

  toPrometheusString(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    if (this.values.size === 0) {
      out += `${this.name} 0\n`;
    } else {
      for (const [lblJson, val] of this.values.entries()) {
        const labels = JSON.parse(lblJson);
        const lblStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        out += `${this.name}${lblStr ? `{${lblStr}}` : ""} ${val}\n`;
      }
    }
    return out;
  }
}

class Gauge {
  public name: string;
  public help: string;
  private value = 0;

  constructor(opts: { name: string; help: string }) {
    this.name = opts.name;
    this.help = opts.help;
  }

  set(val: number) {
    this.value = val;
  }

  inc(val = 1) {
    this.value += val;
  }

  dec(val = 1) {
    this.value -= val;
  }

  toPrometheusString(): string {
    return `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} gauge\n${this.name} ${this.value}\n`;
  }
}

class Histogram {
  public name: string;
  public help: string;
  private buckets: number[];
  private counts: Map<number, number> = new Map();
  private sum = 0;
  private count = 0;

  constructor(opts: { name: string; help: string; buckets?: number[] }) {
    this.name = opts.name;
    this.help = opts.help;
    this.buckets = opts.buckets || [5, 15, 30, 60, 120, 300, 600, 1800];
    for (const b of this.buckets) this.counts.set(b, 0);
  }

  observe(labels: Record<string, string>, val: number) {
    this.sum += val;
    this.count++;
    for (const b of this.buckets) {
      if (val <= b) {
        this.counts.set(b, (this.counts.get(b) || 0) + 1);
      }
    }
  }

  toPrometheusString(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    let cumulative = 0;
    for (const b of this.buckets) {
      cumulative += this.counts.get(b) || 0;
      out += `${this.name}_bucket{le="${b}"} ${cumulative}\n`;
    }
    out += `${this.name}_bucket{le="+Inf"} ${this.count}\n`;
    out += `${this.name}_sum ${this.sum}\n`;
    out += `${this.name}_count ${this.count}\n`;
    return out;
  }
}

class Registry {
  public contentType = "text/plain; version=0.0.4; charset=utf-8";
  private metricsList: (Counter | Gauge | Histogram)[] = [];

  add(metric: Counter | Gauge | Histogram) {
    this.metricsList.push(metric);
  }

  metrics = async (): Promise<string> => {
    return this.metricsList.map((m) => m.toPrometheusString()).join("\n");
  };
}

export const register = new Registry();

export const tokenCounter = new Counter({
  name: "agent_tokens_total",
  help: "Total tokens consumed by agent execution",
  labelNames: ["model", "type"],
});
register.add(tokenCounter);

export const executionTimeHistogram = new Histogram({
  name: "agent_execution_seconds",
  help: "Agent task execution duration in seconds",
  buckets: [5, 15, 30, 60, 120, 300, 600, 1800],
});
register.add(executionTimeHistogram);

export const toolCallCounter = new Counter({
  name: "agent_tool_calls_total",
  help: "Total tool calls made by agent",
  labelNames: ["tool_name", "success"],
});
register.add(toolCallCounter);

export const concurrentSandboxesGauge = new Gauge({
  name: "agent_concurrent_sandboxes",
  help: "Number of currently active agent sandboxes",
});
register.add(concurrentSandboxesGauge);

export const agentQualityCounter = new Counter({
  name: "agent_tasks_total",
  help: "Total tasks completed by agent",
  labelNames: ["status", "model"],
});
register.add(agentQualityCounter);

