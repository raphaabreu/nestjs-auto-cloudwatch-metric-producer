# AutoCloudWatchMetricProducer

The `CloudWatchMetricProducer` is a NestJS utility class designed to simplify the process of publishing metrics to AWS CloudWatch. The module offers flexibility by allowing you to collect metrics in different modes such as distinct values, sums, or statistical sets and then automatically batches and publishes them to CloudWatch. Additionally, it provides mechanisms to handle common scenarios like splitting large metric payloads.

## Installation

```bash
npm i @raphaabreu/nestjs-auto-cloudwatch-metric-producer
```

## Usage

### Initialization

Register `CloudWatchMetricModule` in your NestJS module and define metrics to be published with `AutoCloudWatchMetricProducer`:

```typescript
import {
  AutoCloudWatchMetricProducer,
  CloudWatchMetricModule,
} from '@raphaabreu/nestjs-auto-cloudwatch-metric-producer';

@Module({
  imports: [
    CloudWatchMetricModule.register({
      defaults: {
        namespace: 'yourcompany/yourapp',
      },
    }),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    AutoCloudWatchMetricProducer.register({
      eventName: 'order-placed',
      metric: {
        metricName: 'OrderCount',
        unit: 'Count',
        collectionMode: 'sum',
      },
      // Will run for every event that is emitted
      collect(value: any, add) {
        // Will add 1 to the counter
        add(1);
      },
    }),
    AutoCloudWatchMetricProducer.register({
      // The same event can power multiple metrics
      eventName: 'order-placed',
      metric: {
        metricName: 'OrderValue',
        unit: 'None',
        collectionMode: 'statisticSet',
      },
      // Will run for every event that is emitted
      collect(order: { total: number; country: string }, add) {
        // Adds the total to a statistic set alongside with a custom dimension to split the data by country.
        add(order.total, [
          {
            Name: 'Country',
            Value: order.country,
          },
        ]);
      },
    }),
  ],
})
export class YourModule {}
```

### Publishing events

Use the `EventEmitter2` class to emit events.

```typescript
@Injectable()
export class YourService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async someMethod() {
    // Emit events as usual
    this.eventEmitter.emit('order-placed', { total: 10.4, country: 'USA' });
  }
}
```

### Custom Collection Modes

Based on your requirement, metrics can be collected in various modes:

- `distinctValues`: Each metric value is individually collected. This will allow the full extent of metrics from CloudWatch like percentile distributions and more.
- `sum`: Sum all the values collected. This option will consume as few resources as possible from CloudWatch since it will be aggregated locally.
- `statisticSet`: Collect statistics set which includes minimum, maximum, sum, and sample count of values. This option is a middle ground between `distinctValues` and `sum`. It will not allow the computation of metrics involving percentiles or distributions but will allow minimums, maximums and averages.

### Handling Large Metric Payloads

The producer handles large metric payloads by automatically splitting them and sending in separate requests to avoid payload size exceedance.

## Tests

To run the provided unit tests just execute `npm run tests`.

## License

MIT License

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## Support

If you have any issues or questions, please open an issue on the project repository.
