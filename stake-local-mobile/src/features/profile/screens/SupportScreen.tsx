import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  offerId?: string;
};

type ProblemType = 'wrong_result' | 'other' | null;

export default function SupportScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { offerId } = (route.params as RouteParams) || {};
  
  const [selectedProblem, setSelectedProblem] = useState<ProblemType>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedProblem || !description.trim()) {
      Alert.alert('Missing Information', 'Please select a problem type and describe what happened.');
      return;
    }

    try {
      setSubmitting(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review it and get back to you within 24 hours.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Report a Problem</Text>
      <Text style={styles.subheader}>
        Let us know what went wrong and we'll help resolve it.
      </Text>

      {offerId && (
        <View style={styles.offerIdBox}>
          <Text style={styles.offerIdLabel}>Regarding Offer:</Text>
          <Text style={styles.offerIdValue}>{offerId}</Text>
        </View>
      )}

      {/* Problem Type Selection */}
      <Text style={styles.sectionTitle}>What happened?</Text>
      
      <TouchableOpacity
        style={[
          styles.problemOption,
          selectedProblem === 'wrong_result' && styles.problemOptionSelected,
        ]}
        onPress={() => setSelectedProblem('wrong_result')}
      >
        <View style={styles.radioOuter}>
          {selectedProblem === 'wrong_result' && <View style={styles.radioInner} />}
        </View>
        <Text style={styles.problemText}>
          My opponent reported a result that is not true
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.problemOption,
          selectedProblem === 'other' && styles.problemOptionSelected,
        ]}
        onPress={() => setSelectedProblem('other')}
      >
        <View style={styles.radioOuter}>
          {selectedProblem === 'other' && <View style={styles.radioInner} />}
        </View>
        <Text style={styles.problemText}>
          Other Problem...
        </Text>
      </TouchableOpacity>

      {/* Description Input */}
      {selectedProblem && (
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionLabel}>Tell us what happened...</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Please provide details about the issue..."
            placeholderTextColor="#666666"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedProblem || !description.trim() || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedProblem || !description.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.submitButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Help Info */}
      <View style={styles.helpInfo}>
        <Text style={styles.helpTitle}>What happens next?</Text>
        <Text style={styles.helpText}>
          • Our team will review your report within 24 hours{'\n'}
          • We may reach out for additional information{'\n'}
          • If the dispute is valid, we'll work to resolve it fairly{'\n'}
          • Funds remain on hold during the review process
        </Text>
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
    paddingBottom: 40,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 24,
  },
  offerIdBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  offerIdLabel: {
    fontSize: 14,
    color: '#888888',
    marginRight: 8,
  },
  offerIdValue: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  problemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  problemOptionSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#1f1a00',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD700',
  },
  problemText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  descriptionSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  descriptionInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  submitContainer: {
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  submitButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  helpInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 22,
  },
});
