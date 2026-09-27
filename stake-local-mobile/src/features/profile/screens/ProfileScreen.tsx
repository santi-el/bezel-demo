import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authService } from '../../../services/auth/authService';
import { apiClient } from '../../../services/api/client';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FeedPost {
  id: string;
  type: 'offer' | 'offer_idea' | 'group_offer' | 'shared_offer';
  userId: string;
  username: string;
  avatar?: string;
  timestamp: string;
  text?: string;
  image?: string;
  offerId?: string;
  offerTitle?: string;
  offerStake?: number;
  offerOdds?: string;
  likes: number;
  comments: number;
  shares: number;
}

const mockFeedPosts: FeedPost[] = [
  {
    id: '1',
    type: 'offer',
    userId: 'dev_user_1',
    username: 'betmaster99',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    text: 'Just posted a new offer! Who thinks the Lakers will win tonight? 🏀',
    offerId: 'offer_4',
    offerTitle: 'Celtics win NBA Championship',
    offerStake: 200,
    offerOdds: '1:1',
    likes: 12,
    comments: 3,
    shares: 2,
  },
  {
    id: '2',
    type: 'offer_idea',
    userId: 'dev_user_1',
    username: 'betmaster99',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    text: 'Thinking about creating an offer: "Barcelona scores 3+ goals in the next match". What do you think?',
    likes: 8,
    comments: 5,
    shares: 1,
  },
  {
    id: '3',
    type: 'shared_offer',
    userId: 'dev_user_2',
    username: 'BoxDaddy',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    text: 'This looks interesting! 🔥',
    offerId: 'offer_1',
    offerTitle: 'Blue fighter wins the match',
    offerStake: 25,
    offerOdds: '1:1',
    likes: 15,
    comments: 7,
    shares: 4,
  },
  {
    id: '4',
    type: 'group_offer',
    userId: 'dev_user_1',
    username: 'betmaster99',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    text: 'Created a group offer with my friends! Join us if you want to bet on the Super Bowl 🏈',
    offerId: 'group_offer_1',
    offerTitle: 'Chiefs win Super Bowl',
    offerStake: 500,
    offerOdds: '1:1',
    likes: 25,
    comments: 12,
    shares: 8,
  },
  {
    id: '5',
    type: 'offer',
    userId: 'dev_user_1',
    username: 'betmaster99',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    text: 'My offer got matched! Let\'s see how this plays out 💪',
    image: 'https://via.placeholder.com/400x300',
    offerId: 'offer_5',
    offerTitle: 'Dodgers do not win World Series',
    offerStake: 100,
    offerOdds: '1:1',
    likes: 20,
    comments: 8,
    shares: 5,
  },
];

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [username, setUsername] = useState('betmaster99');
  const [score, setScore] = useState(1250);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>(mockFeedPosts);
  const [following, setFollowing] = useState(42);
  const [followers, setFollowers] = useState(128);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userId = await authService.getUserId();
      if (userId) {
        const user = await apiClient.getUserById(userId);
        if (user) {
          setUsername(user.username);
          setScore(user.score);
        }
      }
      const bal = await apiClient.getBalance();
      setBalance(bal);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const renderPost = ({ item }: { item: FeedPost }) => {
    const getPostTypeLabel = () => {
      switch (item.type) {
        case 'offer':
          return 'Posted Offer';
        case 'offer_idea':
          return 'Offer Idea';
        case 'group_offer':
          return 'Group Offer';
        case 'shared_offer':
          return 'Shared Offer';
        default:
          return '';
      }
    };

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.postHeaderInfo}>
            <Text style={styles.postUsername}>{item.username}</Text>
            <Text style={styles.postType}>{getPostTypeLabel()}</Text>
            <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>

        {item.text && (
          <Text style={styles.postText}>{item.text}</Text>
        )}

        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} />
        )}

        {item.offerId && (
          <TouchableOpacity
            style={styles.offerCard}
            onPress={() => {
              navigation.navigate('BetDetails', { betId: item.offerId!, offerId: item.offerId });
            }}
          >
            <Text style={styles.offerCardTitle}>{item.offerTitle}</Text>
            <View style={styles.offerCardDetails}>
              <Text style={styles.offerCardStake}>${item.offerStake}</Text>
              <Text style={styles.offerCardOdds}>{item.offerOdds}</Text>
            </View>
            {item.type === 'offer_idea' && (
              <TouchableOpacity style={styles.createButton}>
                <Text style={styles.createButtonText}>CREATE</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postAction}>
            <Text style={styles.postActionText}>❤️ {item.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postAction}>
            <Text style={styles.postActionText}>💬 {item.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postAction}>
            <Text style={styles.postActionText}>🔗 {item.shares}</Text>
          </TouchableOpacity>
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
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.score}>Score: {score}</Text>
        {balance !== null && (
          <Text style={styles.balance}>Balance: ${balance.toFixed(2)}</Text>
        )}

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('Following', { userId: 'dev_user_1' })}
          >
            <Text style={styles.statValue}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('Followers', { userId: 'dev_user_1' })}
          >
            <Text style={styles.statValue}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('MyOffers')}
          >
            <Text style={styles.headerButtonText}>My Offers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.headerButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedContent}
        ListHeaderComponent={
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>Feed</Text>
          </View>
        }
      />

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000000',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  score: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 4,
  },
  balance: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  headerButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  feedContent: {
    padding: 16,
  },
  feedHeader: {
    marginBottom: 16,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  postCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postType: {
    fontSize: 12,
    color: '#FFD700',
    textTransform: 'uppercase',
  },
  postTime: {
    fontSize: 12,
    color: '#888888',
  },
  postText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  offerCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  offerCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  offerCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerCardStake: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  offerCardOdds: {
    fontSize: 14,
    color: '#888888',
  },
  createButton: {
    backgroundColor: '#FFD700',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postActionText: {
    fontSize: 14,
    color: '#888888',
  },
  logoutButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    margin: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});
