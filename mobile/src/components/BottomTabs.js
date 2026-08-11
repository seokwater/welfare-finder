import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, shadow } from '../theme'

const TABS = [
  { key: 'home', label: '홈', icon: '⌂' },
  { key: 'calendar', label: '캘린더', icon: '▣' },
  { key: 'search', label: '검색', icon: '⌕' },
  { key: 'my', label: '마이', icon: '●' },
]

export default function BottomTabs({ active, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const selected = active === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.icon, selected && styles.active]}>{tab.icon}</Text>
            <Text style={[styles.label, selected && styles.active]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingBottom: 8,
    ...shadow,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { fontSize: 24, color: '#9AA29D', fontWeight: '800' },
  label: { fontSize: 11, color: '#8A928D', fontWeight: '700' },
  active: { color: colors.green },
})
