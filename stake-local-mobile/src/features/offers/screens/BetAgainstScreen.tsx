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
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, opposingOfferQuote, calculateGFD, calculateCommission, calculateTotalHold } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer } from '../../../models/Offer';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  offerId: string;
};

export default function BetAgainstScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const operationKey = React.useRef(requestKey()).current;
  const { offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
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
        setOffer(offerData);
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

  const getStakeValue = (): number => {
    if (!stakeAmount) return 0;
    const amount = Number(stakeAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return amount;
  };

  const calculatePrizeMoney = (stake: number): number => {
    if (!offer || stake === 0) return 0;
    
    try { return opposingOfferQuote(offer,stake).prize; } catch {return 0;}
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
    if (!offer || !stakeAmount) {
      Alert.alert('Error', 'Please enter a stake amount');
      return;
    }

    const stake = getStakeValue();
    
    if (stake <= 0) {
      Alert.alert('Error', 'Please enter a valid stake amount');
      return;
    }

    const { chargedNow } = getMatchDetails(stake);
    
    if (availableBalance !== null && availableBalance < chargedNow) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${chargedNow.toFixed(2)} but only have $${availableBalance.toFixed(2)}. Redirecting to add funds...`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => Alert.alert('Stripe Checkout', 'This would open Stripe checkout in production') },
        ]
      );
      return;
    }

    try {
      setConfirming(true);
      
      await apiClient.betAgainst(offer.offerId, stake, operationKey);

      Alert.alert('Success', 'Your bet against offer has been posted!', [
        { text: 'OK', onPress: () => navigation.navigate('MyBets') },
      ]);
    } catch (error: any) {
      console.error('Error creating bet against:', error);
      if (error.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert('Insufficient Balance', 'Please add funds to your wallet');
      } else {
        Alert.alert('Error', 'Failed to create bet against offer. Please try again.');
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

  const stake = getStakeValue();
  const { deposit, commission, total, chargedNow } = getMatchDetails(stake);
  const prizeMoney = calculatePrizeMoney(stake);
  const oddsRatio = (offer.oddsRatio || '1:1').split(':').reverse().join(':');
  const perspective = getOfferPerspective(offer, currentUserId); // Public view for bet against

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Bet Against</Text>

      {/* Stake Amount Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Your Stake Amount:</Text>
        <TextInput
          style={styles.amountInput}
          value={stakeAmount}
          onChangeText={setStakeAmount}
          placeholder="0"
          keyboardType="decimal-pad"
          placeholderTextColor="#666666"
        />
      </View>

      {/* Preview when stake entered */}
      {stake > 0 && (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              You're creating a new offer with the opposite side of the original offer.
            </Text>
          </View>

          {/* I BET [stake] ODDS [odds] */}
          <View style={styles.betRow}>
            <Text style={styles.betText}>I BET</Text>
            <Text style={styles.betAmount}>${stake.toFixed(2)}</Text>
            <Text style={styles.betText}>ODDS</Text>
            <Text style={styles.betOdds}>{oddsRatio}</Text>
          </View>

          {/* Settlement explanations (opposite side) */}
          <View style={styles.settlementSection}>
            <Text style={styles.settlementText}>
              You receive ${prizeMoney.toFixed(2)} if: {perspective.viewerLoseText}
            </Text>
            <Text style={styles.settlementText}>
              You lose ${stake.toFixed(2)} if: {perspective.viewerWinText}
            </Text>
            {perspective.viewerNullText && (
              <Text style={styles.settlementText}>
                If: {perspective.viewerNullText} — you get your money back.
              </Text>
            )}
          </View>

          {/* Money disclosure - new format */}
          <View style={styles.moneySection}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Stake Amount</Text>
              <Text style={styles.breakdownValue}>${stake.toFixed(2)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Good Faith Deposit</Text>
              <Text style={styles.breakdownValue}>${deposit.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>TOTAL Held NOW</Text>
              <Text style={styles.totalValue}>= ${total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              We'll hold ${total.toFixed(2)} and return your additional ${deposit.toFixed(2)} Good-Faith Deposit when the offer is resolved. That's how we guarantee everyone plays fair. <Text accessibilityRole="link" onPress={() => navigation.navigate('FAQ', { topic: 'deposit' })} style={{textDecorationLine: 'underline'}}>Learn more…</Text>
            </Text>
          </View>

          {/* Balance info */}
          {availableBalance !== null && (
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Available Balance: ${availableBalance.toFixed(2)}</Text>
              {availableBalance < chargedNow && (
                <Text style={styles.balanceError}>
                  Insufficient balance. Need ${chargedNow.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Place Button */}
          <TouchableOpacity
            style={[styles.placeButton, (confirming || (availableBalance !== null && availableBalance < chargedNow)) && styles.placeButtonDisabled]}
            onPress={handlePlace}
            disabled={confirming || (availableBalance !== null && availableBalance < chargedNow)}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.placeButtonText}>Post Bet Against</Text>
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
        </>
      )}
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
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
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
  infoBox: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  infoText: {
    fontSize: 14,
    color: '#FFD700',
    lineHeight: 20,
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});

