import { useScreenRefresh } from '../../../services/demo/useScreenRefresh';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, matchQuote } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { locationService } from '../../../services/location/locationService';
import { Offer } from '../../../models/Offer';
import { Bet } from '../../../models/Bet';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NearYouScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => { setRefreshing(true); try { await loadOffers(true); } finally { setRefreshing(false); } };
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadOffers();
    }, [])
  );

  useScreenRefresh(silent => loadOffers(silent));

  const loadOffers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const userId = await authService.getUserId();
      setCurrentUserId(userId);
      const [allOffers, allBets] = await Promise.all([
        apiClient.getOffers(),
        apiClient.getBets(), // Legacy support
      ]);
      
      // Filter only OPEN offers, include user's own offers
      const openOffers = allOffers.filter(o => o.status === 'OPEN' && o.creatorUserId !== userId);
      
      // Sort: user's own offers first, then by distance
      const sortedOffers = [...openOffers].sort((a, b) => {
        // User's offers first
        if (a.creatorUserId === userId && b.creatorUserId !== userId) return -1;
        if (a.creatorUserId !== userId && b.creatorUserId === userId) return 1;
        // Then sort by distance
        return a.distanceMeters - b.distanceMeters;
      });
      const sortedBets = [...allBets].sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      setError(null);
      setOffers(sortedOffers);
      setBets(sortedBets.filter(b => b.userId !== userId));
    } catch (error) {
      setError('Could not load offers. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  const getCTALabel = (offer: Offer): string => {
    const quote = matchQuote(offer, offer.remainingStakeMatcher);
    return `Match $${quote.matcherStake.toFixed(2)} • Profit $${quote.creatorStake.toFixed(2)}`;
  };

  const renderOfferItem = ({ item: offer }: { item: Offer }) => {
    // Use public perspective for NearYou (shows falseSituationText as title)
    const perspective = getOfferPerspective(offer, currentUserId);
    const isOwnOffer = offer.creatorUserId === currentUserId;
    
    return (
      <View style={[
        styles.offerCard,
        isOwnOffer && styles.ownOfferCard,
      ]}>
        <Text style={{color: '#AAAAAA', marginBottom: 10}}>@{offer.creatorName || 'Local player'}{offer.isSample ? ' · Demo offer' : ''}</Text>
        {isOwnOffer && (
          <View style={styles.ownOfferBadge}>
            <Text style={styles.ownOfferBadgeText}>YOUR OFFER</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate('BetDetails', { betId: offer.offerId, offerId: offer.offerId })}
        >
          <View style={styles.offerHeader}>
            <Text style={[styles.offerPostTitle, isOwnOffer && styles.ownOfferTitle]}>
              {offer.isSample ? offer.postTitle : perspective.viewerTitle}
              {offer.isSample && <Text style={{fontSize: 14, color: '#CCCCCC'}}>{'\n'}{perspective.viewerTitle}</Text>}
            </Text>
            <Text style={styles.offerDistance}>{offer.distanceMeters} m · simulated</Text>
          </View>
        </TouchableOpacity>
        <Text style={{color: '#CCCCCC', marginBottom: 12}}>Odds {offer.oddsRatio} · {offer.expiryDate ? `Expires ${new Date(offer.expiryDate).toLocaleString()}` : 'No limit'}</Text>
        {!isOwnOffer && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('MatchOffer', { offerId: offer.offerId })}
          >
            <Text style={styles.ctaButtonText}>{getCTALabel(offer)}</Text>
          </TouchableOpacity>
        )}
        {isOwnOffer && (
          <View style={styles.ownOfferActions}>
            <Text style={styles.ownOfferStatus}>Open • Waiting for match</Text>
          </View>
        )}
      </View>
    );
  };

  const renderBetItem = ({ item }: { item: Bet }) => (
    <TouchableOpacity
      style={styles.betCard}
      onPress={() => navigation.navigate('BetDetails', { betId: item.id! })}
    >
      <View style={styles.betHeader}>
        <Text style={styles.betTitle}>{item.title}</Text>
        <Text style={styles.betDistance}>
          {locationService.formatDistance(item.distance || 0)}
        </Text>
      </View>
      <View style={styles.betDetails}>
        <Text style={styles.betAmount}>${item.stakeAmount}</Text>
        <Text style={styles.betOdds}>Odds: {item.odds}x</Text>
      </View>
      <Text style={styles.betStatus} numberOfLines={1}>
        {item.description || 'No description'}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  const combinedData = [
    ...offers.map(o => ({ type: 'offer' as const, data: o })),
    ...bets.map(b => ({ type: 'bet' as const, data: b })),
  ];

  return (
    <View style={styles.container}>
      <FlatList
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={<View style={{marginBottom: 16}}><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('MyOffers')} style={{alignSelf: 'flex-end', borderColor: '#FFD700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12}}><Text style={{color: '#FFD700', fontWeight: '600'}}>My Offers</Text></TouchableOpacity><Text style={{color: '#FFFFFF', fontSize: 22, fontWeight: '700'}}>Around your neighborhood</Text><Text style={{color: '#AAAAAA', marginTop: 6}}>Local demo · {offers.length} open offers · Profit before commission</Text>{error && <TouchableOpacity onPress={refresh}><Text style={{color: '#FFD700', paddingVertical: 12}}>{error}</Text></TouchableOpacity>}</View>}
        data={combinedData}
        renderItem={({ item }) => 
          item.type === 'offer' 
            ? renderOfferItem({ item: item.data as Offer })
            : renderBetItem({ item: item.data as Bet })
        }
        keyExtractor={(item, index) => 
          item.type === 'offer' 
            ? (item.data as Offer).offerId 
            : (item.data as Bet).id || `bet_${index}`
        }
        contentContainerStyle={[styles.listContent, {paddingBottom: insets.bottom + 110}]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No offers from other people nearby. Your offers are in My Offers.</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={[styles.newButton, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('CreateOffer')}
      >
        <Text style={styles.newButtonText}>NEW+</Text>
      </TouchableOpacity>
    </View>
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
  listContent: {
    padding: 16,
  },
  createBetButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createBetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  betCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  betTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
  },
  betDistance: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
  },
  betDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  betAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  betOdds: {
    fontSize: 14,
    color: '#888888',
  },
  betStatus: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#888888',
  },
  newButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 18, // 1.5x original (12 * 1.5 = 18)
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  newButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offerCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  offerHeader: {
    marginBottom: 12,
  },
  offerPostTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  offerDistance: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
  },
  ctaButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  ownOfferCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: '#1f1a00',
  },
  ownOfferBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  ownOfferBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  ownOfferTitle: {
    color: '#FFD700',
  },
  ownOfferActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  ownOfferStatus: {
    fontSize: 12,
    color: '#FFD700',
    fontStyle: 'italic',
  },
});

