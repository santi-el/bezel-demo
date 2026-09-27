import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { Offer } from '../../../models/Offer';
import { User } from '../../../models/User';
import { getOfferPerspective } from '../../../models/OfferUtils';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  betId: string;
  offerId?: string;
};

interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
}

// Mock messages for the chat section
const mockMessages: Message[] = [
  { id: '1', userId: 'opponent', text: "This is about to get crazy 🔥", timestamp: '2 min ago' },
  { id: '2', userId: 'user', text: "Your team has no chance!", timestamp: '1 min ago' },
  { id: '3', userId: 'opponent', text: "Dare you to raise another 100 💰", timestamp: 'Just now' },
];

export default function ActiveBetScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { betId, offerId } = route.params as RouteParams;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [opponent, setOpponent] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [offerId, betId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      setCurrentUserId(userId);

      // Try to load offer first (new system), fall back to bet
      const offerData = await apiClient.getOfferById(offerId || betId);
      
      if (offerData) {
        setOffer(offerData);
        
        // Determine who is the opponent
        const isCreator = offerData.creatorUserId === userId;
        const opponentId = isCreator ? offerData.matcherUserId : offerData.creatorUserId;
        
        // Load users
        if (userId) {
          const userData = await apiClient.getUserById(userId);
          setCurrentUser(userData);
        }
        
        if (opponentId) {
          const oppData = await apiClient.getUserById(opponentId);
          setOpponent(oppData);
        }
      }
    } catch (error) {
      console.error('Error loading active offer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message: Message = {
      id: String(Date.now()),
      userId: 'user',
      text: newMessage.trim(),
      timestamp: 'Just now',
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleRaise = () => {
    if (offer) {
      navigation.navigate('MatchAndRaise', { offerId: offer.offerId });
    }
  };

  const handleInviteFriends = () => {
    Alert.alert(
      'Invite Friends',
      'This feature will allow you to invite friends to join this offer. Coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleResolve = () => {
    if (offer) {
      navigation.navigate('Results' as any, { offerId: offer.offerId });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Offer not found</Text>
      </View>
    );
  }

  const isCreator = offer.creatorUserId === currentUserId;
  const perspective = getOfferPerspective(offer, currentUserId);
  const userStake = isCreator ? offer.stakeCreator : offer.stakeCreator; // Same stake for both
  const opponentStake = userStake;
  const prizeMoney = userStake + opponentStake;

  // Determine result status
  const userConfirmed = isCreator ? offer.creatorOutcome : offer.matcherOutcome;
  const opponentConfirmed = isCreator ? offer.matcherOutcome : offer.creatorOutcome;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* VS Split Screen */}
      <View style={styles.vsContainer}>
        {/* User Side */}
        <View style={styles.playerSide}>
          <View style={styles.playerAvatar}>
            <Text style={styles.playerInitial}>
              {currentUser?.username?.charAt(0).toUpperCase() || 'Y'}
            </Text>
          </View>
          <Text style={styles.playerName}>YOU</Text>
          <Text style={styles.playerUsername}>@{currentUser?.username || 'you'}</Text>
          <View style={styles.stakeBox}>
            <Text style={styles.stakeLabel}>Win</Text>
            <Text style={styles.stakeAmount}>${prizeMoney.toFixed(0)}</Text>
          </View>
          <Text style={styles.situationText} numberOfLines={3}>
            {perspective.viewerWinText}
          </Text>
        </View>

        {/* VS Divider */}
        <View style={styles.vsDivider}>
          <View style={styles.vsLine} />
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.vsLine} />
        </View>

        {/* Opponent Side */}
        <View style={styles.playerSide}>
          <View style={[styles.playerAvatar, styles.opponentAvatar]}>
            <Text style={styles.playerInitial}>
              {opponent?.username?.charAt(0).toUpperCase() || 'O'}
            </Text>
          </View>
          <Text style={styles.playerName}>{opponent?.username || 'Opponent'}</Text>
          <Text style={styles.playerUsername}>@{opponent?.username || 'opponent'}</Text>
          <View style={styles.stakeBox}>
            <Text style={styles.stakeLabel}>Win</Text>
            <Text style={[styles.stakeAmount, styles.opponentAmount]}>${prizeMoney.toFixed(0)}</Text>
          </View>
          <Text style={styles.situationText} numberOfLines={3}>
            {perspective.viewerLoseText}
          </Text>
        </View>
      </View>

      {/* Odds Breakdown */}
      <View style={styles.oddsSection}>
        <Text style={styles.oddsSectionTitle}>Odds Breakdown</Text>
        <View style={styles.oddsRow}>
          <Text style={styles.oddsLabel}>Your Stake:</Text>
          <Text style={styles.oddsValue}>${userStake.toFixed(2)}</Text>
        </View>
        <View style={styles.oddsRow}>
          <Text style={styles.oddsLabel}>Opponent's Stake:</Text>
          <Text style={styles.oddsValue}>${opponentStake.toFixed(2)}</Text>
        </View>
        <View style={styles.oddsRow}>
          <Text style={styles.oddsLabel}>Odds:</Text>
          <Text style={styles.oddsValue}>{offer.oddsRatio || '1:1'}</Text>
        </View>
        <View style={[styles.oddsRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Prize:</Text>
          <Text style={styles.totalValue}>${prizeMoney.toFixed(2)}</Text>
        </View>
      </View>

      {/* Result Verification Status */}
      {(userConfirmed || opponentConfirmed) && (
        <View style={styles.resultStatusSection}>
          {userConfirmed && !opponentConfirmed && (
            <View style={styles.waitingBox}>
              <Text style={styles.waitingText}>⏳ Waiting for your opponent to verify result</Text>
            </View>
          )}
          {opponentConfirmed && !userConfirmed && (
            <View style={styles.verifyBox}>
              <Text style={styles.verifyText}>Your opponent has chosen a result!</Text>
              <TouchableOpacity style={styles.verifyButton} onPress={handleResolve}>
                <Text style={styles.verifyButtonText}>Verify Result</Text>
              </TouchableOpacity>
            </View>
          )}
          {userConfirmed && opponentConfirmed && offer.status === 'SETTLED' && (
            <View style={styles.settledBox}>
              <Text style={styles.settledText}>✓ Offer Settled</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleRaise}>
          <Text style={styles.actionButtonText}>Raise</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.inviteButton]} onPress={handleInviteFriends}>
          <Text style={styles.actionButtonText}>Invite Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Messages Section */}
      <View style={styles.messagesSection}>
        <Text style={styles.messagesSectionTitle}>Chat</Text>
        <View style={styles.messagesList}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.userId === 'user' ? styles.userMessageRow : styles.opponentMessageRow,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  msg.userId === 'user' ? styles.userBubble : styles.opponentBubble,
                ]}
              >
                <Text style={styles.messageText}>{msg.text}</Text>
                <Text style={styles.messageTime}>{msg.timestamp}</Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Taunt your opponent..."
            placeholderTextColor="#666666"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resolve Button */}
      <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
        <Text style={styles.resolveButtonText}>Resolve</Text>
      </TouchableOpacity>
    </ScrollView>
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
  content: {
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingVertical: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  playerSide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  opponentAvatar: {
    backgroundColor: '#FF6B6B',
  },
  playerInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  playerUsername: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 12,
  },
  stakeBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  stakeLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  stakeAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  opponentAmount: {
    color: '#FF6B6B',
  },
  situationText: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  vsDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  vsLine: {
    width: 2,
    height: 40,
    backgroundColor: '#2a2a2a',
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  oddsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  oddsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  oddsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  oddsLabel: {
    fontSize: 14,
    color: '#888888',
  },
  oddsValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
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
  resultStatusSection: {
    marginBottom: 16,
  },
  waitingBox: {
    backgroundColor: '#1a1a00',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  waitingText: {
    fontSize: 14,
    color: '#FFD700',
    textAlign: 'center',
  },
  verifyBox: {
    backgroundColor: '#1a1a00',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  verifyText: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  settledBox: {
    backgroundColor: '#0a2a0a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  settledText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  inviteButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  messagesSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  messagesSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  messagesList: {
    marginBottom: 16,
  },
  messageRow: {
    marginBottom: 8,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  opponentMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  opponentBubble: {
    backgroundColor: '#2a2a2a',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  messageInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  resolveButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
