import React, { useState } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../app/navigation/AppNavigator';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'How do I create a bet?',
    answer: 'Tap NEW+ in Near You, enter your offer, amount and odds, then submit.',
  },
  {
    question: 'What is a good-faith deposit?',
    answer: 'Your stake funds the wager. A separate good-faith deposit is reserved for each participant and returned when the wager is resolved. Commission is charged separately and is non-refundable. Cancellation or rejection releases the applicable stake and deposit; disputed funds stay held until resolution. This demo uses local simulated balances, not real money.',
  },
  {
    question: 'How are bets resolved?',
    answer: 'Both participants confirm the outcome. In this local demo, conflicting results hold funds until a participant uses the demo dispute-resolution control. Support messages are saved locally and are not sent.',
  },
  {
    question: 'How do I withdraw my winnings?',
    answer: 'Wallet withdrawals adjust your local demo balance only. No real money is transferred.',
  },
  {
    question: 'What happens if someone doesn\'t pay?',
    answer: 'All matched bets require deposits upfront, so funds are secured before the bet is active.',
  },
];

export default function FAQScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'FAQ'>>();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(route.params?.topic === 'deposit' ? 1 : null);
  React.useEffect(() => { if (route.params?.topic === 'deposit') setExpandedIndex(1); }, [route.params]);

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Frequently Asked Questions</Text>
      
      {faqData.map((item, index) => (
        <View key={index} style={styles.faqItem}>
          <TouchableOpacity
            style={styles.questionContainer}
            onPress={() => toggleExpanded(index)}
          >
            <Text style={styles.question}>{item.question}</Text>
            <Text style={styles.expandIcon}>
              {expandedIndex === index ? '−' : '+'}
            </Text>
          </TouchableOpacity>
          {expandedIndex === index && (
            <View style={styles.answerContainer}>
              <Text style={styles.answer}>{item.answer}</Text>
            </View>
          )}
        </View>
      ))}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  faqItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
  },
  expandIcon: {
    fontSize: 24,
    color: '#FFD700',
    fontWeight: '300',
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  answer: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    marginTop: 12,
  },
});








