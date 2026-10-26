import React, { useState, useEffect } from 'react';
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
import { Offer } from '../../../models/Offer';
import { Transaction } from '../../../models/Transaction';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GoodFaithDepositBreakdownScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      if (!userId) return;

      const userOffers = await apiClient.getReservationOffers();

      setOffers(userOffers);

      // Load GFD-related transactions (type 'gfd_refund' or has gfdDelta)
      const allTransactions = await apiClient.getTransactions();
      const gfdTransactions = allTransactions.filter(
        t => t.type === 'gfd_refund' || (t.gfdDelta !== undefined && t.gfdDelta !== 0)
      );
      setTransactions(gfdTransactions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error loading breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOfferItem = ({ item }: { item: Offer }) => {
    const userId = offers.length > 0 ? '' : ''; // Use state instead
    return (
      <TouchableOpacity
        style={styles.offerItem}
        onPress={() => {
          if (['MATCHED','MATCHED_PENDING_ACCEPT','DISPUTED','SETTLED'].includes(item.status)) {
            navigation.navigate('ActiveBet', { betId: item.offerId, offerId: item.offerId });
          } else {
            navigation.navigate('BetDetails', { betId: item.offerId, offerId: item.offerId });
          }
        }}
      >
        <View style={styles.offerHeader}>
          <Text style={styles.offerTitle}>{item.postTitle}</Text>
          <Text style={styles.offerAmount}>${(item.viewerDeposit ?? item.goodFaithDeposit).toFixed(2)}</Text>
        </View>
        <Text style={styles.offerDetails}>
          Stake: ${(item.viewerStake ?? item.stakeCreator).toFixed(2)} • {item.status}
        </Text>
        <Text style={styles.offerDetails}>
          Will be refunded when offer is resolved
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isPositive = (item.gfdDelta !== undefined && item.gfdDelta < 0) || item.type === 'gfd_refund';
    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionType}>
            {item.type === 'gfd_refund' ? 'GFD REFUND' : item.type.toUpperCase()}
          </Text>
          {item.gfdDelta !== undefined && (
            <Text style={[styles.transactionAmount, isPositive ? styles.positive : styles.negative]}>
              {item.gfdDelta < 0 ? '+' : '-'}${Math.abs(item.gfdDelta).toFixed(2)}
            </Text>
          )}
        </View>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>
          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <View style={styles.transactionBalance}>
          {item.gfdBalanceBefore !== undefined && item.gfdBalanceAfter !== undefined && (
            <Text style={styles.balanceLabel}>
              GFD: ${item.gfdBalanceBefore.toFixed(2)} → ${item.gfdBalanceAfter.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[
          { type: 'offers', title: 'Offers with GFD Held', data: offers },
          { type: 'transactions', title: 'GFD Transaction History', data: transactions },
        ]}
        renderItem={({ item: section }) => {
          if (section.type === 'offers') {
            if (section.data.length === 0) {
              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.emptyText}>No open offers</Text>
                </View>
              );
            }
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {(section.data as Offer[]).map((offer: Offer) => (
                  <View key={offer.offerId}>
                    {renderOfferItem({ item: offer })}
                  </View>
                ))}
              </View>
            );
          } else {
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.data.length === 0 ? (
                  <Text style={styles.emptyText}>No refunds yet</Text>
                ) : (
                  (section.data as Transaction[]).map((tx: Transaction) => (
                    <View key={tx.id}>
                      {renderTransaction({ item: tx })}
                    </View>
                  ))
                )}
              </View>
            );
          }
        }}
        keyExtractor={(item, index) => `section_${index}`}
        contentContainerStyle={styles.listContent}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
  },
  offerItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  offerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
  },
  offerAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  offerDetails: {
    fontSize: 12,
    color: '#888888',
  },
  transactionItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#FF6B6B',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
  },
  transactionBalance: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#888888',
  },
});
