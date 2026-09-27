import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer, OfferOutcome } from '../../../models/Offer';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  offerId: string;
};

export default function ResultsScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<OfferOutcome | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [offerId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      setCurrentUserId(userId);
      
      const offerData = await apiClient.getOfferById(offerId);
      if (offerData) {
        setOffer(offerData);
      } else {
        Alert.alert('Error', 'Offer not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error loading offer:', error);
      Alert.alert('Error', 'Failed to load offer', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResult = async () => {
    if (!offer || !selectedOutcome || !currentUserId) return;

    try {
      setSubmitting(true);
      await apiClient.confirmResult(offer.offerId, selectedOutcome, currentUserId);
      
      Alert.alert(
        'Result Confirmed',
        'Your result has been submitted. Waiting for your opponent to confirm.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ActiveBet', { betId: offer.offerId, offerId: offer.offerId }),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error confirming result:', error);
      Alert.alert('Error', error.message || 'Failed to confirm result. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportProblem = () => {
    navigation.navigate('Support' as any, { offerId: offer?.offerId });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Offer not found</Text>
      </View>
    );
  }

  const perspective = getOfferPerspective(offer, currentUserId);
  const hasNullOption = !!offer.nullSituationText;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>What Happened?</Text>
      <Text style={styles.subheader}>Select the outcome that occurred:</Text>

      {/* Offer Title */}
      <View style={styles.offerTitleBox}>
        <Text style={styles.offerTitle}>{offer.postTitle}</Text>
      </View>

      {/* Outcome Options */}
      <View style={styles.outcomesContainer}>
        {/* TRUE Outcome - Win for creator */}
        <TouchableOpacity
          style={[
            styles.outcomeOption,
            selectedOutcome === 'TRUE' && styles.outcomeOptionSelected,
          ]}
          onPress={() => setSelectedOutcome('TRUE')}
        >
          <View style={styles.radioOuter}>
            {selectedOutcome === 'TRUE' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.outcomeTextContainer}>
            <Text style={styles.outcomeLabel}>
              {offer.trueSituationText}
            </Text>
            <Text style={styles.outcomeDescription}>
              {perspective.isOwner ? 'You win' : 'You lose'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* FALSE Outcome - Win for matcher */}
        <TouchableOpacity
          style={[
            styles.outcomeOption,
            selectedOutcome === 'FALSE' && styles.outcomeOptionSelected,
          ]}
          onPress={() => setSelectedOutcome('FALSE')}
        >
          <View style={styles.radioOuter}>
            {selectedOutcome === 'FALSE' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.outcomeTextContainer}>
            <Text style={styles.outcomeLabel}>
              {offer.falseSituationText}
            </Text>
            <Text style={styles.outcomeDescription}>
              {perspective.isOwner ? 'You lose' : 'You win'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* NULL Outcome - Tie/No result */}
        {hasNullOption && (
          <TouchableOpacity
            style={[
              styles.outcomeOption,
              selectedOutcome === 'NULL' && styles.outcomeOptionSelected,
            ]}
            onPress={() => setSelectedOutcome('NULL')}
          >
            <View style={styles.radioOuter}>
              {selectedOutcome === 'NULL' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.outcomeTextContainer}>
              <Text style={styles.outcomeLabel}>
                {offer.nullSituationText}
              </Text>
              <Text style={styles.outcomeDescription}>
                Money refunded to both
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          (!selectedOutcome || submitting) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirmResult}
        disabled={!selectedOutcome || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm Result</Text>
        )}
      </TouchableOpacity>

      {/* Report Problem */}
      <TouchableOpacity style={styles.reportButton} onPress={handleReportProblem}>
        <Text style={styles.reportButtonText}>Report a Problem</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
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
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  offerTitleBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFD700',
    textAlign: 'center',
  },
  outcomesContainer: {
    marginBottom: 32,
  },
  outcomeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  outcomeOptionSelected: {
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
  outcomeTextContainer: {
    flex: 1,
  },
  outcomeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  outcomeDescription: {
    fontSize: 14,
    color: '#888888',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});
