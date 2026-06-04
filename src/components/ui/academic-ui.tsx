import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors, Spacing } from '@/constants/theme';

export type AcademicIconName = ComponentProps<typeof SymbolView>['name'];

export const Academic = BrandColors;

export const STATUS_TONES = {
  blue: { bg: Academic.softBlue, text: Academic.primary },
  warning: { bg: Academic.warningBg, text: Academic.warningText },
  success: { bg: Academic.successBg, text: Academic.success },
  error: { bg: Academic.errorBg, text: Academic.error },
  muted: { bg: Academic.muted, text: Academic.textSecondary },
  navy: { bg: '#EAF0F8', text: Academic.navy },
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export function AcademicIcon({
  name,
  size = 20,
  color = Academic.primary,
}: {
  name: AcademicIconName;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

export function StatusBadge({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: StatusTone;
}) {
  const colors = STATUS_TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  badge,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  badge?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge ? <StatusBadge label={badge} tone="error" /> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RoleHeroHeader({
  label,
  title,
  subtitle,
  right,
}: {
  label: string;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.dotGrid}>
        {Array.from({ length: 42 }).map((_, index) => (
          <View key={index} style={styles.dot} />
        ))}
      </View>
      <View style={styles.heroContent}>
        <View style={styles.heroCopy}>
          <View style={styles.heroLabelPill}>
            <Text style={styles.heroLabel}>{label}</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.heroSubtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        {right ?? (
          <View style={styles.heroIconButton}>
            <AcademicIcon
              name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              color="#FFFFFF"
              size={24}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function SurfaceCard({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: object;
  accent?: 'blue' | 'success' | 'error' | 'warning';
}) {
  const accentColor = accent === 'success'
    ? Academic.success
    : accent === 'error'
      ? Academic.error
      : accent === 'warning'
        ? Academic.warningText
        : accent === 'blue'
          ? Academic.primary
          : undefined;

  return (
    <View
      style={[
        styles.card,
        accentColor && { borderLeftWidth: 4, borderLeftColor: accentColor },
        style,
      ]}>
      {children}
    </View>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  icon: AcademicIconName;
  tone?: StatusTone;
}) {
  const colors = STATUS_TONES[tone];
  return (
    <SurfaceCard style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: colors.bg }]}>
        <AcademicIcon name={icon} size={20} color={colors.text} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    </SurfaceCard>
  );
}

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon?: AcademicIconName;
}) {
  return (
    <SurfaceCard style={styles.emptyState}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <AcademicIcon name={icon} color={Academic.textSecondary} size={24} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </SurfaceCard>
  );
}

export function FloatingChatButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/chatbot')}
      style={({ pressed }) => [styles.chatFab, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Open CAS Assist Helpdesk">
      <AcademicIcon
        name={{ ios: 'message', android: 'chat_bubble', web: 'chat_bubble' }}
        color="#FFFFFF"
        size={25}
      />
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = Academic.primary,
  bg = Academic.softBlue,
  label,
}: {
  icon: AcademicIconName;
  onPress: () => void;
  color?: string;
  bg?: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg }, pressed && styles.pressed]}
      accessibilityLabel={label}
      accessibilityRole="button">
      <AcademicIcon name={icon} color={color} size={22} />
    </Pressable>
  );
}

export function formatCategory(value: string | null | undefined) {
  if (!value) return 'General Request';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatRelative(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function shortRef(id: string, prefix = 'T') {
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 3) return `${prefix}-${digits.slice(-3)}`;
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return compact ? `${prefix}-${compact}` : `${prefix}-REQ`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 128,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  sectionHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  sectionTitle: { color: Academic.navy, fontSize: 18, fontWeight: '800' },
  sectionAction: { color: Academic.primary, fontSize: 14, fontWeight: '800' },
  hero: {
    minHeight: 204,
    marginHorizontal: -Spacing.three,
    marginTop: -Spacing.one,
    marginBottom: -Spacing.two,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: Academic.primary,
  },
  dotGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    paddingHorizontal: 28,
    paddingVertical: 22,
    opacity: 0.18,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: 50,
    paddingBottom: Spacing.five,
  },
  heroCopy: { flex: 1, gap: Spacing.two },
  heroLabelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  heroSubtitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, opacity: 0.96 },
  heroIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    boxShadow: '0 2px 8px rgba(16, 33, 62, 0.06)',
  },
  metricCard: { flex: 1, gap: 8, minHeight: 126 },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { color: Academic.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 7, paddingVertical: Spacing.four },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.muted,
  },
  emptyTitle: { color: Academic.navy, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyMessage: { color: Academic.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  chatFab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 98,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
    boxShadow: '0 7px 18px rgba(32, 138, 239, 0.34)',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
