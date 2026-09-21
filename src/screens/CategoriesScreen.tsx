import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../lib/auth-context';
import { useOnlineGuard } from '../lib/onlineGuard';
import {
  createCategory,
  deleteCategory,
  getUserCategories,
  type CategorizedList,
} from '../lib/categoryQueries';
import type { Category } from '../types/models';
import CategoryFormModal from '../components/CategoryFormModal';
import { colors, fonts, radius, spacing } from '../theme';

type UndoState = { category: Category } | null;

export default function CategoriesScreen() {
  const { user } = useAuth();
  const { isOnline, guard } = useOnlineGuard();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<CategorizedList>({ defaults: [], custom: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getUserCategories(user.id);
    setList(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  const handleDelete = useCallback(async (cat: Category) => {
    if (!user) return;
    const result = await deleteCategory(user.id, cat.id);
    if (!result.ok) {
      setDeleteError(result.error);
      setUndo(null);
      return;
    }
    setDeleteError(null);
    setUndo({ category: cat });
    load();
  }, [user, load]);

  const handleUndo = useCallback(async () => {
    if (!user || !undo) return;
    const cat = undo.category;
    const result = await createCategory(user.id, cat.name, cat.icon);
    if (!result.ok) {
      setDeleteError('Geri alınamadı: ' + result.error);
      setUndo(null);
      return;
    }
    setUndo(null);
    load();
  }, [user, undo, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          style={styles.newBtn}
          onPress={() => { setEditing(null); setFormOpen(true); }}
        >
          <Text style={styles.newBtnText}>＋ Yeni Kategori</Text>
        </Pressable>

        {deleteError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{deleteError}</Text>
            <Pressable onPress={() => setDeleteError(null)}>
              <Text style={styles.errorBannerClose}>×</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>Sistem Kategorileri</Text>
        <View style={styles.card}>
          {list.defaults.map((c, idx) => (
            <View key={c.id} style={[styles.row, idx === list.defaults.length - 1 && styles.rowLast]}>
              <Text style={styles.icon}>{c.icon ?? '📦'}</Text>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.locked}>varsayılan</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Benim Kategorilerim</Text>
        <View style={styles.card}>
          {list.custom.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kendi kategorin yok.</Text>
          ) : (
            list.custom.map((c, idx) => (
              <View key={c.id} style={[styles.row, idx === list.custom.length - 1 && styles.rowLast]}>
                <Text style={styles.icon}>{c.icon ?? '📦'}</Text>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      guard(() => {
                        setEditing(c);
                        setFormOpen(true);
                      }, 'Kategori düzenleme')
                    }
                  >
                    <Text style={[styles.actionText, !isOnline && styles.actionTextDisabled]}>
                      Düzenle
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => guard(() => handleDelete(c), 'Kategori silme')}>
                    <Text
                      style={[
                        styles.actionText,
                        { color: colors.expense },
                        !isOnline && styles.actionTextDisabled,
                      ]}
                    >
                      Sil
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {undo && (
        <View style={styles.undoToast}>
          <Text style={styles.undoText} numberOfLines={1}>"{undo.category.name}" silindi</Text>
          <Pressable onPress={handleUndo} style={styles.undoBtn}>
            <Text style={styles.undoBtnIcon}>↶</Text>
            <Text style={styles.undoBtnText}>Geri Al</Text>
          </Pressable>
        </View>
      )}

      <CategoryFormModal
        visible={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  newBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  btnDisabled: { opacity: 0.4 },
  actionTextDisabled: { opacity: 0.4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8E1E1', borderRadius: radius.md, borderWidth: 1, borderColor: colors.expense, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg },
  errorBannerText: { color: colors.expense, fontSize: 16, flex: 1 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, gap: spacing.sm },
  rowLast: { borderBottomWidth: 0 },
  icon: { fontSize: 16, width: 28, textAlign: 'center' },
  locked: { color: colors.inkSoft, fontSize: 16, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.md },
  emptyText: { color: colors.inkSoft, fontSize: 16, paddingVertical: spacing.lg, textAlign: 'center' },
  undoToast: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  undoText: { color: colors.surface, fontSize: 16, flex: 1 },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  undoBtnIcon: {
    color: colors.accentInk,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  undoBtnText: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
});
