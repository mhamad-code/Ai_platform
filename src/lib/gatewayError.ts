export class GatewayError extends Error {
  status: number;
  kind: 'auth' | 'quota' | 'network' | 'server' | 'notConfigured' | 'unknown';
  constructor(kind: GatewayError['kind'], message: string, status = 0) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}
