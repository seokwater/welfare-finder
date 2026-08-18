import React from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, shadow } from '../theme'

const TABS = [
  { key: 'home', label: '홈', icon: 'home-outline', activeIcon: 'home' },
  { key: 'calendar', label: '캘린더', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'search', label: '검색', icon: 'search-outline', activeIcon: 'search' },
  { key: 'my', label: 'My', icon: 'person-outline', activeIcon: 'person' },
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
            <Ionicons name={selected ? tab.activeIcon : tab.icon} size={24} color={selected ? colors.green : '#8D99A8'} />
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
  label: { fontSize: 11, color: '#8A928D', fontWeight: '700' },
  active: { color: colors.green },
})
