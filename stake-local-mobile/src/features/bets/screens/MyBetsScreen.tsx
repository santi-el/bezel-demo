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
import { apiClient } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Bet } from '../../../models/Bet';
import { Offer } from '../../../models/Offer';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyBetsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [bets, setBets] = useState<Bet[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadMyBets();
    }, [])
  );

  const loadMyBets = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      
      // Load both offers and legacy bets
      const [allOffers, allBets] = await Promise.all([
        apiClient.getOffers(),
        apiClient.getBets(),
      ]);
      
      // Filter offers by current user
      const userOffers = userId 
        ? allOffers.filter(o => o.creatorUserId === userId)
        : [];
      
      setOffers(userOffers);
      setBets(allBets);
    } catch (error) {
      console.error('Error loading my bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOfferItem = ({ item }: { item: Offer }) => (
    <TouchableOpacity
      style={styles.betCard}
      onPress={() => {
        if (item.status === 'MATCHED') {
          navigation.navigate('ActiveBet', { betId: item.offerId, offerId: item.offerId });
        } else {
          navigation.navigate('BetDetails', { betId: item.offerId, offerId: item.offerId });
        }
      }}
    >
      <View style={styles.betHeader}>
        <Text style={styles.betTitle}>{item.postTitle}</Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'OPEN' && styles.statusActive,
            item.status === 'MATCHED' && styles.statusMatched,
            item.status === 'SETTLED' && styles.statusCompleted,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.betDetails}>
        <Text style={styles.betAmount}>${item.stakeCreator}</Text>
        <Text style={styles.betOdds}>
          {item.oddsRatio === '1:1' ? '1:1' : `Odds: ${item.oddsRatio || '1:1'}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderBetItem = ({ item }: { item: Bet }) => (
    <TouchableOpacity
      style={styles.betCard}
      onPress={() => {
        if (item.status === 'active' || item.status === 'matched') {
          navigation.navigate('ActiveBet', { betId: item.id! });
        } else {
          navigation.navigate('BetDetails', { betId: item.id! });
        }
      }}
    >
      <View style={styles.betHeader}>
        <Text style={styles.betTitle}>{item.title}</Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'active' && styles.statusActive,
            item.status === 'matched' && styles.statusMatched,
            item.status === 'completed' && styles.statusCompleted,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.betDetails}>
        <Text style={styles.betAmount}>${item.stakeAmount}</Text>
        <Text style={styles.betOdds}>Odds: {item.odds}x</Text>
      </View>
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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No bets yet</Text>
            <Text style={styles.emptySubtext}>Create your first bet to get started</Text>
          </View>
        }
      />
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  statusActive: {
    backgroundColor: '#FFD700',
  },
  statusMatched: {
    backgroundColor: '#4CAF50',
  },
  statusCompleted: {
    backgroundColor: '#888888',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'capitalize',
  },
  betDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888888',
  },
});

