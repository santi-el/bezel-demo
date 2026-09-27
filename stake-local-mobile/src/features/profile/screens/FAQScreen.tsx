import React, { useState } from 'react';
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
    answer: 'Navigate to the Create Bet tab, fill in the bet details including title, amount, and odds, then submit.',
  },
  {
    question: 'What is a good-faith deposit?',
    answer: 'A good-faith deposit is required to match a bet. It ensures both parties are committed and is held in escrow until the bet is resolved.',
  },
  {
    question: 'How are bets resolved?',
    answer: 'Both parties must confirm the outcome. If there\'s a dispute, our support team will review and make a final decision.',
  },
  {
    question: 'How do I withdraw my winnings?',
    answer: 'Go to the Payments section and select Withdraw. Funds are typically processed within 1-3 business days.',
  },
  {
    question: 'What happens if someone doesn\'t pay?',
    answer: 'All matched bets require deposits upfront, so funds are secured before the bet is active.',
  },
];

export default function FAQScreen() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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








