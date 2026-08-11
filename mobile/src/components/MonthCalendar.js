import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme'
import { isoToday, monthMatrix } from '../utils'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function MonthCalendar({ year, month, selectedDate, dayCounts, onSelect }) {
  const today = isoToday()
  const cells = monthMatrix(year, month)
  return (
    <View>
      <View style={styles.weekRow}>
        {WEEK.map((w, i) => <Text key={w} style={[styles.week, i === 0 && styles.sun, i === 6 && styles.sat]}>{w}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((cell) => {
          const counts = dayCounts?.[cell.iso] || {}
          const selected = selectedDate === cell.iso
          const isToday = today === cell.iso
          return (
            <TouchableOpacity key={cell.iso} activeOpacity={0.75} style={styles.cell} onPress={() => onSelect(cell.iso)}>
              <View style={[styles.dayCircle, selected && styles.selectedCircle, isToday && !selected && styles.todayCircle]}>
                <Text style={[styles.dayText, !cell.inMonth && styles.outMonth, selected && styles.selectedText]}>{cell.day}</Text>
              </View>
              <View style={styles.dots}>
                {!!counts.start && <View style={[styles.dot, { backgroundColor: colors.green }]} />}
                {!!counts.deadline && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  week: { width: '14.2857%', textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700' },
  sun: { color: '#D76E6E' },
  sat: { color: '#628DD0' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', height: 55, alignItems: 'center', paddingTop: 3 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selectedCircle: { backgroundColor: colors.green },
  todayCircle: { borderWidth: 1.5, borderColor: colors.green },
  dayText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  selectedText: { color: colors.white, fontWeight: '900' },
  outMonth: { color: '#C6CDC8' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
})
