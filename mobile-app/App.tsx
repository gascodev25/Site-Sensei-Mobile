import { AppRegistry } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/navigation/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { name as appName } from './app.json'; // This ensures the name matches your app.json

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// This line is CRITICAL. It registers the App component as the main entry point.
// It uses the name from your app.json (e.g., "ACGWorks Field") or defaults to "main".
AppRegistry.registerComponent(appName || 'main', () => App);
