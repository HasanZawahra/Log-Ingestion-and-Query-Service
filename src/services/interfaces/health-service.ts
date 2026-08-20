export interface IHealthService {
  // Returns true only when the app is ready to serve traffic.
  checkHealth(): Promise<boolean>;
}
