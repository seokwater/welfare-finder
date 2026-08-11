import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme'

export default function ScreenHeader({ title, subtitle, rightLabel, onRight }) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!!rightLabel && <TouchableOpacity onPress={onRight}><Text style={styles.right}>{rightLabel}</Text></TouchableOpacity>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  right: { color: colors.greenDark, fontSize: 13, fontWeight: '800', padding: 8 },
})
