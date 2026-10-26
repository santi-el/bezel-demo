import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { apiClient, calculateCommission, calculateGFD, calculateTotalHold } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { locationService } from '../../../services/location/locationService';

export default function CreateBetScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [odds, setOdds] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateBet = async () => {
    if (!title.trim() || !amount || !odds) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const userId = await authService.getUserId();
      if (!userId) {
        Alert.alert('Error', 'Please log in to create a bet');
        return;
      }

      const distance = 150; // Demo Central Plaza

      const stakeAmount = Number(amount);
      const commission = calculateCommission(stakeAmount);
      const goodFaithDeposit = calculateGFD(stakeAmount);
      const totalHold = calculateTotalHold(stakeAmount);

      await apiClient.createBet({
        title: title.trim(),
        description: description.trim() || undefined,
        stakeAmount,
        goodFaithDeposit,
        totalHold,
        commission,
        odds: Number(odds),
        distance,
        userId,
        status: 'active',
      });

      Alert.alert('Success', 'Bet created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setAmount('');
            setOdds('');
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating bet:', error);
      Alert.alert('Error', 'Failed to create bet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.form}>
        <Text style={styles.label}>Bet Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Warriors win by 5+ points"
          placeholderTextColor="#666666"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add details about your bet..."
          placeholderTextColor="#666666"
          multiline
          numberOfLines={4}
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Amount ($) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="50"
              placeholderTextColor="#666666"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.halfWidth}>
            <Text style={styles.label}>Odds *</Text>
            <TextInput
              style={styles.input}
              value={odds}
              onChangeText={setOdds}
              placeholder="1.5"
              placeholderTextColor="#666666"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateBet}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating...' : 'Create Bet'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
  },
  form: {
    flex: 1,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
});

