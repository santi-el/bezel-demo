import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
type Action = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => void;
};
type Prompt = {
  title: string;
  message: string;
  buttons: Action[];
};
let show: ((prompt: Prompt) => void) | undefined;
export function amountPrompt(title: string, message: string, buttons: Action[], _type?: string) {
  if (Platform.OS === 'ios') {
    Alert.prompt(title, message, buttons, 'plain-text', undefined, 'decimal-pad');
    return;
  }
  show?.({
    title,
    message,
    buttons
  });
}
export function AmountPromptHost() {
  const [prompt, setPrompt] = useState<Prompt>();
  const [value, setValue] = useState('');
  useEffect(() => {
    show = p => {
      setValue('');
      setPrompt(p);
    };
    return () => {
      show = undefined;
    };
  }, []);
  return <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={() => setPrompt(undefined)}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.content}><Text style={styles.title}>{prompt?.title}</Text><Text style={styles.message}>{prompt?.message}</Text><TextInput accessibilityLabel={prompt?.title} style={styles.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" autoFocus />{prompt?.buttons.map((action, index) => <TouchableOpacity key={index} style={styles.button} onPress={() => {
            setPrompt(undefined);
            action.onPress?.(value);
          }}><Text style={styles.buttonText}>{action.text}</Text></TouchableOpacity>)}</View></ScrollView></KeyboardAvoidingView></Modal>;
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  content: {
    backgroundColor: '#1a1a1a',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a'
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12
  },
  message: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 16
  },
  input: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    color: '#FFFFFF',
    padding: 12,
    fontSize: 16
  },
  button: {
    padding: 16,
    alignItems: 'center'
  },
  buttonText: {
    color: '#FFD700',
    fontWeight: '600',
    fontSize: 16
  }
});
