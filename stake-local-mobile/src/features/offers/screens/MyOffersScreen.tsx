import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer } from '../../../models/Offer';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

export default function MyOffersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [showOddsModal, setShowOddsModal] = useState(false);
  const [selectedOdds, setSelectedOdds] = useState<OddsOption | null>(null);
  const [customStakeB, setCustomStakeB] = useState('');
  const [showPostToFeedModal, setShowPostToFeedModal] = useState(false);
  const [postingOffer, setPostingOffer] = useState<Offer | null>(null);
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0); // For countdown timer

  useFocusEffect(
    React.useCallback(() => {
      loadMyOffers();
      // Set up timer to update every second for pending accept offers
      const interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }, [])
  );

  const loadMyOffers = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      setCurrentUserId(userId);
      
      if (!userId) return;

      const allOffers = await apiClient.getOffers();
      const userOffers = allOffers.filter(
        o => o.creatorUserId === userId || o.matcherUserId === userId
      );
      
      // Sort: OPEN at top (highlighted in yellow), then MATCHED_PENDING_ACCEPT (urgent), then MATCHED (green), then MATCHED&RAISED (red), then others
      const sortedOffers = [...userOffers].sort((a, b) => {
        // OPEN offers first
        if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
        if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
        // MATCHED_PENDING_ACCEPT next (urgent)
        if (a.status === 'MATCHED_PENDING_ACCEPT' && b.status !== 'MATCHED_PENDING_ACCEPT' && b.status !== 'OPEN') return -1;
        if (a.status !== 'MATCHED_PENDING_ACCEPT' && a.status !== 'OPEN' && b.status === 'MATCHED_PENDING_ACCEPT') return 1;
        // MATCHED next
        if (a.status === 'MATCHED' && b.status !== 'MATCHED' && b.status !== 'OPEN' && b.status !== 'MATCHED_PENDING_ACCEPT') return -1;
        if (a.status !== 'MATCHED' && a.status !== 'OPEN' && a.status !== 'MATCHED_PENDING_ACCEPT' && b.status === 'MATCHED') return 1;
        // Sort by createdAt (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setOffers(sortedOffers);
    } catch (error) {
      console.error('Error loading my offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffer = async (offer: Offer) => {
    if (offer.status !== 'OPEN') {
      Alert.alert('Error', 'You can only delete offers that haven\'t been matched.');
      return;
    }

    Alert.alert(
      'Delete Offer',
      'Are you sure you want to delete this offer? You will get your stake and Good-Faith Deposit back (commission is non-refundable).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Mock: refund stake + GFD
              const refund = offer.totalHold; // stake + GFD (commission not refunded)
              await apiClient.refundOffer(offer.offerId);
              
              // Reload offers
              await loadMyOffers();
              
              Alert.alert('Success', `Offer deleted. $${refund.toFixed(2)} has been returned to your balance.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete offer. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleChangeOdds = (offer: Offer) => {
    if (offer.status !== 'OPEN') {
      Alert.alert('Error', 'You can only change odds on offers that haven\'t been matched.');
      return;
    }

    setEditingOffer(offer);
    // Set current odds
    const currentOdds = ODDS_OPTIONS.find(o => o.ratio === offer.oddsRatio) || ODDS_OPTIONS[0];
    setSelectedOdds(currentOdds);
    if (offer.stakeB && offer.stakeB !== offer.stakeCreator) {
      setCustomStakeB(offer.stakeB.toString());
    } else {
      setCustomStakeB('');
    }
    setShowOddsModal(true);
  };

  const handleUpdateOdds = async () => {
    if (!editingOffer || !selectedOdds) return;

    try {
      const stakeBValue = selectedOdds.ratio === 'CUSTOM'
        ? parseFloat(customStakeB) || editingOffer.stakeCreator
        : selectedOdds.calculateStakeB(editingOffer.stakeCreator);

      await apiClient.updateOfferOdds(editingOffer.offerId, selectedOdds.ratio, stakeBValue);
      await loadMyOffers();
      setShowOddsModal(false);
      setEditingOffer(null);
      Alert.alert('Success', 'Odds updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update odds. Please try again.');
    }
  };

  const handlePostToFeed = (offer: Offer) => {
    setPostingOffer(offer);
    setPostText('');
    setPostImage(null);
    setShowPostToFeedModal(true);
  };

  const handleConfirmPostToFeed = async () => {
    if (!postingOffer) return;

    // Mock: post to feed
    Alert.alert('Success', 'Posted to your profile feed!');
    setShowPostToFeedModal(false);
    setPostingOffer(null);
    setPostText('');
  };

  const getOfferColor = (offer: Offer): string => {
    if (offer.status === 'OPEN') return '#FFD700'; // Yellow
    if (offer.status === 'MATCHED_PENDING_ACCEPT') return '#FF9800'; // Orange (urgent)
    if (offer.status === 'MATCHED') return '#4CAF50'; // Green
    if (offer.parentOfferId) return '#FF4444'; // Red (matched & raised)
    return '#888888';
  };

  const getRemainingSeconds = (offer: Offer): number => {
    if (!offer.acceptRejectDeadline) return 0;
    const deadline = new Date(offer.acceptRejectDeadline).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((deadline - now) / 1000));
  };

  const handleInviteFriends = () => {
    Alert.alert(
      'Invite Friends',
      'This feature will allow you to invite friends to join this offer. Coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleResolve = (offer: Offer) => {
    navigation.navigate('Results', { offerId: offer.offerId });
  };

  const renderOfferItem = ({ item }: { item: Offer }) => {
    const perspective = getOfferPerspective(item, currentUserId);
    const bgColor = getOfferColor(item);
    const isOpen = item.status === 'OPEN' && item.creatorUserId === currentUserId;
    // Active offers: MATCHED status, and user is either creator or matcher
    const isActive = item.status === 'MATCHED' && !item.parentOfferId && 
                     (item.creatorUserId === currentUserId || item.matcherUserId === currentUserId);

    return (
      <TouchableOpacity
        style={[
          styles.offerCard,
          isOpen && styles.openOfferCard,
          isActive && styles.activeOfferCard,
        ]}
        onPress={() => {
          if (item.status === 'MATCHED') {
            navigation.navigate('ActiveBet', { betId: item.offerId, offerId: item.offerId });
          } else {
            navigation.navigate('BetDetails', { betId: item.offerId, offerId: item.offerId });
          }
        }}
      >
        <View style={styles.offerHeader}>
          <Text style={[
            styles.offerTitle,
            isOpen && styles.openOfferTitle,
            isActive && styles.activeOfferTitle,
          ]}>
            {perspective.viewerTitle}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: bgColor },
            ]}
          >
            <Text style={[styles.statusText, (isOpen || isActive) && { color: '#000000' }]}>
              {item.status}
              {item.parentOfferId ? ' & RAISED' : ''}
            </Text>
          </View>
        </View>
        
        <View style={styles.offerDetails}>
          <Text style={[
            styles.offerAmount,
            isOpen && styles.openOfferText,
          ]}>
            ${item.stakeCreator}
          </Text>
          <Text style={[
            styles.offerOdds,
            isOpen && styles.openOfferText,
          ]}>
            {item.oddsRatio === '1:1' ? '1:1' : `Odds: ${item.oddsRatio || '1:1'}`}
          </Text>
        </View>

        {/* Open Offer Actions */}
        {isOpen && (
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePostToFeed(item)}
            >
              <Text style={styles.actionButtonText}>Post to Feed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleChangeOdds(item)}
            >
              <Text style={styles.actionButtonText}>Change Odds</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Alert.prompt(
                  'Raise Amount',
                  `Current stake: $${item.stakeCreator.toFixed(2)}\nEnter new total stake amount:`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Raise',
                      onPress: async (newAmount?: string) => {
                        if (!newAmount) return;
                        const amount = parseFloat(newAmount);
                        if (isNaN(amount) || amount <= item.stakeCreator) {
                          Alert.alert('Error', 'New amount must be greater than current stake');
                          return;
                        }
                        try {
                          await apiClient.raiseOfferAmount(item.offerId, amount);
                          await loadMyOffers();
                          Alert.alert('Success', 'Offer amount raised successfully');
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to raise amount');
                        }
                      },
                    },
                  ],
                  'plain-text'
                );
              }}
            >
              <Text style={styles.actionButtonText}>Raise Amount</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteOffer(item)}
            >
              <Text style={styles.deleteButtonText}>Take Down</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active (MATCHED) Offer Actions */}
        {isActive && (
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePostToFeed(item)}
            >
              <Text style={styles.actionButtonText}>Post to Feed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.inviteButton]}
              onPress={handleInviteFriends}
            >
              <Text style={styles.actionButtonText}>Invite Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Alert.prompt(
                  'Raise Amount',
                  `Current stake: $${item.stakeCreator.toFixed(2)}\nEnter new total stake amount:`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Raise',
                      onPress: async (newAmount?: string) => {
                        if (!newAmount) return;
                        const amount = parseFloat(newAmount);
                        if (isNaN(amount) || amount <= item.stakeCreator) {
                          Alert.alert('Error', 'New amount must be greater than current stake');
                          return;
                        }
                        try {
                          await apiClient.raiseOfferAmount(item.offerId, amount);
                          await loadMyOffers();
                          Alert.alert('Success', 'Offer amount raised successfully');
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to raise amount');
                        }
                      },
                    },
                  ],
                  'plain-text'
                );
              }}
            >
              <Text style={styles.actionButtonText}>Raise Amount</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.resolveButton]}
              onPress={() => handleResolve(item)}
            >
              <Text style={styles.resolveButtonText}>Resolve</Text>
            </TouchableOpacity>
          </View>
        )}

        {(item.status === 'MATCHED_PENDING_ACCEPT' || (item.status === 'MATCHED' && item.parentOfferId)) && (
          <View style={styles.pendingActions}>
            {item.status === 'MATCHED_PENDING_ACCEPT' && (
              <>
                <Text style={styles.timerText}>
                  {getRemainingSeconds(item) > 0 
                    ? `Time remaining: ${getRemainingSeconds(item)}s` 
                    : 'Time expired - auto-accepting...'}
                </Text>
                {getRemainingSeconds(item) > 0 && (
                  <View style={styles.timerButtons}>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.acceptButton]}
                      onPress={async () => {
                        try {
                          await apiClient.acceptMatch(item.offerId);
                          await loadMyOffers();
                          Alert.alert('Success', 'Match accepted!');
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to accept match');
                        }
                      }}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timerButton, styles.rejectButton]}
                      onPress={async () => {
                        try {
                          await apiClient.rejectMatch(item.offerId);
                          await loadMyOffers();
                          Alert.alert('Success', 'Match rejected. Offer reopened.');
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to reject match');
                        }
                      }}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
        {item.status === 'MATCHED' && item.parentOfferId && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => {
              // Handle accept for matched & raised
              Alert.alert('Accept Offer', 'This would accept the matched & raised offer');
            }}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
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
        data={offers}
        renderItem={renderOfferItem}
        keyExtractor={(item) => item.offerId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No offers yet</Text>
            <Text style={styles.emptySubtext}>Create your first offer to get started</Text>
          </View>
        }
      />

      {/* Odds Change Modal */}
      <Modal
        visible={showOddsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOddsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Odds</Text>
            {selectedOdds && editingOffer && (
              <>
                <View style={styles.oddsList}>
                  {ODDS_OPTIONS.map((odds) => {
                    const stakeBForOption = odds.ratio === 'CUSTOM'
                      ? parseFloat(customStakeB) || editingOffer.stakeCreator
                      : odds.calculateStakeB(editingOffer.stakeCreator);
                    const displayText = odds.ratio === 'CUSTOM'
                      ? 'CUSTOM'
                      : `${odds.label} TO WIN $${stakeBForOption.toFixed(2)}`;
                    
                    return (
                      <TouchableOpacity
                        key={odds.ratio}
                        style={[
                          styles.oddsOption,
                          selectedOdds.ratio === odds.ratio && styles.oddsOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedOdds(odds);
                          if (odds.ratio !== 'CUSTOM') {
                            setCustomStakeB('');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.oddsOptionText,
                            selectedOdds.ratio === odds.ratio && styles.oddsOptionTextSelected,
                          ]}
                        >
                          {displayText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedOdds?.ratio === 'CUSTOM' && (
                  <View style={styles.customInputContainer}>
                    <Text style={styles.customInputLabel}>To Win Amount:</Text>
                    <TextInput
                      style={styles.customInput}
                      value={customStakeB}
                      onChangeText={setCustomStakeB}
                      placeholder="0"
                      placeholderTextColor="#666666"
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowOddsModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleUpdateOdds}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                      Update
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Post to Feed Modal */}
      <Modal
        visible={showPostToFeedModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPostToFeedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Post to Feed</Text>
            <TextInput
              style={styles.postTextInput}
              value={postText}
              onChangeText={setPostText}
              placeholder="Say something about this offer..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => {
                // Mock: select image
                Alert.alert('Select Image', 'This would open image picker');
              }}
            >
              <Text style={styles.imageButtonText}>
                {postImage ? 'Change Image' : '+ Add Image (Optional)'}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowPostToFeedModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmPostToFeed}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Post
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  offerCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  offerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  offerAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  offerOdds: {
    fontSize: 14,
    color: '#888888',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#FF4444',
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
  inviteButton: {
    backgroundColor: '#4CAF50',
  },
  resolveButton: {
    backgroundColor: '#FF6B6B',
  },
  resolveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  openOfferCard: {
    backgroundColor: '#1f1a00',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  openOfferTitle: {
    color: '#FFD700',
    fontWeight: '700',
  },
  openOfferText: {
    color: '#FFD700',
  },
  activeOfferCard: {
    backgroundColor: '#0a1a0a',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  activeOfferTitle: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  pendingActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  timerButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectButton: {
    backgroundColor: '#FF4444',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  oddsList: {
    maxHeight: 300,
  },
  oddsOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  oddsOptionSelected: {
    backgroundColor: '#2a2a2a',
  },
  oddsOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  oddsOptionTextSelected: {
    color: '#FFD700',
    fontWeight: '700',
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
  postTextInput: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  imageButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  imageButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#FFD700',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextPrimary: {
    color: '#000000',
  },
});
