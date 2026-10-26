import { useScreenRefresh } from '../../../services/demo/useScreenRefresh';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ViewStyle,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';
import { apiClient, AppNotification } from '../../../services/api/client';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refresh = async () => { setRefreshing(true); try { await loadNotifications(true); } finally { setRefreshing(false); } };

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  useScreenRefresh(silent => loadNotifications(silent));

  const loadNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const notifs = await apiClient.getNotifications();
      setLoadError(null);
      setNotifications(notifs);
    } catch (error) {
      setLoadError('Unable to load updates. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    try {
      await apiClient.markNotificationRead(notification.id);
      setNotifications(prev=>prev.map(n=>n.id===notification.id?{...n,read:true}:n));
      if(notification.offerId) {
        const offer=await apiClient.getOfferById(notification.offerId);
        if(!offer) {Alert.alert('Offer unavailable','This offer is no longer available.');return;}
        navigation.navigate(['MATCHED','MATCHED_PENDING_ACCEPT','DISPUTED','SETTLED'].includes(offer.status)?'ActiveBet':'BetDetails',{betId:offer.offerId,offerId:offer.offerId});
      }
    } catch(error) {Alert.alert('Error',error instanceof Error?error.message:'Unable to open notification');}

  };

  const handleMatchNotice = async (item: AppNotification) => {
    try {
      const offerId = await apiClient.getNotificationMatch(item.id);
      await apiClient.markNotificationRead(item.id);
      navigation.navigate('MatchOffer', {offerId});
    } catch (error) {
      Alert.alert('Offer unavailable', error instanceof Error ? error.message : 'Unable to open offer');
    } finally { await loadNotifications(true); }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins < 1 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const getNotificationStyle = (notification: AppNotification) => {
    const baseStyle: ViewStyle[] = [styles.notificationItem];
    
    // Color coding based on notification color
    switch (notification.color) {
      case 'green':
        baseStyle.push(styles.greenNotification);
        break;
      case 'yellow':
        baseStyle.push(styles.yellowNotification);
        break;
      case 'red':
        baseStyle.push(styles.redNotification);
        break;
      default:
        if (!notification.read) {
          baseStyle.push(styles.unreadItem);
        }
    }
    
    return baseStyle;
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const isOpponentResult = item.type === 'opponent_result';
    
    return (
      <TouchableOpacity
        style={[getNotificationStyle(item), {borderRadius: 12, marginBottom: 12, padding: 18, opacity: item.read ? 0.8 : 1}]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <Text style={[
            styles.notificationTitle,
            item.color === 'green' && styles.greenText,
          ]}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <Text style={styles.notificationTime}>{formatTime(item.createdAt)} · {new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        {item.type === 'offer_raised' && (item.canMatch ? (
          <TouchableOpacity style={styles.verifyButton} onPress={() => handleMatchNotice(item)}><Text style={styles.verifyButtonText}>Match</Text></TouchableOpacity>
        ) : <Text style={{color: '#AAAAAA', marginLeft: 8, maxWidth: 100}}>{item.offerStatus?.replaceAll('_', ' ')} · View details</Text>)}
        {isOpponentResult && item.offerId && (
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => {
              navigation.navigate('Results' as any, { offerId: item.offerId });
            }}
          >
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>
        )}
        {!item.read && !isOpponentResult && <View style={styles.unreadDot} />}
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
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={<View style={{marginBottom: 20}}><Text style={{color: '#FFFFFF', fontSize: 24, fontWeight: '700'}}>Your activity</Text><Text style={{color: '#AAAAAA', marginTop: 6}}>Matches, results and updates in one place</Text>{loadError && <TouchableOpacity onPress={refresh}><Text style={{color: '#FFD700', paddingVertical: 12}}>{loadError}</Text></TouchableOpacity>}</View>}
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, {paddingBottom: 40}]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll receive notifications when your offers are matched or when there's activity on your bets.
            </Text>
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
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  unreadItem: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  greenNotification: {
    backgroundColor: '#0a2a0a',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  yellowNotification: {
    backgroundColor: '#1f1a00',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  redNotification: {
    backgroundColor: '#2a0a0a',
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  greenText: {
    color: '#4CAF50',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888888',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
    marginLeft: 12,
  },
  verifyButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
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
    textAlign: 'center',
  },
});

