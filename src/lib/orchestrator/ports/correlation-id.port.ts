export interface CorrelationIdGenerator {
  next(): string;
}
