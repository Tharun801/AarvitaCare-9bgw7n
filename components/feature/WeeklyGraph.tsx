import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

interface WeeklyData {
  date: string;
  taken: number;
  missed: number;
}

interface WeeklyGraphProps {
  data: WeeklyData[];
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeeklyGraph({ data }: WeeklyGraphProps) {
  const maxVal = Math.max(...data.map(d => d.taken + d.missed), 1);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {data.map((day, idx) => {
          const total = day.taken + day.missed;
          const takenH = total > 0 ? (day.taken / maxVal) * 80 : 0;
          const missedH = total > 0 ? (day.missed / maxVal) * 80 : 0;
          const date = new Date(day.date);
          const dayIdx = date.getDay();
          const isToday = day.date === new Date().toISOString().split('T')[0];

          return (
            <View key={idx} style={styles.barGroup}>
              <View style={styles.barContainer}>
                {total === 0 ? (
                  <View style={[styles.emptyBar]} />
                ) : (
                  <>
                    {missedH > 0 ? (
                      <View style={[styles.bar, { height: missedH, backgroundColor: Colors.error, borderRadius: 3 }]} />
                    ) : null}
                    {takenH > 0 ? (
                      <View style={[styles.bar, { height: takenH, backgroundColor: Colors.success, borderRadius: 3, marginTop: missedH > 0 ? 2 : 0 }]} />
                    ) : null}
                  </>
                )}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                {DAYS[dayIdx]}
              </Text>
              {isToday ? <View style={styles.todayDot} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Taken</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing[2] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100 },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barContainer: { width: 20, alignItems: 'center', justifyContent: 'flex-end', height: 80 },
  bar: { width: 16, minHeight: 4 },
  emptyBar: { width: 16, height: 4, backgroundColor: Colors.borderLight, borderRadius: 2 },
  dayLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4, fontWeight: Typography.medium },
  todayLabel: { color: Colors.primary, fontWeight: Typography.bold },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, marginTop: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing[6], marginTop: Spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: Typography.xs, color: Colors.textMuted },
});
