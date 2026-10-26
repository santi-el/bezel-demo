import { requestKey } from '../../../services/demo/runtime';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, matchQuote, calculateGFD, calculateCommission, calculateTotalHold } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer } from '../../../models/Offer';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  offerId: string;
};

export default function MatchOfferScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const operationKey = React.useRef(requestKey()).current;
  const { offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [matchSuccess, setMatchSuccess] = useState(false);
  const countdownAnimation = useRef(new Animated.Value(0)).current;

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

  const getMatchAmount = (): number => {
    if (!offer) return 0;
    return offer.remainingStakeMatcher;
  };

  const calculatePrizeMoney = (): number => {
    const stake = getMatchAmount();
    if (!offer || stake === 0) return 0;
    
    try { return matchQuote(offer, stake).prize; } catch { return 0; }
  };

  const getMatchDetails = () => {
    const stake = getMatchAmount();
    if (stake === 0) return { stake: 0, deposit: 0, commission: 0, total: 0, chargedNow: 0 };
    
    const deposit = calculateGFD(stake);
    const commission = calculateCommission(stake);
    const total = calculateTotalHold(stake);
    const chargedNow = total + commission;

    return { stake, deposit, commission, total, chargedNow };
  };

  const startCountdown = () => {
    setShowCountdown(true);
    setCountdown(20);
    countdownAnimation.setValue(0);
    Animated.timing(countdownAnimation,{toValue:1,duration:20000,useNativeDriver:false}).start();
  };
  useEffect(()=>{
    if(!showCountdown)return;
    let alive=true;
    const update=async()=>{
      try {
        const current=await apiClient.getOfferById(offerId);
        if(!alive)return;
        if(!current || current.status==='OPEN' || current.status==='CANCELLED' || current.status==='EXPIRED') {
          setShowCountdown(false);setConfirming(false);
          Alert.alert('Match Rejected','The match is no longer pending. Released funds are reflected in your wallet.');return;
        }
        setCountdown(Math.max(0,Math.ceil((Date.parse(current.acceptRejectDeadline||'')-Date.now())/1000)));
        if(current.status!=='MATCHED_PENDING_ACCEPT')setMatchSuccess(true);
      } catch(error) {if(alive){setShowCountdown(false);setConfirming(false);Alert.alert('Error',error instanceof Error?error.message:'Unable to refresh match');}}
    };
    void update();const timer=setInterval(()=>void update(),1000);
    return()=>{alive=false;clearInterval(timer);};
  },[showCountdown,offerId]);
  useEffect(()=>{
    if(!matchSuccess)return;
    const timer=setTimeout(()=>navigation.replace('ActiveBet',{betId:offerId,offerId}),1500);
    return()=>clearTimeout(timer);
  },[matchSuccess,offerId,navigation]);

  const handlePlace = async () => {
    if (!offer) return;

    const { stake, chargedNow } = getMatchDetails();
    
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
      await apiClient.matchOffer(offer.offerId, stake, operationKey);
      
      // Start the 20-second countdown
      startCountdown();
    } catch (error: any) {
      console.error('Error matching offer:', error);
      setConfirming(false);
      if (error.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert('Insufficient Balance', 'Please add funds to your wallet');
      } else {
        Alert.alert('Error', 'Failed to match offer. Please try again.');
      }
    }
  };

  // Show countdown screen after placing match
  if (showCountdown) {
    const circumference = 2 * Math.PI * 60; // radius = 60
    const progress = countdownAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, circumference],
    });

    return (
      <View style={styles.container}>
        <View style={styles.countdownContainer}>
          {matchSuccess ? (
            <>
              <View style={styles.successCircle}>
                <Text style={styles.successCheckmark}>✓</Text>
              </View>
              <Text style={styles.successTitle}>SUCCESS!</Text>
              <Text style={styles.successSubtitle}>Match confirmed. Game is ON!</Text>
            </>
          ) : (
            <>
              <View style={styles.countdownCircleContainer}>
                <View style={styles.countdownCircle}>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                </View>
                <Animated.View
                  style={[
                    styles.countdownProgress,
                    {
                      opacity: countdownAnimation.interpolate({inputRange:[0,1],outputRange:[1,0]}),
                    },
                  ]}
                />
              </View>
              <Text style={styles.countdownTitle}>Waiting for creator...</Text>
              <Text style={styles.countdownSubtitle}>
                The offer creator has {countdown} seconds to accept or reject.
              </Text>
              <Text style={styles.countdownHint}>
                If not rejected, the match will be automatically accepted.
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

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

  const { stake, deposit, commission, total, chargedNow } = getMatchDetails();
  const prizeMoney = calculatePrizeMoney();
  const oddsRatio = offer.oddsRatio || '1:1';
  const perspective = getOfferPerspective(offer, currentUserId); // Public view for matching

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Match Offer</Text>

      {/* I BET [stake] ODDS [odds] */}
      <View style={styles.betRow}>
        <Text style={styles.betText}>I BET</Text>
        <Text style={styles.betAmount}>${stake.toFixed(2)}</Text>
        <Text style={styles.betText}>ODDS</Text>
        <Text style={styles.betOdds}>{oddsRatio}</Text>
      </View>

      {/* Settlement explanations - using public perspective */}
      <View style={styles.settlementSection}>
        <Text style={styles.settlementText}>
          You receive ${prizeMoney.toFixed(2)} if: {perspective.viewerWinText}
        </Text>
        <Text style={styles.settlementText}>
          You lose ${stake.toFixed(2)} if: {perspective.viewerLoseText}
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
          onPress={() => navigation.navigate('MatchAndRaise', { offerId: offer.offerId })}
        >
          <Text style={styles.alternativeLinkText}>Match & Raise</Text>
        </TouchableOpacity>
        
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
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  countdownCircleContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  countdownCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  countdownProgress: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: '#4CAF50',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-90deg' }],
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFD700',
  },
  countdownTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  countdownSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  countdownHint: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  successCheckmark: {
    fontSize: 64,
    color: '#FFFFFF',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 16,
  },
  successSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

