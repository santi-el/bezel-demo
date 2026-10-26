import { AmountPromptHost } from './src/components/AmountPrompt';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/app/navigation/AppNavigator';

export default function App() {
  return (
    <>
      <AppNavigator />
      <AmountPromptHost />
      <StatusBar style="light" />
    </>
  );
}
