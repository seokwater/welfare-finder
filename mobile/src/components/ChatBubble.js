import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

export default function ChatBubble({ role = 'assistant', text }) {
  const user = role === 'user'
  return (
    <View style={[styles.row, user ? styles.rowUser : styles.rowAssistant]}>
      {!user && <View style={styles.bot}><Text style={styles.botText}>AI</Text></View>}
      <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, user && styles.userText]}>{text}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, maxWidth: '100%' },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bot: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  botText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  assistantBubble: { backgroundColor: '#F0F3F1', borderBottomLeftRadius: 5 },
  userBubble: { backgroundColor: colors.green, borderBottomRightRadius: 5 },
  text: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  userText: { color: colors.white, fontWeight: '600' },
})
