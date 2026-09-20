import { useCallback, useEffect, useState } from 'react';
import { formatCurrency, formatExpenseAmount, formatAmount as fmtAmount, formatPercent } from '../lib/format';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import {
  getReportData,
  type CategoryReportRow,
  type ReportPeriod,
  type ReportScope,
} from '../lib/reportsQueries';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import type { ReportsStackParamList } from '../navigation/types';

type RouteT = RouteProp<ReportsStackParamList, 'Reports'>;


function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

type SegmentProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
};

function Segmented<T extends string>({ options, value, onChange }: SegmentProps<T>) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const route = useRoute<RouteT>();

  const initialPeriod = route.params?.initialPeriod ?? 'monthly';

  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [scope, setScope] = useState<ReportScope>('all');
  const [loading, setLoading] = useState(true);
  const [totalTRY, setTotalTRY] = useState(0);
  const [rows, setRows] = useState<CategoryReportRow[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (route.params?.initialPeriod) {
      setPeriod(route.params.initialPeriod);
    }
  }, [route.params?.initialPeriod]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getReportData(user.id, scope, period);
    setTotalTRY(data.totalTRY);
    setRows(data.rows);
    setRange({ start: data.startDate, end: data.endDate });
    setLoading(false);
  }, [user, scope, period]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.root}>
      <BackgroundSilhouette type="compass" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Zaman aralığı</Text>
        <Segmented
          options={[
            { value: 'weekly', label: 'Haftalık' },
            { value: 'monthly', label: 'Aylık' },
            { value: 'yearly', label: 'Yıllık' },
          ]}
          value={period}
          onChange={(v) => setPeriod(v as ReportPeriod)}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Kapsam</Text>
        <Segmented
          options={[
            { value: 'personal', label: 'Kişisel' },
            { value: 'groups', label: 'Gruplar' },
            { value: 'all', label: 'Tümü' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as ReportScope)}
        />

        {range && (
          <Text style={styles.rangeText}>
            {formatDateShort(range.start)} – {formatDateShort(range.end)}
          </Text>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Bu dönemde harcama yok</Text>
            <Text style={styles.emptySub}>Farklı bir zaman aralığı veya kapsam dene.</Text>
          </View>
        ) : (
          <>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Toplam</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalTRY)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Kategoriye göre</Text>
            {rows.map((r) => (
              <View key={r.category_id ?? '__none__'} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.icon} {r.name}
                  </Text>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowValue}>{formatCurrency(r.total)}</Text>
                    <Text style={styles.rowPercent}>{formatPercent(r.percentage)}</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(r.percentage, 1)}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  label: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.ink,
    marginBottom: spacing.xs,
  },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.accentInk },

  rangeText: {
    color: colors.inkSoft,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  center: { paddingVertical: spacing.xxl, alignItems: 'center' },

  totalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalLabel: { color: colors.inkSoft, fontSize: 13 },
  totalValue: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.ink,
    marginTop: spacing.xs,
  },

  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ink,
    marginBottom: spacing.sm,
  },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rowName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowPercent: {
    color: colors.inkSoft,
    fontSize: 12,
    minWidth: 32,
    textAlign: 'right',
  },

  barTrack: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },

  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
  emptySub: {
    color: colors.inkSoft,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
