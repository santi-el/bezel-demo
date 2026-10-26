import { requestKey } from '../../../services/demo/runtime';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, calculateOddsStake, calculateGFD, calculateCommission, calculateTotalHold, generatePostTitle } from '../../../services/api/client';
import { authService } from '../../../services/auth/authService';
import { locationService } from '../../../services/location/locationService';
import { Offer } from '../../../models/Offer';
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

type ExpiryOption = {
  label: string;
  value: number; // in minutes, -1 for forever
};

const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: '20 minutes', value: 20 },
  { label: '40 minutes', value: 40 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '5 hours', value: 300 },
  { label: '8 hours', value: 480 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
  { label: '2 days', value: 2880 },
  { label: '1 week', value: 10080 },
  { label: '1 month', value: 43200 },
  { label: 'No limit', value: -1 },
];

const getExpiryLabel = (minutes: number): string => {
  if (minutes === -1) return 'No limit';
  const option = EXPIRY_OPTIONS.find(o => o.value === minutes);
  if (option) return option.label;
  // Fallback for custom values
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} days`;
  return `${Math.floor(minutes / 10080)} weeks`;
};

export default function CreateOfferScreen() {
  const navigation = useNavigation<NavigationProp>();
  const operationKey = React.useRef(requestKey()).current;
  const [stakeA, setStakeA] = useState('');
  const [selectedOdds, setSelectedOdds] = useState<OddsOption | null>(ODDS_OPTIONS[0]); // Default to 1:1
  const [customStakeB, setCustomStakeB] = useState('');
  const [customDraft, setCustomDraft] = useState('');
  const [editingCustom, setEditingCustom] = useState(false);
  const closeOdds = () => { setEditingCustom(false); setShowOddsDropdown(false); };
  const applyCustom = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(customDraft.trim()) || Number(customDraft) <= 0) { Alert.alert('Invalid amount', 'Enter a positive amount with at most two decimals'); return; }
    setCustomStakeB(customDraft.trim()); setSelectedOdds(ODDS_OPTIONS.find(o => o.ratio === 'CUSTOM')!); closeOdds();
  };
  const [showOddsDropdown, setShowOddsDropdown] = useState(false);
  const [trueSituationText, setTrueSituationText] = useState('');
  const [falseSituationText, setFalseSituationText] = useState('');
  const [nullSituationText, setNullSituationText] = useState('');
  const [tieDisabled, setTieDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(-1); // No expiry by default
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadBalance();
    }, [])
  );

  useEffect(() => {
    let current=true;
    setGeneratingTitle(true);
    generatePostTitle(falseSituationText,false).then(title=>{if(current)setPostTitle(title);}).finally(()=>{if(current)setGeneratingTitle(false);});
    return ()=>{current=false;};
  }, [falseSituationText, tieDisabled]);

  const loadBalance = async () => {
    try {
      const balance = await apiClient.getAvailableBalance();
      setAvailableBalance(balance);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const calculateStakeB = (): number => {
    const stakeAValue = Number(stakeA) || 0;
    if (!selectedOdds || stakeAValue <= 0) return 0;
    
    if (selectedOdds.ratio === 'CUSTOM') {
      return Number(customStakeB) || 0;
    }
    
    try { return calculateOddsStake(stakeAValue, selectedOdds.ratio); } catch { return 0; }
  };

  const calculatePrizeMoney = (): number => {
    const stakeAValue = Number(stakeA) || 0;
    const stakeBValue = calculateStakeB();
    
    if (selectedOdds?.ratio === '1:1') {
      return stakeAValue + stakeAValue; // For 1:1, prize = stakeA + stakeA
    }
    
    return stakeAValue + stakeBValue; // For other odds, prize = stakeA + stakeB
  };

  const getCalculatedValues = () => {
    const stakeAValue = Number(stakeA) || 0;
    const stakeBValue = calculateStakeB();
    const prizeMoney = calculatePrizeMoney();
    const gfd = stakeAValue > 0 ? calculateGFD(stakeAValue) : 0;
    const commission = stakeAValue > 0 ? calculateCommission(stakeAValue) : 0;
    const holdAmount = stakeAValue > 0 ? calculateTotalHold(stakeAValue) : 0;
    const chargedNow = holdAmount + commission;

    return {
      stakeA: stakeAValue,
      stakeB: stakeBValue,
      prizeMoney,
      gfd,
      commission,
      holdAmount,
      chargedNow,
    };
  };

  const handleOddsSelect = (odds: OddsOption) => {
    if (odds.ratio === 'CUSTOM') { setCustomDraft(customStakeB); setEditingCustom(true); return; }
    setEditingCustom(false);
    setSelectedOdds(odds);
    setShowOddsDropdown(false);
    if (odds.ratio !== 'CUSTOM') {
      setCustomStakeB('');
    }
  };

  const handleCreateOffer = async () => {
    const stakeAValue = Number(stakeA);
    
    if (!stakeA || stakeAValue <= 0) {
      Alert.alert('Error', 'Please enter a stake amount');
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(stakeA.trim()) || (selectedOdds?.ratio === 'CUSTOM' && !/^\d+(\.\d{1,2})?$/.test(customStakeB.trim())) || calculateStakeB() <= 0) { Alert.alert('Error', 'Enter positive amounts with at most two decimals'); return; }

    if (!selectedOdds) {
      Alert.alert('Error', 'Please select odds');
      return;
    }

    if (!trueSituationText || !falseSituationText) {
      Alert.alert('Error', 'Please fill in all required situation texts');
      return;
    }

    if (!tieDisabled && !nullSituationText) {
      Alert.alert('Error', 'Please fill in the tie situation or disable it');
      return;
    }

    if (!postTitle && !generatingTitle) {
      Alert.alert('Error', 'Post title is being generated. Please wait...');
      return;
    }

    try {
      setLoading(true);
      const userId = await authService.getUserId();
      if (!userId) {
        Alert.alert('Error', 'Please log in to create an offer');
        return;
      }

      const { stakeB, holdAmount, commission, chargedNow } = getCalculatedValues();
      const balance = await apiClient.getAvailableBalance();

      if (balance < chargedNow) {
        Alert.alert(
          'Insufficient Balance',
          `You need $${chargedNow.toFixed(2)} but only have $${balance.toFixed(2)}. Redirecting to add funds...`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Add Funds',
              onPress: () => {
                Alert.alert('Stripe Checkout', 'This would open Stripe checkout in production');
              },
            },
          ]
        );
        return;
      }

      const distance = 150; // Demo Central Plaza

      // Calculate expiry date (current time + expiryMinutes), null for forever
      let expiryDateStr: string | undefined;
      if (expiryMinutes !== -1) {
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
        expiryDateStr = expiryDate.toISOString();
      }

      const offer = await apiClient.createOffer({
        creatorUserId: userId,
        propositionText: trueSituationText,
        trueSituationText,
        falseSituationText,
        nullSituationText: tieDisabled ? undefined : nullSituationText,
        postTitle: postTitle || falseSituationText,
        stakeCreator: stakeAValue,
        stakeB,
        oddsRatio: selectedOdds.ratio,
        stakeMatcherMax: stakeAValue,
        remainingStakeMatcher: stakeAValue,
        distanceMeters: distance,
        status: 'OPEN',
        parentOfferId: null,
        expiryDate: expiryDateStr,
      }, operationKey);

      // Create notification
      // In production, would create in-app notification

      // Navigate to MyOffers and remove CreateOffer from history
      navigation.reset({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'MyOffers' }],
      });

      Alert.alert('Success', 'Your Offer has been posted');
    } catch (error: any) {
      console.error('Error creating offer:', error);
      if (error.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert('Insufficient Balance', 'Please add funds to your wallet');
      } else {
        Alert.alert('Error', 'Failed to create offer. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { stakeA: stakeAVal, stakeB: stakeBVal, prizeMoney, gfd, commission, holdAmount, chargedNow } = getCalculatedValues();
  const isPlaceEnabled = stakeAVal > 0 && selectedOdds && trueSituationText && falseSituationText && (tieDisabled || nullSituationText) && postTitle;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Create Offer</Text>

      {/* I BET [stake input] ODDS [odds button] */}
      <View style={styles.betRow}>
        <Text style={styles.betText}>I BET</Text>
        <TextInput
          style={styles.stakeInput}
          value={stakeA}
          onChangeText={setStakeA}
          placeholder="0"
          placeholderTextColor="#666666"
          keyboardType="decimal-pad"
        />
        <Text style={styles.betText}>ODDS</Text>
        <TouchableOpacity
          style={[styles.oddsButton, !stakeAVal && styles.oddsButtonDisabled]}
          onPress={() => stakeAVal > 0 && setShowOddsDropdown(true)}
          disabled={!stakeAVal}
        >
          <Text style={styles.oddsButtonText}>
            {selectedOdds?.ratio === 'CUSTOM' ? `TO WIN $${Number(customStakeB).toFixed(2)}` : selectedOdds ? selectedOdds.label : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Odds Dropdown Modal */}
      <Modal
        visible={showOddsDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={closeOdds}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeOdds}
        >
          <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight: '85%', width: '90%'}} contentContainerStyle={styles.dropdownContainer}>
            {ODDS_OPTIONS.map((odds) => {
              const stakeBForOption = odds.ratio === 'CUSTOM' 
                ? Number(customStakeB) || 0
                : odds.calculateStakeB(stakeAVal);
              const displayText = odds.ratio === 'CUSTOM'
                ? 'CUSTOM'
                : `${odds.label} TO WIN $${stakeBForOption.toFixed(2)}`;
              
              return (
                <TouchableOpacity
                  key={odds.ratio}
                  style={styles.dropdownItem}
                  onPress={() => handleOddsSelect(odds)}
                >
                  <Text style={styles.dropdownItemText}>{displayText}</Text>
                </TouchableOpacity>
              );
            })}
            {editingCustom && (
              <View style={styles.customInputContainer}>
                <Text style={styles.customInputLabel}>To Win Amount:</Text>
                <TextInput
                  style={styles.customInput}
                  autoFocus
                  value={customDraft}
                  onChangeText={setCustomDraft}
                  placeholder="0"
                  placeholderTextColor="#666666"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={applyCustom} style={styles.dropdownItem}><Text style={styles.dropdownItemText}>Apply amount</Text></TouchableOpacity>
                <TouchableOpacity onPress={closeOdds} style={styles.dropdownItem}><Text style={styles.dropdownItemText}>Cancel</Text></TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settlement Text Inputs */}
      <View style={styles.settlementSection}>
        <Text style={styles.settlementLabel}>
          You receive ${prizeMoney.toFixed(2)} if:
        </Text>
        <TextInput
          style={styles.settlementInput}
          value={trueSituationText}
          onChangeText={setTrueSituationText}
          placeholder="e.g., Boxer in Red Shorts Wins"
          placeholderTextColor="#666666"
          multiline
        />
      </View>

      <View style={styles.settlementSection}>
        <Text style={styles.settlementLabel}>
          You lose ${stakeAVal.toFixed(2)} if:
        </Text>
        <TextInput
          style={styles.settlementInput}
          value={falseSituationText}
          onChangeText={setFalseSituationText}
          placeholder="e.g., Boxer in Blue Shorts Wins"
          placeholderTextColor="#666666"
          multiline
        />
      </View>

      <View style={styles.settlementSection}>
        <View style={styles.tieToggleRow}>
          <Switch
            value={tieDisabled}
            onValueChange={setTieDisabled}
            trackColor={{ false: '#2a2a2a', true: '#FFD700' }}
            thumbColor={tieDisabled ? '#000000' : '#888888'}
          />
          <Text style={styles.tieToggleLabel}>There is no tie situation</Text>
        </View>
        {!tieDisabled && (
          <>
            <Text style={styles.settlementLabel}>
              Is there a situation where no one wins?
            </Text>
            <TextInput
              style={styles.settlementInput}
              value={nullSituationText}
              onChangeText={setNullSituationText}
              placeholder="e.g., The fight ends in a tie"
              placeholderTextColor="#666666"
              multiline
            />
          </>
        )}
      </View>

      {/* Expiry Date Selector */}
      <View style={styles.settlementSection}>
        <Text style={styles.settlementLabel}>Offer Expires In:</Text>
        <TouchableOpacity
          style={styles.expiryButton}
          onPress={() => setShowExpiryPicker(true)}
        >
          <Text style={styles.expiryButtonText}>{getExpiryLabel(expiryMinutes)}</Text>
        </TouchableOpacity>
        <Text style={styles.expiryHint}>No limit, or choose a time (minimum 20 minutes)</Text>
      </View>

      {/* Expiry Picker Modal */}
      <Modal
        visible={showExpiryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExpiryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExpiryPicker(false)}
        >
          <View style={styles.expiryPickerContainer}>
            <Text style={styles.expiryPickerTitle}>Select Expiry Time</Text>
            <ScrollView style={styles.expiryPickerScroll}>
              {EXPIRY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.expiryOption,
                    expiryMinutes === option.value && styles.expiryOptionSelected,
                  ]}
                  onPress={() => {
                    setExpiryMinutes(option.value);
                    setShowExpiryPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.expiryOptionText,
                      expiryMinutes === option.value && styles.expiryOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.expiryPickerClose}
              onPress={() => setShowExpiryPicker(false)}
            >
              <Text style={styles.expiryPickerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Warning */}
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ONCE YOU POST, IF YOUR OFFER IS MATCHED, YOU WILL ONLY HAVE 20 SECONDS TO ACCEPT OR REJECT THE OFFER
        </Text>
      </View>

      {/* Live-updating info */}
      {stakeAVal > 0 && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            We'll hold ${holdAmount.toFixed(2)} and return your additional ${gfd.toFixed(2)} Good-Faith Deposit when the bet is resolved. That's how we guarantee that all everyone plays fair. <Text accessibilityRole="link" onPress={() => navigation.navigate('FAQ', { topic: 'deposit' })} style={{textDecorationLine: 'underline'}}>Learn more…</Text>
          </Text>
        </View>
      )}

      {/* Place Button */}
      <TouchableOpacity
        style={[styles.placeButton, (!isPlaceEnabled || loading) && styles.placeButtonDisabled]}
        onPress={handleCreateOffer}
        disabled={!isPlaceEnabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.placeButtonText}>Place</Text>
        )}
      </TouchableOpacity>

      {stakeAVal > 0 && (
        <Text style={styles.commissionText}>
          Commission = ${commission.toFixed(2)}
        </Text>
      )}
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
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  betText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stakeInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minWidth: 80,
    textAlign: 'center',
  },
  oddsButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  oddsButtonDisabled: {
    backgroundColor: '#2a2a2a',
    opacity: 0.5,
  },
  oddsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    minWidth: 250,
    maxWidth: '80%',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#FFFFFF',
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
  settlementSection: {
    marginBottom: 24,
  },
  settlementLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  settlementInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tieToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tieToggleLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  placeButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  placeButtonDisabled: {
    opacity: 0.5,
  },
  placeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  commissionText: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  expiryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 8,
  },
  expiryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expiryHint: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  expiryPickerContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  expiryPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  expiryPickerScroll: {
    maxHeight: 300,
  },
  expiryOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  expiryOptionSelected: {
    backgroundColor: '#2a2a2a',
  },
  expiryOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  expiryOptionTextSelected: {
    color: '#FFD700',
    fontWeight: '700',
  },
  expiryPickerClose: {
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'center',
  },
  expiryPickerCloseText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FF4444',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 20,
  },
  linksContainer: {
    gap: 12,
    alignItems: 'center',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
});
