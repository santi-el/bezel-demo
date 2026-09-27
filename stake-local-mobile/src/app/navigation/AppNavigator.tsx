import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { authService } from '../../services/auth/authService';

// Screens
import NearYouScreen from '../../features/bets/screens/NearYouScreen';
import NotificationsScreen from '../../features/notifications/screens/NotificationsScreen';
import WalletScreen from '../../features/wallet/screens/WalletScreen';
import ProfileScreen from '../../features/profile/screens/ProfileScreen';
import MyBetsScreen from '../../features/bets/screens/MyBetsScreen';
import MyOffersScreen from '../../features/offers/screens/MyOffersScreen';
import CreateBetScreen from '../../features/bets/screens/CreateBetScreen';
import CreateOfferScreen from '../../features/offers/screens/CreateOfferScreen';
import LoginScreen from '../../features/auth/screens/LoginScreen';
import RegisterScreen from '../../features/auth/screens/RegisterScreen';
import BetDetailsScreen from '../../features/bets/screens/BetDetailsScreen';
import MatchOfferScreen from '../../features/offers/screens/MatchOfferScreen';
import MatchPartiallyScreen from '../../features/offers/screens/MatchPartiallyScreen';
import MatchAndRaiseScreen from '../../features/offers/screens/MatchAndRaiseScreen';
import BetAgainstScreen from '../../features/offers/screens/BetAgainstScreen';
import ActiveBetScreen from '../../features/bets/screens/ActiveBetScreen';
import SettingsScreen from '../../features/profile/screens/SettingsScreen';
import FAQScreen from '../../features/profile/screens/FAQScreen';
import ContactScreen from '../../features/profile/screens/ContactScreen';
import FollowersScreen from '../../features/profile/screens/FollowersScreen';
import FollowingScreen from '../../features/profile/screens/FollowingScreen';
import UserProfileScreen from '../../features/profile/screens/UserProfileScreen';
import OnHoldBreakdownScreen from '../../features/wallet/screens/OnHoldBreakdownScreen';
import GoodFaithDepositBreakdownScreen from '../../features/wallet/screens/GoodFaithDepositBreakdownScreen';
import ResultsScreen from '../../features/offers/screens/ResultsScreen';
import SupportScreen from '../../features/profile/screens/SupportScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Login: undefined;
  Register: undefined;
  BetDetails: { betId: string; offerId?: string };
  MatchOffer: { offerId: string };
  MatchPartially: { offerId: string };
  MatchAndRaise: { offerId: string };
  BetAgainst: { offerId: string };
  ActiveBet: { betId: string; offerId?: string };
  CreateBet: undefined;
  CreateOffer: undefined;
  MyBets: undefined;
  MyOffers: undefined;
  Settings: undefined;
  FAQ: undefined;
  Contact: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  UserProfile: { userId: string };
  OnHoldBreakdown: undefined;
  GoodFaithDepositBreakdown: undefined;
  Results: { offerId: string };
  Support: { offerId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#FFFFFF',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#2a2a2a',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#888888',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="NearYou"
        component={NearYouScreen}
        options={{
          title: 'Near You',
          tabBarLabel: 'Near You',
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarLabel: 'Notifications',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: 'Wallet',
          tabBarLabel: 'Wallet',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'MainTabs' : 'Login'}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: '#000000',
          },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: 'Create Account' }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BetDetails"
          component={BetDetailsScreen}
          options={{ title: 'Bet Details' }}
        />
        <Stack.Screen
          name="MatchOffer"
          component={MatchOfferScreen}
          options={{ title: 'Match Offer' }}
        />
        <Stack.Screen
          name="MatchPartially"
          component={MatchPartiallyScreen}
          options={{ title: 'Match Partially' }}
        />
        <Stack.Screen
          name="MatchAndRaise"
          component={MatchAndRaiseScreen}
          options={{ title: 'Match & Raise' }}
        />
        <Stack.Screen
          name="BetAgainst"
          component={BetAgainstScreen}
          options={{ title: 'Bet Against' }}
        />
        <Stack.Screen
          name="ActiveBet"
          component={ActiveBetScreen}
          options={{ title: 'Active Bet' }}
        />
        <Stack.Screen
          name="CreateBet"
          component={CreateBetScreen}
          options={{ title: 'Create Bet' }}
        />
        <Stack.Screen
          name="CreateOffer"
          component={CreateOfferScreen}
          options={{ 
            title: 'Create Offer',
            headerLeft: () => null, // Prevent back button (will be removed via reset anyway)
          }}
        />
        <Stack.Screen
          name="MyBets"
          component={MyBetsScreen}
          options={{ title: 'My Bets' }}
        />
        <Stack.Screen
          name="MyOffers"
          component={MyOffersScreen}
          options={({ navigation }) => ({
            title: 'My Offers',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
                style={{ paddingHorizontal: 8 }}
              >
                <Text style={{ color: '#FFD700', fontSize: 16 }}>‹ Profile</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
        <Stack.Screen
          name="FAQ"
          component={FAQScreen}
          options={{ title: 'FAQ' }}
        />
        <Stack.Screen
          name="Contact"
          component={ContactScreen}
          options={{ title: 'Contact Us' }}
        />
        <Stack.Screen
          name="Followers"
          component={FollowersScreen}
          options={{ title: 'Followers' }}
        />
        <Stack.Screen
          name="Following"
          component={FollowingScreen}
          options={{ title: 'Following' }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name="OnHoldBreakdown"
          component={OnHoldBreakdownScreen}
          options={{ title: 'On Hold Breakdown' }}
        />
        <Stack.Screen
          name="GoodFaithDepositBreakdown"
          component={GoodFaithDepositBreakdownScreen}
          options={{ title: 'Good-Faith Deposit Breakdown' }}
        />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{ title: 'Confirm Result' }}
        />
        <Stack.Screen
          name="Support"
          component={SupportScreen}
          options={{ title: 'Report a Problem' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

