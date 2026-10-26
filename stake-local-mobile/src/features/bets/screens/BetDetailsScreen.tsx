import { amountPrompt } from '../../../components/AmountPrompt';
import React, { useState } from 'react';
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
import { apiClient, offerPreview } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { locationService } from '../../../services/location/locationService';
import { Offer } from '../../../models/Offer';
import { Bet } from '../../../models/Bet';
import { User } from '../../../models/User';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type RouteParams = {
  betId: string;
  offerId?: string; // Support offerId param
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BetDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { betId, offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicPreview, setPublicPreview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      setCurrentUserId(userId);
      
      // Try offerId first, then betId
      const idToUse = offerId || betId;
      
      if (!idToUse) {
        setLoading(false);
        return;
      }

      // Try to load as Offer first
      const offerData = await apiClient.getOfferById(idToUse);
      if (offerData && ['MATCHED','MATCHED_PENDING_ACCEPT','DISPUTED','SETTLED'].includes(offerData.status)) { navigation.replace('ActiveBet',{betId:offerData.offerId,offerId:offerData.offerId}); }
      if (offerData) {
        setOffer(offerData);
        const creatorData = await apiClient.getUserById(offerData.creatorUserId);
        setCreator(creatorData);
        setPublicPreview(false);
      } else {
        // Fallback to legacy Bet
        const betData = await apiClient.getBetById(idToUse);
        if (betData) {
          setBet(betData);
          const userData = await apiClient.getUserById(betData.userId || '');
          setCreator(userData);
        }
      }
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDetails();
    }, [betId, offerId])
  );

  const preview = offer ? offerPreview(offer, currentUserId, publicPreview) : null;
  const isOwner = offer?.creatorUserId === currentUserId;
  const guardSelfMatch = () => {
    if (!isOwner) return false;
    Alert.alert('Your offer', 'You cannot match your own offer.');
    return true;
  };

  const getMatchStake = (): number => {
    if (offer) {
      return offer.remainingStakeMatcher;
    }
    if (bet) {
      return bet.stakeAmount || 0;
    }
    return 0;
  };

  const getMatchCTALabel = (): string => {
    const matchStake = getMatchStake();
    if (!offer) return `Match $${matchStake.toFixed(2)}`;
    
    if (offer.oddsRatio === '1:1') {
      return `Match $${matchStake.toFixed(2)} 1:1`;
    }
    
    const stakeB = offer.stakeCreator;
    return `Match $${matchStake.toFixed(2)} to win $${stakeB.toFixed(2)}`;
  };

  const handleMatch = () => {
    if (guardSelfMatch()) return;
    if(offer?.status !== 'OPEN') {Alert.alert('Offer unavailable', 'This offer is no longer open.');return;}
    const idToUse = offerId || betId;
    if (!idToUse) {
      Alert.alert('Error', 'Offer ID is missing');
      return;
    }
    navigation.navigate('MatchOffer', { offerId: idToUse });
  };

  const handleMatchForLess = () => {
    if (guardSelfMatch()) return;
    if(offer?.status !== 'OPEN') {Alert.alert('Offer unavailable', 'This offer is no longer open.');return;}
    const idToUse = offerId || betId;
    if (!idToUse) {
      Alert.alert('Error', 'Offer ID is missing');
      return;
    }
    navigation.navigate('MatchPartially', { offerId: idToUse });
  };

  const handleMatchAndRaise = () => {
    if (guardSelfMatch()) return;
    if(offer?.status !== 'OPEN') {Alert.alert('Offer unavailable', 'This offer is no longer open.');return;}
    const idToUse = offerId || betId;
    if (!idToUse) {
      Alert.alert('Error', 'Offer ID is missing');
      return;
    }
    navigation.navigate('MatchAndRaise', { offerId: idToUse });
  };

  const handleBetAgainst = () => {
    if(offer?.status !== 'OPEN') {Alert.alert('Offer unavailable', 'This offer is no longer open.');return;}
    const idToUse = offerId || betId;
    if (!idToUse) {
      Alert.alert('Error', 'Offer ID is missing');
      return;
    }
    navigation.navigate('BetAgainst', { offerId: idToUse });
  };

  const handleRaise = () => {
    if(!offer)return;
    if(offer.status !== 'OPEN'){navigation.navigate('ActiveBet',{betId:offer.offerId,offerId:offer.offerId});return;}
    amountPrompt('Raise Amount',`Current stake: $${offer.stakeCreator.toFixed(2)}\nEnter new total stake amount:`,[
      {text:'Cancel',style:'cancel'},
      {text:'Raise',onPress:async value=>{try{await apiClient.raiseOfferAmount(offer.offerId,Number(value)); await loadDetails();}catch(e){Alert.alert('Error',e instanceof Error?e.message:'Unable to raise offer');}}}
    ]);

  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!offer && !bet) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Offer not found</Text>
      </View>
    );
  }

  // Owner view (creator viewing their own offer)
  if (preview?.isOwner && offer) {
    const perspective = preview!;
    const matchStake = getMatchStake();
    const gfd = offer.goodFaithDeposit;
    const commission = offer.commission;
    const holdAmount = offer.totalHold;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.postTitle}>{perspective.viewerTitle}</Text>
          <Text style={styles.ownerLabel}>Your Offer</Text>
          {__DEV__ && (
            <Text style={styles.debugLabel}>Viewing as: Owner</Text>
          )}
          {offer.distanceMeters > 0 && (
            <Text style={styles.distance}>{offer.distanceMeters} m</Text>
          )}
          <Text style={styles.status}>Status: {offer.status}</Text>
          {offer.remainingStakeMatcher < offer.stakeCreator && (
            <Text style={styles.remainingText}>
              Remaining: ${offer.remainingStakeMatcher.toFixed(2)} / ${offer.stakeCreator.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>
            You receive ${perspective.receive.toFixed(2)} if: {perspective.viewerWinText}
          </Text>
          <Text style={styles.descriptionText}>
            You lose ${perspective.lose.toFixed(2)} if: {perspective.viewerLoseText}
          </Text>
          {perspective.viewerNullText && (
            <Text style={styles.descriptionText}>
              If: {perspective.viewerNullText} — you get your money back.
            </Text>
          )}
        </View>

        <View style={styles.actionBox}>
          <TouchableOpacity style={styles.raiseButton} onPress={handleRaise}>
            <Text style={styles.raiseButtonText}>Raise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBetAgainst}>
            <Text style={styles.secondaryButtonText}>Bet Against</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.breakdownBox}>
          <Text style={styles.breakdownText}>
            Hold: ${holdAmount.toFixed(2)} (stake + GFD)
          </Text>
          <Text style={styles.breakdownText}>
            Good-Faith Deposit: ${gfd.toFixed(2)}
          </Text>
          <Text style={styles.breakdownText}>
            Commission: ${commission.toFixed(2)} (charged now)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewAsPublicLink}
          onPress={() => setPublicPreview(true)}
        >
          <Text style={styles.viewAsPublicText}>View as public</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Public view (non-creator viewing offer)
  if (offer) {
    const perspective = preview!;
    const matchStake = getMatchStake();
    const prizeMoney = perspective.receive;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.postTitle}>{perspective.viewerTitle}</Text>
          <Text style={styles.vsText}>vs {creator?.username || 'Unknown'}</Text>
          {__DEV__ && (
            <Text style={styles.debugLabel}>Viewing as: Public</Text>
          )}
          {offer.distanceMeters > 0 && (
            <Text style={styles.distance}>{offer.distanceMeters} m</Text>
          )}
        </View>

        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>
            You receive ${prizeMoney.toFixed(2)} if: {perspective.viewerWinText}
          </Text>
          <Text style={styles.descriptionText}>
            You lose ${perspective.lose.toFixed(2)} if: {perspective.viewerLoseText}
          </Text>
          {perspective.viewerNullText && (
            <Text style={styles.descriptionText}>
              If: {perspective.viewerNullText} — you get your money back.
            </Text>
          )}
        </View>

        <View style={styles.actionBox}>
          <TouchableOpacity style={styles.matchButton} onPress={handleMatch}>
            <Text style={styles.matchButtonText}>{getMatchCTALabel()}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleMatchForLess}>
            <Text style={styles.secondaryButtonText}>Match Partially</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleMatchAndRaise}>
            <Text style={styles.secondaryButtonText}>Match & Raise</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.betAgainstButton} onPress={handleBetAgainst}>
          <Text style={styles.betAgainstButtonText}>Bet Against</Text>
        </TouchableOpacity>

        {/* Ask to change odds and message creator buttons */}
        <View style={styles.creatorActions}>
          <TouchableOpacity 
            style={styles.creatorActionButton}
            onPress={() => {
              Alert.alert('Ask to Change Odds', `This would send a request to ${creator?.username || 'the creator'} to change the odds. (Mock)`);
            }}
          >
            <Text style={styles.creatorActionButtonText}>Ask to Change Odds</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.creatorActionButton}
            onPress={() => {
              Alert.alert('Message Creator', `This would open a chat with ${creator?.username || 'the creator'}. (Mock)`);
            }}
          >
            <Text style={styles.creatorActionButtonText}>Message Creator</Text>
          </TouchableOpacity>
        </View>
        {isOwner && (
          <TouchableOpacity style={styles.viewAsPublicLink} onPress={() => setPublicPreview(false)}>
            <Text style={styles.viewAsPublicText}>Back to owner view</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // Legacy Bet view (fallback)
  if (bet) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.postTitle}>{bet.title}</Text>
          <Text style={styles.vsText}>vs {creator?.username || 'Unknown'}</Text>
          {bet.distance && (
            <Text style={styles.distance}>
              {locationService.formatDistance(bet.distance)} away
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{bet.description || 'No description'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.matchButton} onPress={handleMatch}>
            <Text style={styles.matchButtonText}>Match Bet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return null;
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
  },
  header: {
    marginBottom: 24,
  },
  postTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  vsText: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  ownerLabel: {
    fontSize: 12,
    color: '#FFD700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  distance: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  status: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  remainingText: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 4,
  },
  descriptionSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 12,
  },
  actionBox: {
    marginBottom: 16,
  },
  matchButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  matchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  raiseButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  raiseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  betAgainstButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 8,
  },
  betAgainstButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  creatorActions: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    gap: 12,
  },
  creatorActionButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  creatorActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  breakdownBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  breakdownText: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  viewAsPublicLink: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  viewAsPublicText: {
    fontSize: 14,
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
  },
  actions: {
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  debugLabel: {
    fontSize: 10,
    color: '#FFD700',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
