import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../../services/api/client';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';
import { Transaction } from '../../../models/Transaction';
import { Offer } from '../../../models/Offer';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WalletScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [onHold, setOnHold] = useState<number | null>(null);
  const [goodFaithDeposit, setGoodFaithDeposit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadWalletData();
    }, [])
  );

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const [balance, hold, gfd, txs] = await Promise.all([
        apiClient.getAvailableBalance(),
        apiClient.getOnHoldBalance(),
        apiClient.getGoodFaithDeposit(),
        apiClient.getTransactions(),
      ]);
      setAvailableBalance(balance);
      setOnHold(hold);
      setGoodFaithDeposit(gfd);
      setTransactions(
        txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = () => {
    Alert.prompt(
      'Add Funds',
      'Enter amount to add:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (value?: string) => {
            if (!value) return;
            const amount = parseFloat(value);
            if (isNaN(amount) || amount <= 0) {
              Alert.alert('Error', 'Please enter a valid amount');
              return;
            }
            try {
              await apiClient.addFunds(amount);
              await loadWalletData();
              Alert.alert('Success', `Added $${amount.toFixed(2)}`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to add funds');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleWithdraw = () => {
    Alert.prompt(
      'Withdraw Funds',
      'Enter amount to withdraw:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async (value?: string) => {
            if (!value) return;
            const amount = parseFloat(value);
            if (isNaN(amount) || amount <= 0) {
              Alert.alert('Error', 'Please enter a valid amount');
              return;
            }
            try {
              await apiClient.withdrawFunds(amount);
              await loadWalletData();
              Alert.alert('Success', `Withdrew $${amount.toFixed(2)}`);
            } catch (error: any) {
              if (error.message === 'INSUFFICIENT_BALANCE') {
                Alert.alert('Error', 'Insufficient balance');
              } else {
                Alert.alert('Error', error.message || 'Failed to withdraw');
              }
            }
          },
        },
      ],
      'plain-text'
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          ${availableBalance !== null ? availableBalance.toFixed(2) : '0.00'}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => navigation.navigate('OnHoldBreakdown')}
        >
          <Text style={styles.statLabel}>On Hold</Text>
          <Text style={styles.statValue}>
            ${onHold !== null ? onHold.toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.statSubtext}>Tap to view breakdown</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.statCard}
          onPress={() => navigation.navigate('GoodFaithDepositBreakdown')}
        >
          <Text style={styles.statLabel}>Good-Faith Deposit</Text>
          <Text style={styles.statValue}>
            ${goodFaithDeposit !== null ? goodFaithDeposit.toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.statSubtext}>Tap to view breakdown</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleAddFunds}>
          <Text style={styles.primaryButtonText}>Add Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleWithdraw}>
          <Text style={styles.secondaryButtonText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Wallet Information</Text>
        <Text style={styles.infoText}>
          • Available balance can be used for new bets{'\n'}
          • On hold funds are locked in active bets{'\n'}
          • Good-faith deposits ensure bet commitment{'\n'}
          • Funds are released after bet resolution
        </Text>
      </View>

      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          transactions.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={styles.transactionItem}
              onPress={() => handleTransactionPress(tx)}
            >
              <View style={styles.transactionHeader}>
                <Text style={styles.transactionType}>{tx.type.toUpperCase()}</Text>
                <Text
                  style={[
                    styles.transactionAmount,
                    tx.amount >= 0 ? styles.positive : styles.negative,
                  ]}
                >
                  {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
              {tx.description && (
                <Text style={styles.transactionDescription}>{tx.description}</Text>
              )}
              <Text style={styles.transactionDate}>
                {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
              </Text>
              {(tx.balanceBefore !== undefined && tx.balanceAfter !== undefined) && (
                <Text style={styles.transactionBalance}>
                  Balance: ${tx.balanceBefore.toFixed(2)} → ${tx.balanceAfter.toFixed(2)}
                </Text>
              )}
              {tx.type === 'hold' && (
                <Text style={styles.viewDetailsHint}>Tap to view breakdown →</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Transaction Breakdown Modal */}
      <Modal
        visible={showBreakdownModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBreakdownModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transaction Breakdown</Text>
            
            {selectedOffer && selectedTransaction && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Offer Title:</Text>
                  <Text style={styles.breakdownValue}>{selectedOffer.postTitle}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Stake Amount:</Text>
                  <Text style={styles.breakdownValue}>${selectedOffer.stakeCreator.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Good-Faith Deposit:</Text>
                  <Text style={styles.breakdownValue}>${selectedOffer.goodFaithDeposit.toFixed(2)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={styles.breakdownTotalLabel}>Total Hold:</Text>
                  <Text style={styles.breakdownTotalValue}>${selectedOffer.totalHold.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Commission:</Text>
                  <Text style={styles.breakdownValue}>${selectedOffer.commission.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Date Created:</Text>
                  <Text style={styles.breakdownValue}>
                    {new Date(selectedOffer.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Status:</Text>
                  <Text style={[
                    styles.breakdownValue,
                    selectedOffer.status === 'OPEN' && styles.statusOpen,
                    selectedOffer.status === 'MATCHED' && styles.statusMatched,
                  ]}>
                    {selectedOffer.status}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.viewOfferButton}
                  onPress={() => {
                    setShowBreakdownModal(false);
                    if (selectedOffer.status === 'MATCHED') {
                      navigation.navigate('ActiveBet', { betId: selectedOffer.offerId, offerId: selectedOffer.offerId });
                    } else {
                      navigation.navigate('BetDetails', { betId: selectedOffer.offerId, offerId: selectedOffer.offerId });
                    }
                  }}
                >
                  <Text style={styles.viewOfferButtonText}>View Offer Details</Text>
                </TouchableOpacity>
              </>
            )}

            {!selectedOffer && selectedTransaction && (
              <View style={styles.noOfferInfo}>
                <Text style={styles.noOfferText}>
                  Transaction details for: {selectedTransaction.description}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowBreakdownModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  async function handleTransactionPress(tx: Transaction) {
    // For hold transactions, try to find the associated offer
    if (tx.type === 'hold' || tx.type === 'offer' || tx.type === 'fee') {
      setSelectedTransaction(tx);
      
      // Try to find offer from description or by looking at recent offers
      try {
        const offers = await apiClient.getOffers();
        // Find an offer that matches the transaction time
        const txDate = new Date(tx.createdAt);
        const matchingOffer = offers.find(o => {
          const offerDate = new Date(o.createdAt);
          // Within 5 seconds of each other
          return Math.abs(offerDate.getTime() - txDate.getTime()) < 5000;
        });
        
        if (matchingOffer) {
          setSelectedOffer(matchingOffer);
        } else {
          setSelectedOffer(null);
        }
      } catch (error) {
        setSelectedOffer(null);
      }
      
      setShowBreakdownModal(true);
    }
  }
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
  balanceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  statSubtext: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
  },
  actionsSection: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  transactionsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
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
  },
  transactionAmount: {
    fontSize: 16,
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
    marginBottom: 4,
  },
  transactionBalance: {
    fontSize: 12,
    color: '#888888',
  },
  viewDetailsHint: {
    fontSize: 11,
    color: '#FFD700',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#888888',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalRow: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  statusOpen: {
    color: '#FFD700',
  },
  statusMatched: {
    color: '#4CAF50',
  },
  viewOfferButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  viewOfferButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  noOfferInfo: {
    padding: 16,
    alignItems: 'center',
  },
  noOfferText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  closeModalButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});






