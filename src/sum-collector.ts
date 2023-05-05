import { MetricDatum } from '@aws-sdk/client-cloudwatch';
import { MetricCollector } from './cloudwatch-metric-producer';

export class SumCollector implements MetricCollector {
  private count: number | null = null;

  collect(value: number | number[]) {
    if (Array.isArray(value)) {
      value.forEach((v) => this.collect(v));
      return;
    }

    this.count = (this.count ?? 0) + value;
  }

  getMetricData(): Partial<MetricDatum>[] {
    const count = this.count;
    this.count = null;

    if (count === null) {
      return [];
    }

    return [
      {
        Value: count,
      },
    ];
  }
}
