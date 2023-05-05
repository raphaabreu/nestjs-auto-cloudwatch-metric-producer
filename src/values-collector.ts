import { MetricDatum } from '@aws-sdk/client-cloudwatch';
import { MetricCollector } from './cloudwatch-metric-producer';

export class ValuesCollector implements MetricCollector {
  private data: { [key: string]: number } = {};

  collect(value: number | number[]) {
    if (Array.isArray(value)) {
      value.forEach((v) => this.collect(v));
      return;
    }

    const key = value.toFixed(3);
    this.data[key] = (this.data[key] ?? 0) + 1;
  }

  getMetricData(): Partial<MetricDatum>[] {
    const data = this.data;
    this.data = {};

    const values = [...Object.keys(data)];
    const counts = [...Object.values(data)];

    const response: Partial<MetricDatum>[] = [];

    while (values.length > 0) {
      const valuePart = values.splice(0, 150);
      const countPart = counts.splice(0, 150);

      response.push({
        Values: valuePart.map((v) => parseFloat(v)),
        Counts: countPart,
      });
    }

    return response;
  }
}
