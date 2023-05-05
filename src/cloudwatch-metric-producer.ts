import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  CloudWatchClient,
  Dimension,
  MetricDatum,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { OnEvent } from '@nestjs/event-emitter';
import { StructuredLogger } from '@raphaabreu/nestjs-opensearch-structured-logger';
import { ValuesCollector } from './values-collector';
import { SumCollector } from './sum-collector';
import { StatisticSetCollector } from './statisticset-collector';
import { PromiseCollector } from '@raphaabreu/promise-collector';

export interface CloudWatchMetricProducerOptions {
  maxBatchIntervalMs?: number;
  client?: CloudWatchClient;
  metrics?: (string | CloudWatchMetricOptions)[];
  defaults?: Omit<CloudWatchMetricOptions, 'metricName'>;
}

export interface CloudWatchMetricOptions {
  collectionId?: string;
  metricName?: string;
  dimensions?: Dimension[];
  namespace?: string;
  collectionMode?: 'statisticSet' | 'distinctValues' | 'sum';
  unit?: StandardUnit | string;
  storageResolution?: number;
}

export interface MetricCollector {
  collect(value: number | number[]): void;
  getMetricData(): Partial<MetricDatum>[];
}

@Injectable()
export class CloudWatchMetricProducer implements OnModuleInit, OnModuleDestroy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timer: any;
  private client: CloudWatchClient;
  private readonly maxBatchIntervalMs: number;
  private readonly metrics: { [key: string]: CloudWatchMetricOptions } = {};
  private readonly collectors: {
    [key: string]: {
      [key: string]: { dimensions: Dimension[]; collector: MetricCollector };
    };
  } = {};

  private logger = new StructuredLogger(CloudWatchMetricProducer.name);
  private readonly promiseCollector = new PromiseCollector();

  constructor(private readonly options: CloudWatchMetricProducerOptions) {
    this.maxBatchIntervalMs = options.maxBatchIntervalMs ?? 55000;

    for (const value of options.metrics || []) {
      this.addMetric(value);
    }

    this.client = options.client ?? new CloudWatchClient({});
  }

  addMetric(value: string | CloudWatchMetricOptions) {
    let metric: CloudWatchMetricOptions = {
      dimensions: [],
      ...this.options.defaults,
    };

    switch (typeof value) {
      case 'string':
        metric = {
          ...metric,
          metricName: value,
          collectionId: value,
        };
        break;
      case 'object':
        metric = { ...metric, ...value };
        if (!metric.metricName) {
          metric.metricName = metric.collectionId;
        }
        if (!metric.collectionId) {
          metric.collectionId = metric.metricName;
        }
        break;
      default:
        throw new Error(`Invalid metric definition ${JSON.stringify(value)}`);
    }

    if (!metric.collectionId) {
      throw new Error(`Missing collection id for metric ${JSON.stringify(value)}`);
    }
    if (!metric.metricName) {
      throw new Error(`Missing metric name for metric ${JSON.stringify(value)}`);
    }
    if (!metric.namespace) {
      throw new Error(`Missing namespace for metric ${JSON.stringify(value)}`);
    }

    if (this.metrics[metric.collectionId]) {
      throw new Error(`Metric ${metric.collectionId} already defined with name ${metric.metricName}`);
    }

    this.metrics[metric.collectionId] = metric;
  }

  onModuleInit() {
    if (!(this.maxBatchIntervalMs > 0)) {
      throw new Error('intervalMs must be greater than 0');
    }

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.flush();
    }, this.maxBatchIntervalMs);
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
  }

  add(collectionId: string, value: number | number[], additionalDimensions?: Dimension[]) {
    const metric = this.metrics[collectionId];
    if (!metric) {
      throw new Error(`Unknown metric ${collectionId}`);
    }

    const collector = this.getCollector(metric, additionalDimensions);

    collector.collect(value);
  }

  private getCollector(metric: CloudWatchMetricOptions, additionalDimensions?: Dimension[]): MetricCollector {
    additionalDimensions = additionalDimensions ?? [];

    let metricEntry = this.collectors[metric.collectionId];
    if (!metricEntry) {
      metricEntry = {};
      this.collectors[metric.collectionId] = metricEntry;
    }

    const dimensionKey = JSON.stringify(additionalDimensions);
    const dimensionEntry = metricEntry[dimensionKey];
    if (dimensionEntry) {
      return dimensionEntry.collector;
    }

    let collector: MetricCollector;
    switch (metric.collectionMode) {
      case 'statisticSet':
        collector = new StatisticSetCollector();
        break;
      case 'distinctValues':
        collector = new ValuesCollector();
        break;
      case 'sum':
        collector = new SumCollector();
        break;
      default:
        throw new Error(`Unknown collection mode ${metric.collectionMode} for metric ${metric.metricName}`);
    }

    metricEntry[dimensionKey] = {
      dimensions: additionalDimensions,
      collector,
    };

    return collector;
  }

  @OnEvent('flush')
  async flush() {
    const commands: PutMetricDataCommand[] = [];
    let metricDatumCount = 0;

    // Get all the namespaces because each command must be to a single namespace
    const namespaces = new Set<string>();
    for (const { namespace } of Object.values(this.metrics)) {
      namespaces.add(namespace);
    }

    for (const namespace of namespaces) {
      // Get all metric names
      const collectionIds = [...Object.keys(this.metrics)].filter((m) => this.metrics[m].namespace === namespace);

      const metricData: MetricDatum[] = [];

      // For each metric name, get all the dimensions and collectors
      for (const collectionId of collectionIds) {
        const metricOptions = this.metrics[collectionId];

        const collectors = this.collectors[collectionId];
        if (!collectors) {
          continue;
        }

        for (const { dimensions, collector } of Object.values(this.collectors[collectionId])) {
          // For each collector, get all the metric data
          for (const metricDatum of collector.getMetricData()) {
            metricData.push({
              MetricName: metricOptions.metricName,
              Dimensions: [...metricOptions.dimensions, ...dimensions],
              Unit: metricOptions.unit,
              StorageResolution: metricOptions.storageResolution,
              ...metricDatum,
            });
            metricDatumCount++;
          }
        }
      }

      // Split the metric data into chunks of 1000 and create a command for each chunk
      while (metricData.length > 0) {
        commands.push(
          new PutMetricDataCommand({
            MetricData: metricData.splice(0, 1000),
            Namespace: namespace,
          }),
        );
      }
    }

    if (commands.length === 0) {
      return;
    }

    this.logger.log('Flushing ${metricDatumCount} metrics to CloudWatch...', metricDatumCount);

    // Send all the commands in parallel
    try {
      await Promise.all(commands.map(this.promiseCollector.wrap((command) => this.client.send(command))));
    } catch (error) {
      this.logger.error('Error sending metrics to CloudWatch', error);
    }
  }
}
