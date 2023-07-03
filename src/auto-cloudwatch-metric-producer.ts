import { Injectable, Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CloudWatchMetricOptions, CloudWatchMetricProducer } from './cloudwatch-metric-producer';
import { Dimension } from '@aws-sdk/client-cloudwatch';

export type AutoCloudWatchMetricProducerOptions<T = unknown> = {
  eventName: string;
  collect(event: T, add: (value: number | number[], additionalDimensions?: Dimension[]) => void): void;
  metric: Omit<CloudWatchMetricOptions, 'collectionId' | 'metricName'> &
    Required<Pick<CloudWatchMetricOptions, 'metricName'>>;
  maxBatchIntervalMs?: number;
};

@Injectable()
export class AutoCloudWatchMetricProducer<T> {
  constructor(
    private readonly options: AutoCloudWatchMetricProducerOptions<T>,
    private readonly producer: CloudWatchMetricProducer,
    eventEmitter: EventEmitter2,
  ) {
    producer.addMetric({
      collectionId: AutoCloudWatchMetricProducer.getServiceName(options.eventName, options.metric.metricName),
      ...options.metric,
    });

    eventEmitter.on(this.options.eventName, (event: T) => this.add(event));
  }

  public static getServiceName(eventName: string, metricName: string): string {
    return `${AutoCloudWatchMetricProducer.name}:${eventName}:${metricName}`;
  }

  public static register<T>(options: AutoCloudWatchMetricProducerOptions<T>): Provider {
    return {
      provide: AutoCloudWatchMetricProducer.getServiceName(options.eventName, options.metric.metricName),
      useFactory: (producer, eventEmitter) => new AutoCloudWatchMetricProducer(options, producer, eventEmitter),
      inject: [CloudWatchMetricProducer, EventEmitter2],
    };
  }

  add(event: T) {
    this.options.collect(event, (value, additionalDimensions) =>
      this.producer.add(
        AutoCloudWatchMetricProducer.getServiceName(this.options.eventName, this.options.metric.metricName),
        value,
        additionalDimensions,
      ),
    );
  }
}
