import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiClient, matchQuote, calculateGFD, calculateCommission, calculateTotalHold } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';
import { Offer } from '../../../models/Offer';

type RouteParams = {
  offerId?: string;
  betId?: string;
  matchType?: 'exact' | 'partial' | 'raise' | 'betAgainst';
  amount?: number;
};

export default function MatchBetModal() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { offerId, betId, matchType = 'exact' } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // For Match Partially, Match & Raise, and Bet Against
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [raiseAmount, setRaiseAmount] = useState('');

  useEffect(() => {
    loadOffer();
  }, [offerId, betId]);

  const loadOffer = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToUse = offerId || betId;
      
      if (!idToUse) {
        setError('Offer ID is missing');
        setLoading(false);
        return;
      }

      const offerData = await apiClient.getOfferById(idToUse);
      if (offerData) {
        setOffer(offerData);
        // Auto-show input for partial/raise/betAgainst
        if (matchType === 'partial' || matchType === 'raise' || matchType === 'betAgainst') {
          setShowAmountInput(true);
        }
      } else {
        setError('Offer not found');
      }
    } catch (error) {
      console.error('Error loading offer:', error);
      setError('Failed to load offer');
    } finally {
      setLoading(false);
    }
  };

  const getMatchAmount = (): number => {
    if (!offer) return 0;
    
    if (matchType === 'partial' && partialAmount) {
      const amount = Number(partialAmount);
      if (!isNaN(amount)) {
        return amount;
      }
    }
    
    return offer.remainingStakeMatcher;
  };

  const getMatchDetails = () => {
    const stake = getMatchAmount();
    if (stake === 0) return { stake: 0, deposit: 0, commission: 0, total: 0 };
    
    const deposit = calculateGFD(stake);
    const commission = calculateCommission(stake);
    const total = calculateTotalHold(stake);

    return { stake, deposit, commission, total };
  };

  const calculatePrizeMoney = (): number => {
    const stake = getMatchAmount();
    if (!offer || stake === 0) return 0;
    
    try { return matchQuote(offer,stake).prize; } catch {return 0;}
  };

  const handleMatch = async () => {
    if (!offer) return;

    try {
      setConfirming(true);
      const matchAmount = getMatchAmount();
      await apiClient.matchOffer(offer.offerId, matchAmount);
      navigation.goBack();
      Alert.alert('Success', 'Offer matched successfully!');
    } catch (error: any) {
      console.error('Error matching offer:', error);
      if (error.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert(
          'Insufficient Balance',
          'You need to add funds to your wallet',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Funds', onPress: () => Alert.alert('Stripe Checkout', 'This would open Stripe checkout in production') },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to match offer. Please try again.');
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleMatchPartially = () => {
    if (!offer) return;
    setShowAmountInput(true);
    setPartialAmount('');
    setRaiseAmount('');
  };

  const handlePartialConfirm = async () => {
    if (!offer || !partialAmount) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }
    
    const amount = Number(partialAmount);
    if (isNaN(amount) || amount <= 0 || amount > offer.remainingStakeMatcher) {
      Alert.alert('Error', `Please enter an amount between $0.01 and $${offer.remainingStakeMatcher.toFixed(2)}`);
      return;
    }

    try {
      setConfirming(true);
      await apiClient.matchOffer(offer.offerId, amount);
      setShowAmountInput(false);
      navigation.goBack();
      Alert.alert('Success', 'Offer matched partially!');
    } catch (error: any) {
      console.error('Error matching partially:', error);
      Alert.alert('Error', 'Failed to match offer. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleMatchAndRaise = () => {
    if (!offer) return;
    setShowAmountInput(true);
    setPartialAmount(offer.remainingStakeMatcher.toString());
    setRaiseAmount('');
  };

  const handleRaiseConfirm = async () => {
    if (!offer || !raiseAmount) {
      Alert.alert('Error', 'Please enter a raise amount');
      return;
    }
    
    const matchAmount = Number(partialAmount) || offer.remainingStakeMatcher;
    const raiseAmt = Number(raiseAmount);
    
    if (isNaN(raiseAmt) || raiseAmt <= 0) {
      Alert.alert('Error', 'Please enter a valid raise amount');
      return;
    }

    try {
      setConfirming(true);
      
      await apiClient.matchAndRaise(offer.offerId, matchAmount, raiseAmt, raiseAmt, '1:1');

      setShowAmountInput(false);
      navigation.goBack();
      Alert.alert('Success', 'Offer matched and raised!');
    } catch (error: any) {
      console.error('Error matching and raising:', error);
      Alert.alert('Error', 'Failed to match and raise. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleBetAgainst = () => {
    if (!offer) return;
    setShowAmountInput(true);
    setPartialAmount('');
    setRaiseAmount('');
  };

  const handleBetAgainstConfirm = async () => {
    if (!offer || !partialAmount) {
      Alert.alert('Error', 'Please enter a stake amount');
      return;
    }
    
    const stakeAmt = Number(partialAmount);
    if (isNaN(stakeAmt) || stakeAmt <= 0) {
      Alert.alert('Error', 'Please enter a valid stake amount');
      return;
    }

    try {
      setConfirming(true);
      
      await apiClient.betAgainst(offer.offerId, stakeAmt);

      setShowAmountInput(false);
      navigation.goBack();
      Alert.alert('Success', 'Your bet against offer has been posted!');
    } catch (error: any) {
      console.error('Error creating bet against:', error);
      Alert.alert('Error', 'Failed to create bet against offer. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Loading state
  if (loading) {
    return (
      <Modal visible={true} transparent={true} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Match</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.loadingText}>Loading offer...</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Error state
  if (error || !offer) {
    return (
      <Modal visible={true} transparent={true} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Match</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.centerContent}>
                <Text style={styles.errorText}>{error || 'Offer not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadOffer}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Amount input mode (for partial, raise, bet against)
  if (showAmountInput) {
    const isRaise = matchType === 'raise';
    const isBetAgainst = matchType === 'betAgainst';
    
    return (
      <Modal visible={true} transparent={true} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {isRaise ? 'Match & Raise' : isBetAgainst ? 'Bet Against' : 'Match Partially'}
                </Text>
                <TouchableOpacity onPress={() => setShowAmountInput(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {isRaise && (
                  <>
                    <Text style={styles.inputLabel}>Match Amount (max ${offer.remainingStakeMatcher.toFixed(2)}):</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={partialAmount}
                      onChangeText={setPartialAmount}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666666"
                    />
                    <Text style={styles.inputLabel}>Raise Amount:</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={raiseAmount}
                      onChangeText={setRaiseAmount}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666666"
                    />
                    <TouchableOpacity
                      style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
                      onPress={handleRaiseConfirm}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Match & Raise</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
                {isBetAgainst && (
                  <>
                    <Text style={styles.inputLabel}>Your Stake Amount:</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={partialAmount}
                      onChangeText={setPartialAmount}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666666"
                    />
                    <TouchableOpacity
                      style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
                      onPress={handleBetAgainstConfirm}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Post Bet Against</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
                {!isRaise && !isBetAgainst && (
                  <>
                    <Text style={styles.inputLabel}>Match Amount (max ${offer.remainingStakeMatcher.toFixed(2)}):</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={partialAmount}
                      onChangeText={setPartialAmount}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666666"
                    />
                    <TouchableOpacity
                      style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
                      onPress={handlePartialConfirm}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Match Partially</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Main match modal (exact match)
  const { stake, deposit, commission, total } = getMatchDetails();
  const prizeMoney = calculatePrizeMoney();
  const oddsRatio = offer.oddsRatio || '1:1';
  const nullText = offer.nullSituationText;

  return (
    <Modal visible={true} transparent={true} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Match</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
            >
              {/* I BET [stake] ODDS [odds] */}
              <View style={styles.betRow}>
                <Text style={styles.betText}>I BET</Text>
                <Text style={styles.betAmount}>${stake.toFixed(2)}</Text>
                <Text style={styles.betText}>ODDS</Text>
                <Text style={styles.betOdds}>{oddsRatio}</Text>
              </View>

              {/* Settlement explanations */}
              <View style={styles.settlementSection}>
                <Text style={styles.settlementText}>
                  You receive ${prizeMoney.toFixed(2)} if: {offer.trueSituationText}
                </Text>
                <Text style={styles.settlementText}>
                  You lose ${stake.toFixed(2)} if: {offer.falseSituationText}
                </Text>
                {nullText && (
                  <Text style={styles.settlementText}>
                    If: {nullText} — you get your money back.
                  </Text>
                )}
              </View>

              {/* Money disclosure */}
              <View style={styles.moneySection}>
                <View style={styles.moneyRow}>
                  <Text style={styles.moneyLabel}>Hold:</Text>
                  <Text style={styles.moneyValue}>${total.toFixed(2)}</Text>
                </View>
                <View style={styles.moneyRow}>
                  <Text style={styles.moneyLabel}>Good-Faith Deposit:</Text>
                  <Text style={styles.moneyValue}>${deposit.toFixed(2)}</Text>
                </View>
                <View style={styles.moneyRow}>
                  <Text style={styles.moneyLabel}>Commission:</Text>
                  <Text style={styles.moneyValue}>${commission.toFixed(2)} (charged now)</Text>
                </View>
              </View>

              {/* Disclaimer */}
              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>
                  We'll hold ${total.toFixed(2)} and return your additional ${deposit.toFixed(2)} Good-Faith Deposit when the offer is resolved. That's how we guarantee everyone plays fair. <Text accessibilityRole="link" onPress={() => navigation.navigate('FAQ', { topic: 'deposit' })} style={{textDecorationLine: 'underline'}}>Learn more…</Text>
                </Text>
              </View>

              {/* Place Button */}
              <TouchableOpacity
                style={[styles.placeButton, confirming && styles.placeButtonDisabled]}
                onPress={handleMatch}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.placeButtonText}>Place</Text>
                )}
              </TouchableOpacity>

              {/* Commission line */}
              <Text style={styles.commissionLine}>
                Commission: ${commission.toFixed(2)} (charged now)
              </Text>

              {/* Warning */}
              <Text style={styles.warningText}>
                Once you've placed the Offer, it cannot be canceled.
              </Text>

              {/* Alternative actions */}
              <View style={styles.alternativeLinks}>
                <TouchableOpacity
                  style={styles.alternativeLink}
                  onPress={handleMatchAndRaise}
                >
                  <Text style={styles.alternativeLinkText}>Match & Raise</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.alternativeLink}
                  onPress={handleMatchPartially}
                >
                  <Text style={styles.alternativeLinkText}>Match Partially</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.alternativeLink}
                  onPress={handleBetAgainst}
                >
                  <Text style={styles.alternativeLinkText}>Bet Against</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    color: '#888888',
    fontWeight: '300',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContent: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
    flexWrap: 'wrap',
  },
  betText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  betAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  betOdds: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  settlementSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  settlementText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 12,
  },
  moneySection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  moneyLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  moneyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disclaimerBox: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  placeButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  placeButtonDisabled: {
    opacity: 0.6,
  },
  placeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  commissionLine: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
  },
  alternativeLinks: {
    gap: 12,
    marginBottom: 16,
  },
  alternativeLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  alternativeLinkText: {
    fontSize: 14,
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  amountInput: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
})