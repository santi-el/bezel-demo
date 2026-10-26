import { apiClient } from '../../../services/api/client';
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authService } from '../../../services/auth/authService';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [username, setUsername] = useState('');
  const [accounts, setAccounts] = useState<{id:string;username:string}[]>([]);
  useEffect(() => { apiClient.getUsers().then(setAccounts).catch(() => Alert.alert('Error', 'Unable to load local accounts')); }, []);
  const [loading, setLoading] = useState(false);

  // DEV ONLY: Development bypass for authentication
  const handleDevSignIn = async (userId: string = 'dev_user_1') => {

    try {
      setLoading(true);
      await authService.devSignIn(userId);
      
      // Navigate directly to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      console.error('Dev sign in error:', error);
      Alert.alert('Error', 'Failed to bypass authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, {flex: undefined, flexGrow: 1}]}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Choose a local demo account to continue</Text>

        <View style={styles.form}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.devButtonsContainer}>
            {accounts.map((account,index) => (
              <TouchableOpacity key={account.id} style={[styles.devButton,index===1&&styles.devButtonSecondary]} onPress={()=>handleDevSignIn(account.id)} disabled={loading}>
                <Text style={styles.devButtonText}>Account {index+1} ({account.username})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#888888',
  },
  linkBold: {
    color: '#FFD700',
    fontWeight: '600',
  },
  // DEV ONLY: Development bypass button styles
  devButtonsContainer: {
    marginTop: 24,
    gap: 12,
  },
  devButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
  },
  devButtonSecondary: {
    borderColor: '#4CAF50',
  },
  devButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
});

