import { ValuesCollector } from './values-collector';

describe('ValuesCollector', () => {
  let valuesCollector: ValuesCollector;

  beforeEach(() => {
    valuesCollector = new ValuesCollector();
  });

  describe('collect', () => {
    it('should collect a single value', () => {
      // Arrange
      const value = 123.456;
      // Act
      valuesCollector.collect(value);

      // Assert
      const metricData = valuesCollector.getMetricData();
      expect(metricData.length).toBe(1);
      expect(metricData[0].Values).toEqual([123.456]);
      expect(metricData[0].Counts).toEqual([1]);
    });

    it('should collect multiple values individually', () => {
      // Arrange
      const values = [123.456, 234.567, 345.678];

      // Act
      values.forEach((value) => valuesCollector.collect(value));

      // Assert
      const metricData = valuesCollector.getMetricData();
      expect(metricData.length).toBe(1);
      expect(metricData[0].Values).toEqual([123.456, 234.567, 345.678]);
      expect(metricData[0].Counts).toEqual([1, 1, 1]);
    });

    it('should collect an array of values', () => {
      // Arrange
      const values = [123.456, 234.567, 345.678];

      // Act
      valuesCollector.collect(values);

      // Assert
      const metricData = valuesCollector.getMetricData();
      expect(metricData.length).toBe(1);
      expect(metricData[0].Values).toEqual([123.456, 234.567, 345.678]);
      expect(metricData[0].Counts).toEqual([1, 1, 1]);
    });

    it('should accumulate counts for the same value', () => {
      // Arrange
      const value = 123.456;

      // Act
      valuesCollector.collect(value);
      valuesCollector.collect(value);

      // Assert
      const metricData = valuesCollector.getMetricData();
      expect(metricData.length).toBe(1);
      expect(metricData[0].Values).toEqual([123.456]);
      expect(metricData[0].Counts).toEqual([2]);
    });
  });

  describe('getMetricData', () => {
    it('should return empty array when no values have been collected', () => {
      // Arrange

      // Act
      const metricData = valuesCollector.getMetricData();

      // Assert
      expect(metricData).toEqual([]);
    });

    it('should split data into multiple MetricDatum when there are more than 150 values', () => {
      // Arrange
      for (let i = 0; i < 300; i++) {
        valuesCollector.collect(i);
      }

      // Act
      const metricData = valuesCollector.getMetricData();

      // Assert
      expect(metricData.length).toBe(2);
      expect(metricData[0].Values.length).toBe(150);
      expect(metricData[1].Values.length).toBe(150);
      expect(metricData[0].Counts.every((count) => count === 1)).toBeTruthy();
      expect(metricData[1].Counts.every((count) => count === 1)).toBeTruthy();
    });
  });
});
