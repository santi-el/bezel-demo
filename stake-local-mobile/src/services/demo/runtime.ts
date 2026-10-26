import AsyncStorage from '@react-native-async-storage/async-storage';
import { DemoEngine } from '../../domain/demo';
export const engine = new DemoEngine({
  load: () => AsyncStorage.getItem('stake-local.demo.v1'),
  save: value => AsyncStorage.setItem('stake-local.demo.v1', value)
});
export const requestKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
