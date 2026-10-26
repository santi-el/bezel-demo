import { requestKey } from '../../../services/demo/runtime';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, calculateOddsStake, matchQuote, calculateGFD, calculateCommission, calculateTotalHold } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer } from '../../../models/Offer';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  offerId: string;
};

type OddsOption = {
  label: string;
  ratio: string;
  calculateStakeB: (stakeA: number) => number;
};

const ODDS_OPTIONS: OddsOption[] = [
  { label: '1:1', ratio: '1:1', calculateStakeB: (a) => a },
  { label: '1:2', ratio: '1:2', calculateStakeB: (a) => a * 2 },
  { label: '2:1', ratio: '2:1', calculateStakeB: (a) => a / 2 },
  { label: '1.5:1', ratio: '1.5:1', calculateStakeB: (a) => a / 1.5 },
  { label: '1:1.5', ratio: '1:1.5', calculateStakeB: (a) => a * 1.5 },
  { label: '3:1', ratio: '3:1', calculateStakeB: (a) => a / 3 },
  { label: '1:3', ratio: '1:3', calculateStakeB: (a) => a * 3 },
  { label: 'CUSTOM', ratio: 'CUSTOM', calculateStakeB: (a) => a },
];

export default function MatchAndRaiseScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const operationKey = React.useRef(requestKey()).current;
  const { offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [selectedOdds, setSelectedOdds] = useState<OddsOption | null>(ODDS_OPTIONS[0]); // Default to 1:1
  const [customStakeB, setCustomStakeB] = useState('');
  const [customDraft, setCustomDraft] = useState('');
  const [editingCustom, setEditingCustom] = useState(false);
  const closeOdds = () => { setEditingCustom(false); setShowOddsDropdown(false); };
  const applyCustom = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(customDraft.trim()) || Number(customDraft) <= 0) { Alert.alert('Invalid amount', 'Enter a positive amount with at most two decimals'); return; }
    setCustomStakeB(customDraft.trim()); setSelectedOdds(ODDS_OPTIONS.find(o => o.ratio === 'CUSTOM')!); closeOdds();
  };
  const [showOddsDropdown, setShowOddsDropdown] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
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
      const [offerData, balance] = await Promise.all([
        apiClient.getOfferById(offerId),
        apiClient.getAvailableBalance(),
      ]);
      
      if (offerData) {
        setOffer(offerData && offerData.status === 'MATCHED' && offerData.creatorUserId === userId ? {...offerData,trueSituationText:offerData.falseSituationText,falseSituationText:offerData.trueSituationText} : offerData);
      } else {
        Alert.alert('Error', 'Offer not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
      setAvailableBalance(balance);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load offer', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getMatchAmount = (): number => {
    if (!offer) return 0;
    return offer.status === 'MATCHED' ? 0 : offer.remainingStakeMatcher;
  };

  const getRaiseAmountValue = (): number => {
    if (!raiseAmount) return 0;
    const amount = Number(raiseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return amount;
  };

  const calculateStakeB = (): number => {
    const raiseAmt = getRaiseAmountValue();
    if (!selectedOdds || raiseAmt <= 0) return 0;
    
    if (selectedOdds.ratio === 'CUSTOM') {
      return Number(customStakeB) || 0;
    }
    
    try { return calculateOddsStake(raiseAmt, selectedOdds.ratio); } catch { return 0; }
  };

  const calculatePrizeMoney = (stake: number, stakeB: number, oddsRatio: string): number => {
    if (oddsRatio === '1:1') {
      return stake + stake;
    }
    return stake + stakeB;
  };

  const getMatchPrizeMoney = (): number => {
    const matchAmt = getMatchAmount();
    if (!offer || matchAmt === 0) return 0;
    return matchQuote(offer, matchAmt).prize;
  };

  const getRaisePrizeMoney = (): number => {
    const raiseAmt = getRaiseAmountValue();
    if (raiseAmt === 0) return 0;
    const stakeB = calculateStakeB();
    return calculatePrizeMoney(raiseAmt, stakeB, selectedOdds?.ratio || '1:1');
  };

  const getMatchDetails = (stake: number) => {
    if (stake === 0) return { deposit: 0, commission: 0, total: 0, chargedNow: 0 };
    
    const deposit = calculateGFD(stake);
    const commission = calculateCommission(stake);
    const total = calculateTotalHold(stake);
    const chargedNow = total + commission;

    return { deposit, commission, total, chargedNow };
  };

  const handlePlace = async () => {
    if (!offer) return;

    const matchAmt = getMatchAmount();
    const raiseAmt = getRaiseAmountValue();

    if (raiseAmt <= 0) {
      Alert.alert('Error', 'Please enter a valid raise amount');
      return;
    }

    const matchDetails = getMatchDetails(matchAmt);
    const raiseDetails = getMatchDetails(raiseAmt);
    const totalCharged = matchDetails.chargedNow + raiseDetails.chargedNow;

    if (availableBalance !== null && availableBalance < totalCharged) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${totalCharged.toFixed(2)} but only have $${availableBalance.toFixed(2)}. Redirecting to add funds...`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => Alert.alert('Stripe Checkout', 'This would open Stripe checkout in production') },
        ]
      );
      return;
    }

    try {
      setConfirming(true);
      
      await apiClient.matchAndRaise(offer.offerId, matchAmt, raiseAmt, calculateStakeB(), selectedOdds?.ratio || '1:1', operationKey, offer.status === 'MATCHED');

      Alert.alert('Success', offer.status === 'MATCHED' ? 'Linked offer posted!' : 'Offer matched and raised!', [
        { text: 'OK', onPress: () => navigation.navigate('MyBets') },
      ]);
    } catch (error: any) {
      console.error('Error matching and raising:', error);
      if (error.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert('Insufficient Balance', 'Please add funds to your wallet');
      } else {
        Alert.alert('Error', 'Failed to match and raise. Please try again.');
      }
    } finally {
      setConfirming(false);
    }
  };

  if (!loading && !offer) {
    return <View style={styles.container}><Text style={styles.loadingText}>Offer unavailable</Text><TouchableOpacity onPress={()=>loadData()}><Text style={styles.loadingText}>Retry</Text></TouchableOpacity></View>;
  }
  if (loading || !offer) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </View>
    );
  }

  const matchAmt = getMatchAmount();
  const raiseAmt = getRaiseAmountValue();
  const stakeB = calculateStakeB();
  const matchDetails = getMatchDetails(matchAmt);
  const raiseDetails = getMatchDetails(raiseAmt);
  const totalCharged = matchDetails.chargedNow + raiseDetails.chargedNow;
  const oddsRatio = selectedOdds?.ratio || '1:1';
  const perspective = getOfferPerspective(offer, currentUserId); // Public view

  // Prize money calculations
  const matchPrizeMoney = getMatchPrizeMoney();
  const raisePrizeMoney = getRaisePrizeMoney();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Match & Raise</Text>

      {/* Match Amount (read-only) */}
      <View style={styles.readOnlySection}>
        <Text style={styles.readOnlyLabel}>Match Amount:</Text>
        <Text style={styles.readOnlyValue}>${matchAmt.toFixed(2)} {offer.oddsRatio || '1:1'}</Text>
      </View>

      {/* Match Amount Breakdown */}
      <View style={styles.breakdownSection}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Stake Amount</Text>
          <Text style={styles.breakdownValue}>${matchAmt.toFixed(2)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Good Faith Deposit</Text>
          <Text style={styles.breakdownValue}>${matchDetails.deposit.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.breakdownRow}>
          <Text style={styles.totalLabel}>Hold Amount</Text>
          <Text style={styles.totalValue}>= ${matchDetails.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Raise Amount Input with Odds Button */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Raise Amount:</Text>
        <View style={styles.raiseInputRow}>
          <TextInput
            style={[styles.amountInput, styles.raiseInput]}
            value={raiseAmount}
            onChangeText={setRaiseAmount}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor="#666666"
          />
          <TouchableOpacity
            style={styles.oddsButtonInline}
            onPress={() => setShowOddsDropdown(true)}
          >
            <Text style={styles.oddsButtonText}>
              {selectedOdds ? selectedOdds.label : '1:1'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Odds Dropdown Modal */}
      <Modal
        visible={showOddsDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={closeOdds}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeOdds}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight: '85%', width: '90%'}} contentContainerStyle={styles.dropdownContainer}>
            {ODDS_OPTIONS.map((odds) => {
              const stakeBForOption = odds.ratio === 'CUSTOM' 
                ? Number(customStakeB) || 0
                : odds.calculateStakeB(raiseAmt);
              const displayText = odds.ratio === 'CUSTOM'
                ? 'CUSTOM'
                : `${odds.label} TO WIN $${stakeBForOption.toFixed(2)}`;
              
              return (
                <TouchableOpacity
                  key={odds.ratio}
                  style={styles.dropdownItem}
                  onPress={() => {
                    if (odds.ratio === 'CUSTOM') { setCustomDraft(customStakeB); setEditingCustom(true); return; }
                    setEditingCustom(false);
                    setSelectedOdds(odds);
                    setShowOddsDropdown(false);
                    if (odds.ratio !== 'CUSTOM') {
                      setCustomStakeB('');
                    }
                  }}
                >
                  <Text style={styles.dropdownItemText}>{displayText}</Text>
                </TouchableOpacity>
              );
            })}
            {editingCustom && (
              <View style={styles.customInputContainer}>
                <Text style={styles.customInputLabel}>To Win Amount:</Text>
                <TextInput
                  style={styles.customInput}
                  autoFocus
                  value={customDraft}
                  onChangeText={setCustomDraft}
                  placeholder="0"
                  placeholderTextColor="#666666"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={applyCustom} style={styles.dropdownItem}><Text style={styles.dropdownItemText}>Apply amount</Text></TouchableOpacity>
                <TouchableOpacity onPress={closeOdds} style={styles.dropdownItem}><Text style={styles.dropdownItemText}>Cancel</Text></TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Raise Details */}
      {raiseAmt > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Raise Details</Text>
          
          <View style={styles.betRow}>
            <Text style={styles.betText}>NEW OFFER</Text>
            <Text style={styles.betAmount}>${raiseAmt.toFixed(2)}</Text>
            <Text style={styles.betText}>ODDS</Text>
            <Text style={styles.betOdds}>{oddsRatio}</Text>
          </View>

          {/* Show "I bet $X to win $Y" if odds are not 1:1 */}
          {oddsRatio !== '1:1' && (
            <View style={styles.oddsInfoBox}>
              <Text style={styles.oddsInfoText}>
                I bet ${raiseAmt.toFixed(2)} to win ${stakeB.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Combined settlement explanations */}
          <View style={styles.settlementSection}>
            <Text style={styles.settlementText}>
              You receive ${matchPrizeMoney.toFixed(2)} + <Text style={styles.highlightText}>${raisePrizeMoney.toFixed(2)}</Text> if: {perspective.viewerLoseText}
            </Text>
            <Text style={styles.settlementText}>
              You lose ${matchAmt.toFixed(2)} + <Text style={styles.highlightText}>${raiseAmt.toFixed(2)}</Text> if: {perspective.viewerWinText}
            </Text>
            {offer.nullSituationText && (
              <Text style={styles.settlementText}>
                You get your Held funds back if: {offer.nullSituationText}
              </Text>
            )}
          </View>

          {/* Money disclosure - new format */}
          <View style={styles.moneySection}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Stake Amount</Text>
              <Text style={styles.breakdownValue}>${raiseAmt.toFixed(2)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Good Faith Deposit</Text>
              <Text style={styles.breakdownValue}>${raiseDetails.deposit.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>TOTAL Held NOW</Text>
              <Text style={styles.totalValue}>= ${raiseDetails.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Balance info */}
      {availableBalance !== null && (matchAmt > 0 || raiseAmt > 0) && (
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Available Balance: ${availableBalance.toFixed(2)}</Text>
          {availableBalance < totalCharged && (
            <Text style={styles.balanceError}>
              Insufficient balance. Need ${totalCharged.toFixed(2)}
            </Text>
          )}
        </View>
      )}

      {/* Disclaimer - shows total hold (match + raise) */}
      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          We'll hold ${(matchDetails.total + raiseDetails.total).toFixed(2)} and return your additional ${(matchDetails.deposit + raiseDetails.deposit).toFixed(2)} Good-Faith Deposit when the offer is resolved. That's how we guarantee everyone plays fair. <Text accessibilityRole="link" onPress={() => navigation.navigate('FAQ', { topic: 'deposit' })} style={{textDecorationLine: 'underline'}}>Learn more…</Text>
        </Text>
      </View>

      {/* Place Button with total amount */}
      <TouchableOpacity
        style={[styles.placeButton, (confirming || (availableBalance !== null && availableBalance < totalCharged) || raiseAmt <= 0) && styles.placeButtonDisabled]}
        onPress={handlePlace}
        disabled={confirming || (availableBalance !== null && availableBalance < totalCharged) || raiseAmt <= 0}
      >
        {confirming ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <>
            <Text style={styles.placeButtonText}>Match & Raise</Text>
            <Text style={styles.placeButtonAmount}>${totalCharged.toFixed(2)}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Commission line - shows total commission */}
      <Text style={styles.commissionLine}>
        Commission: ${(matchDetails.commission + raiseDetails.commission).toFixed(2)} (charged now)
      </Text>

      {/* Warning */}
      <Text style={styles.warningText}>
        Once you've placed the Offer, it cannot be canceled.
      </Text>

      {/* Alternative actions */}
      <View style={styles.alternativeLinks}>
        <TouchableOpacity
          style={styles.alternativeLink}
          onPress={() => navigation.navigate('MatchPartially', { offerId: offer.offerId })}
        >
          <Text style={styles.alternativeLinkText}>Match Partially</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.alternativeLink}
          onPress={() => navigation.navigate('BetAgainst', { offerId: offer.offerId })}
        >
          <Text style={styles.alternativeLinkText}>Bet Against</Text>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  readOnlySection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  readOnlyLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  breakdownSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  raiseInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  amountInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  raiseInput: {
    flex: 1,
  },
  oddsButtonInline: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  oddsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  oddsInfoBox: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  oddsInfoText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    minWidth: 250,
    maxWidth: '80%',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  customInputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  customInputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  customInput: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  settlementText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    marginBottom: 8,
  },
  highlightText: {
    color: '#FFD700',
    fontWeight: '700',
  },
  moneySection: {
    marginTop: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 8,
  },
  totalSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  balanceInfo: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceError: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
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
    opacity: 0.5,
  },
  placeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  placeButtonAmount: {
    fontSize: 20,
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
});
