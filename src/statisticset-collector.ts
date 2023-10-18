import { MetricDatum, StatisticSet } from '@aws-sdk/client-cloudwatch';
import { MetricCollector } from './cloudwatch-metric-producer';

export class StatisticSetCollector implements MetricCollector {
  private statisticSet: StatisticSet = null;

  collect(value: number | number[]) {
    if (Array.isArray(value)) {
      value.forEach((v) => this.collect(v));
      return;
    }

    if (!this.statisticSet) {
      this.statisticSet = {
        Maximum: value,
        Minimum: value,
        SampleCount: 1,
        Sum: value,
      };
    } else {
      const set = this.statisticSet;
      set.Maximum = Math.max(set.Maximum, value);
      set.Minimum = Math.min(set.Minimum, value);
      set.SampleCount++;
      set.Sum += value;
    }
  }

  getMetricData(): Partial<MetricDatum>[] {
    const set = this.statisticSet;
    this.statisticSet = null;

    if (!set) {
      return [];
    }

    return [
      {
        StatisticValues: set,
      },
    ];
  }
}
