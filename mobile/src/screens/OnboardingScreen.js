import React from 'react'
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme'

export default function OnboardingScreen({ onStart, onSkip }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.brandRow}>
        <View style={styles.logo}><Text style={styles.logoText}>Q</Text></View>
        <Text style={styles.brand}>복지 Finder</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.eyebrow}>청년 혜택 비서</Text>
        <Text style={styles.title}>내 혜택,{`\n`}내가 찾지 않아도.</Text>
        <Text style={styles.body}>AI가 내 상황을 이해하고{`\n`}받을 수 있는 청년정책을 찾아드려요.</Text>
        <View style={styles.illustration}>
          <Text style={styles.gift}>🎁</Text>
          <View style={styles.bubbleLeft}><Text style={styles.bubbleText}>지원금</Text></View>
          <View style={styles.bubbleRight}><Text style={styles.bubbleText}>주거</Text></View>
        </View>
      </View>
      <View style={styles.bottom}>
        <TouchableOpacity activeOpacity={0.85} style={styles.primary} onPress={onStart}>
          <Text style={styles.primaryText}>AI 프로필 만들고 혜택 찾기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip}><Text style={styles.skip}>나중에 설정하기</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 20 },
  logo: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 23, fontWeight: '900' },
  brand: { fontSize: 22, fontWeight: '900', color: colors.ink },
  center: { flex: 1, justifyContent: 'center' },
  eyebrow: { color: colors.greenDark, fontSize: 13, fontWeight: '900', marginBottom: 12 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 43, fontWeight: '900', letterSpacing: -1 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25, marginTop: 18 },
  illustration: { height: 190, marginTop: 34, backgroundColor: colors.greenPale, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  gift: { fontSize: 76 },
  bubbleLeft: { position: 'absolute', left: 30, top: 34, backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  bubbleRight: { position: 'absolute', right: 30, bottom: 34, backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  bubbleText: { color: colors.greenDark, fontWeight: '900', fontSize: 12 },
  bottom: { paddingBottom: 20, gap: 12 },
  primary: { height: 56, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  skip: { textAlign: 'center', color: colors.muted, fontSize: 13, fontWeight: '700', padding: 6 },
})
