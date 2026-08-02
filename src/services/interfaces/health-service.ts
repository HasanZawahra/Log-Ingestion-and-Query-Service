export interface IHealthService {
  checkHealth(): Promise<boolean>;
}
