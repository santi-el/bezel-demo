import { engine } from '../demo/runtime';
import { ApiClient } from './adapter';
export * from './adapter';
export const apiClient = new ApiClient(engine);
