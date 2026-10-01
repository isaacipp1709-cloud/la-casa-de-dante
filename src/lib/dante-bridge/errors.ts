export class DanteBridgeError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "DanteBridgeError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DanteBridgeError {
  constructor(details: unknown) {
    super("Invalid payload format", "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}
