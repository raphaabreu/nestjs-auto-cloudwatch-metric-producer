import { DynamicModule, Module } from '@nestjs/common';
import {
  CloudWatchMetricProducer,
  CloudWatchMetricProducerOptions,
} from './cloudwatch-metric-producer';

@Module({})
export class CloudWatchMetricModule {
  static register(options: CloudWatchMetricProducerOptions): DynamicModule {
    return {
      module: CloudWatchMetricModule,
      providers: [
        {
          provide: CloudWatchMetricProducer,
          useFactory: () => new CloudWatchMetricProducer(options),
          inject: [],
        },
      ],
      exports: [CloudWatchMetricProducer],
    };
  }
}
