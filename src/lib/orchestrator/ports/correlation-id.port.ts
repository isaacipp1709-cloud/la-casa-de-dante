export interface CorrelationIdGenerator {
  next(prefix?: string): string;
}

export class DeterministicCorrelationIdGenerator implements CorrelationIdGenerator {
  private counter = 0;

  next(prefix = "dante-corr"): string {
    this.counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.counter}`;
  }
}
