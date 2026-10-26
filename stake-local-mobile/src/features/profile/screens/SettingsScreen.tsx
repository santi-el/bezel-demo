import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';
import { engine } from '../../../services/demo/runtime';
import { Account } from '../../../domain/demo';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';

export default function SettingsScreen() {
  const [notifications, setNotifications] = React.useState(true);
  const [locationTracking, setLocationTracking] = React.useState(true);

  const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [accounts,setAccounts]=React.useState<Account[]>([]);
  const [userId,setUserId]=React.useState<string>();
  React.useEffect(()=>{engine.snapshot().then(s=>{setAccounts(s.accounts);setUserId(s.sessionId);const a=s.accounts.find(a=>a.id===s.sessionId);if(a){setNotifications(a.notifications);setLocationTracking(a.location);}}).catch(e=>Alert.alert('Error',e.message));},[]);
  const preference=async (key:'notifications'|'location',value:boolean)=>{try{if(!userId)return;await engine.preferences(userId,{[key]:value});if(key==='notifications')setNotifications(value);else setLocationTracking(value);}catch(e){Alert.alert('Error',e instanceof Error?e.message:'Unable to save preference');}};
  const switchAccount=async(id:string)=>{try{await engine.switchAccount(id);navigation.reset({index:0,routes:[{name:'MainTabs'}]});}catch(e){Alert.alert('Error',e instanceof Error?e.message:'Unable to switch account');}};
  const reset=()=>Alert.alert('Reset local demo?', 'This deletes all local accounts, wagers, ledger history and reports, then restores the demo accounts.',[{text:'Cancel',style:'cancel'},{text:'Reset',style:'destructive',onPress:()=>void engine.reset().then(()=>navigation.reset({index:0,routes:[{name:'Login'}]})).catch(e=>Alert.alert('Error',e.message))}]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Receive notifications about bets</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={value=>void preference('notifications',value)}
            trackColor={{ false: '#2a2a2a', true: '#FFD700' }}
            thumbColor={notifications ? '#000000' : '#888888'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Location Tracking</Text>
            <Text style={styles.settingDescription}>Allow location-based bet sorting</Text>
          </View>
          <Switch
            value={locationTracking}
            onValueChange={value=>void preference('location',value)}
            trackColor={{ false: '#2a2a2a', true: '#FFD700' }}
            thumbColor={locationTracking ? '#000000' : '#888888'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.settingDescription}>Local demo: simulated funds, demo locations, and in-app activity only.</Text>
        {accounts.filter(a=>a.id!==userId).map(a=><TouchableOpacity key={a.id} style={styles.settingButton} onPress={()=>void switchAccount(a.id)}><Text style={styles.settingButtonText}>Switch to {a.username}</Text></TouchableOpacity>)}
        <TouchableOpacity style={styles.settingButton} onPress={reset}><Text style={styles.settingButtonText}>Reset Local Demo</Text></TouchableOpacity>
        
        <TouchableOpacity style={styles.settingButton} onPress={()=>Alert.alert("Local demo", "Demo accounts use shortcuts. No password is collected or stored.")}>
          <Text style={styles.settingButtonText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={()=>Alert.alert("Privacy Settings", "Demo data is saved on this device and can be cleared with Reset Local Demo. Other users of this device can switch accounts.")}>
          <Text style={styles.settingButtonText}>Privacy Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={()=>Alert.alert("Local demo", "Individual account deletion is not available in this demo. Reset Local Demo clears all local accounts and wagers after confirmation.")}>
          <Text style={styles.settingButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888888',
  },
  settingButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  settingButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});








