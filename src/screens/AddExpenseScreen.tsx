import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../lib/auth-context';
import { getExchangeRateForDate } from '../lib/exchangeRate';
import {
  createTransaction,
  getAvailableCategories,
  getTransactionById,
  getUserSpaces,
  updateTransaction,
} from '../lib/transactionQueries';
import { uploadReceipt } from '../lib/receiptsStorage';
import { parseReceipt } from '../lib/receiptParser';
import { useNetworkStatus } from '../lib/networkContext';
import { getCached, setCached, CacheKeys } from '../lib/localCache';
import { enqueue, generateClientId } from '../lib/offlineQueue';

import type { Category, Currency, Space, Transaction } from '../types/models';
import type { HomeStackParamList } from '../navigation/types';
import { formatAmountString } from '../lib/format';
import BackgroundSilhouette from '../components/BackgroundSilhouette';
import { colors, fonts, radius, spacing } from '../theme';
import { showAlert } from '../lib/alertHelper';

import NumericKeypad from '../components/NumericKeypad';
import CategoryChip from '../components/CategoryChip';
import CategoryFormModal from '../components/CategoryFormModal';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'AddExpense'>;
type RouteT = RouteProp<HomeStackParamList, 'AddExpense'>;

const CURRENCY_SYMBOL: Record<Currency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateTR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function AddExpenseScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();

  const transactionId = route.params?.transactionId;
  const isEditing = !!transactionId;

  const initialSpaceId = route.params?.spaceId;

  // ---------- Form state ----------
  const [amountStr, setAmountStr] = useState('0');
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(initialSpaceId ?? null);
  const [note, setNote] = useState('');

  // ---------- Uzaktan veriler ----------
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // ---------- Düzenleme modu ----------
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [existingTx, setExistingTx] = useState<Transaction | null>(null);
  const [originalDate, setOriginalDate] = useState<string | null>(null);
  const [originalCurrency, setOriginalCurrency] = useState<Currency | null>(null);

  // ---------- Tarih picker ----------
  const [showPicker, setShowPicker] = useState(false);

  // ---------- Kaydetme ----------
  const [saving, setSaving] = useState(false);

  // ---------- Fiş ----------
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // ---------- Fiş parse ----------
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [touchedAmount, setTouchedAmount] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [touchedCategory, setTouchedCategory] = useState(false);

  // ---------- Kategori modal ----------
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);

  // ---------- İlk yükleme (cache-first) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoadingRefs(true);

      // ============================================================
      // 1) CACHE'ten oku → offline olsa bile chip'ler görünsün
      // ============================================================
      const [cachedCats, cachedPersonalSpaceId, cachedGroups] = await Promise.all([
        getCached<Category[]>(CacheKeys.categories),
        getCached<string>(CacheKeys.homeDisplayName + ':spaceId'),
        getCached<any[]>(CacheKeys.groupsList),
      ]);

      if (cachedCats && !cancelled) {
        setCategories(cachedCats);
        // Kategori seçili değilse "Diğer"i otomatik seç
        if (!categoryId) {
          const diger = cachedCats.find((c) => c.name === 'Diğer');
          if (diger) setCategoryId(diger.id);
        }
      }

      // Cache'teki space bilgilerini birleştir
      const cachedSpaces: Space[] = [];
      if (cachedPersonalSpaceId) {
        cachedSpaces.push({
          id: cachedPersonalSpaceId,
          type: 'personal',
          name: 'Kişisel',
          status: 'active',
          created_by: user.id,
          invite_code: '',
          created_at: new Date().toISOString(),
        });
      }
      if (cachedGroups && Array.isArray(cachedGroups)) {
        for (const g of cachedGroups) {
          cachedSpaces.push({
            id: g.id,
            type: 'shared',
            name: g.name,
            status: g.status,
            created_by: g.created_by,
            invite_code: g.invite_code ?? '',
            created_at: g.created_at,
          });
        }
      }

      if (cachedSpaces.length > 0 && !cancelled) {
        setSpaces(cachedSpaces);
        setSpaceId((prev) => prev ?? cachedSpaces[0].id);
      }

      // ============================================================
      // 2) OFFLINE ise cache ile kal
      // ============================================================
      if (!isOnline) {
        if (!cancelled) {
          setLoadingRefs(false);
          setLoadingExisting(false);
        }
        return;
      }

      // ============================================================
      // 3) ONLINE → Supabase'den çek, cache'i güncelle
      // ============================================================
      try {
        const [sp, cats] = await Promise.all([
          getUserSpaces(user.id),
          getAvailableCategories(user.id),
        ]);
        if (cancelled) return;
        setSpaces(sp);
        setCategories(cats);

        // Kategori seçili değilse "Diğer"i otomatik seç
        setCategoryId((prev) => {
          if (prev) return prev;
          const diger = cats.find((c) => c.name === 'Diğer');
          return diger?.id ?? null;
        });

        // Cache'e yaz (sadece categories — groupsList'i GroupsScreen yönetir)
        await setCached(CacheKeys.categories, cats);
        const personal = sp.find((s) => s.type === 'personal');
        if (personal) {
          await setCached(CacheKeys.homeDisplayName + ':spaceId', personal.id);
        }

        // Düzenleme modundaysa mevcut transaction'ı çek
        if (isEditing && transactionId) {
          const tx = await getTransactionById(user.id, transactionId);
          if (cancelled) return;
          if (tx) {
            setExistingTx(tx);
            setAmountStr(tx.amount.toFixed(2).replace('.', ','));
            setDateISO(tx.expense_date);
            setCurrency(tx.currency as Currency);
            setCategoryId(tx.category_id);
            setSpaceId(tx.space_id);
            setNote(tx.note ?? '');
            setExistingReceiptPath(tx.receipt_photo_url ?? null);
            setOriginalDate(tx.expense_date);
            setOriginalCurrency(tx.currency as Currency);
          } else {
            Alert.alert('Hata', 'Harcama bulunamadı.');
            navigation.goBack();
          }
        } else {
          setSpaceId((prev) => prev ?? (sp[0]?.id ?? null));
        }
      } finally {
        if (!cancelled) {
          setLoadingRefs(false);
          setLoadingExisting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isEditing, transactionId, navigation, isOnline]);

  // ---------- Numeric input ----------
  function handleDigit(d: string) {
    setTouchedAmount(true);
    setAmountStr((prev) => {
      if (prev === '0') return d;
      if (prev.replace(',', '').length >= 10) return prev;
      return prev + d;
    });
  }

  function handleComma() {
    setTouchedAmount(true);
    setAmountStr((prev) => (prev.includes(',') ? prev : prev + ','));
  }

  function handleBackspace() {
    setTouchedAmount(true);
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      const next = prev.slice(0, -1);
      return next.length === 0 ? '0' : next;
    });
  }

  const amountNumber = useMemo(() => {
    const n = parseFloat(amountStr.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  // ---------- Fiş işlemleri ----------
  const runParseReceipt = useCallback(
    async (uri: string) => {
      // Offline'da OCR çalışmaz, kullanıcı elle doldurur
      if (!isOnline) {
        return;
      }
      setParsingReceipt(true);
      setLowConfidence(false);
      try {
        const result = await parseReceipt(uri, categories);
        if (!touchedAmount && result.amount !== null) {
          setAmountStr(result.amount.toFixed(2).replace('.', ','));
        }
        if (!touchedDate && result.date) setDateISO(result.date);
        if (!touchedCategory && result.category_id) setCategoryId(result.category_id);
        if (result.confidence === 'low') setLowConfidence(true);
      } finally {
        setParsingReceipt(false);
      }
    },
    [categories, touchedAmount, touchedDate, touchedCategory, isOnline]
  );

  async function takePhoto() {
    setReceiptModalOpen(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Kamera izni gerekli', 'Fotoğraf çekmek için kamera izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setReceiptUri(uri);
        runParseReceipt(uri);
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Kamera açılamadı.');
    }
  }

  async function pickFromGallery() {
    setReceiptModalOpen(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Galeri izni gerekli', 'Fotoğraf seçmek için galeri izni vermelisin.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setReceiptUri(uri);
        runParseReceipt(uri);
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Galeri açılamadı.');
    }
  }

  // ---------- Kaydet ----------
  async function handleSave() {
    console.log('[handleSave] isOnline=', isOnline, 'currency=', currency, 'amount=', amountNumber);
    if (!user) return;

    if (amountNumber <= 0) {
      showAlert('Geçersiz tutar', 'Lütfen 0’dan büyük bir tutar gir.');
      return;
    }
    // Kategori null ise "Diğer" bul ve kullan
    let effectiveCategoryId = categoryId;
    if (!effectiveCategoryId) {
      const diger = categories.find((c) => c.name === 'Diğer');
      effectiveCategoryId = diger?.id ?? null;
    }

    if (!effectiveCategoryId) {
      showAlert('Kategori yok', 'Sistem kategorileri yüklenemedi.');
      return;
    }
    if (!spaceId) {
      showAlert('Alan seç', 'Lütfen bir alan seç.');
      return;
    }

    setSaving(true);
    try {
      // ============================================================
      // OFFLINE YOL: kuyruğa ekle, kur/fiş yükleme YAPMA
      // ============================================================
      if (!isOnline) {
        console.log('[handleSave] OFFLINE YOL, baseInput hazırlanıyor');
        const baseInput = {
          space_id: spaceId,
          category_id: effectiveCategoryId,
          amount: amountNumber,
          currency,
          note: note.trim() || null,
          expense_date: dateISO,
          receipt_photo_url: existingReceiptPath ?? null,
          receiptLocalUri: receiptUri ?? null,  // yeni seçilen yerel fotoğraf → sync sırasında yüklenecek
        };

        try {
          if (isEditing) {
            const item = await enqueue('update_transaction', {
              transactionId,
              ...baseInput,
              exchange_rate_snapshot: existingTx?.exchange_rate_snapshot ?? null,
            });
            console.log('[handleSave] update enqueue OK:', item.id);
          } else {
            const item = await enqueue('create_transaction', {
              id: generateClientId(),
              ...baseInput,
              exchange_rate_snapshot: null,
            });
            console.log('[handleSave] create enqueue OK:', item.id);
          }
        } catch (e: any) {
          console.log('[handleSave] enqueue HATA:', e?.message ?? e);
        }
        console.log('[handleSave] goBack öncesi');
        navigation.goBack();
        return;
      }

      // ============================================================
      // ONLINE YOL: kur hesapla, fiş yükle, direkt gönder
      // ============================================================

      // 1) Kur hesaplama
      let exchange_rate_snapshot: number | null = null;

      const dateOrCurrencyChanged =
        isEditing &&
        existingTx &&
        (dateISO !== originalDate || currency !== originalCurrency);

      const needsRate = currency !== 'TRY' && (!isEditing || dateOrCurrencyChanged);
      const keepExistingRate =
        isEditing && currency !== 'TRY' && !dateOrCurrencyChanged && existingTx;

      if (keepExistingRate) {
        exchange_rate_snapshot = existingTx!.exchange_rate_snapshot;
      } else if (needsRate) {
        try {
          exchange_rate_snapshot = await getExchangeRateForDate(currency, dateISO);
        } catch (err: any) {
          Alert.alert('Kur bilgisi alınamadı', err?.message ?? 'Tekrar dene.');
          setSaving(false);
          return;
        }
      }

      // 2) Fiş yükleme
      let receipt_photo_url: string | null = existingReceiptPath;
      if (receiptUri) {
        const up = await uploadReceipt(user.id, receiptUri);
        if (up.ok) {
          receipt_photo_url = up.path;
        } else {
          Alert.alert('Fiş yüklenemedi', 'Harcama fişsiz olarak kaydedilecek. (' + up.error + ')');
          receipt_photo_url = null;
        }
      }

      // 3) Kaydet/Güncelle
      const input = {
        space_id: spaceId,
        category_id: effectiveCategoryId,
        amount: amountNumber,
        currency,
        exchange_rate_snapshot,
        note: note.trim() || null,
        expense_date: dateISO,
        receipt_photo_url,
      };

      const result = isEditing
        ? await updateTransaction(user.id, transactionId!, input)
        : await createTransaction(user.id, input);

      if (!result.ok) {
        Alert.alert(isEditing ? 'Güncellenemedi' : 'Kaydedilemedi', result.error);
        setSaving(false);
        return;
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Beklenmeyen bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  // ---------- Tarih ----------
  function onChangeDate(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) {
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, '0');
      const d = String(selected.getDate()).padStart(2, '0');
      setDateISO(`${y}-${m}-${d}`);
      setTouchedDate(true);
    }
  }

  // ---------- Render ----------
  if (loadingRefs || loadingExisting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Fiş önizleme URI'si
  const previewReceipt = receiptUri ?? null;

  return (
    <View style={styles.root}>
      <BackgroundSilhouette type="receipt" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.amountCard}>
          <Text style={styles.amountText}>
            {CURRENCY_SYMBOL[currency]}
            {formatAmountString(amountStr)}
          </Text>
        </View>

        <View style={styles.pillRow}>
          {(['TRY', 'USD', 'EUR'] as const).map((c) => {
            const active = currency === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCurrency(c)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Tarih</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateBtnText}>{formatDateTR(dateISO)}</Text>
          <Text style={styles.dateBtnHint}>Değiştir</Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={isoToDate(dateISO)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onChangeDate}
          />
        )}

        <Text style={styles.label}>Kategori</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              category={c}
              selected={categoryId === c.id}
              onPress={() => {
                setTouchedCategory(true);
                setCategoryId(c.id);
              }}
            />
          ))}
          <Pressable
            style={styles.newCategoryChip}
            onPress={() => setCategoryFormOpen(true)}
          >
            <Text style={styles.newCategoryChipText}>+ Yeni</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.label}>Alan</Text>
        <View style={styles.pillRow}>
          {spaces.map((s) => {
            const active = spaceId === s.id;
            const displayName = s.type === 'personal' ? 'Kişisel' : s.name;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSpaceId(s.id)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Not (opsiyonel)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Örn. market alışverişi"
          placeholderTextColor={colors.inkSoft}
          value={note}
          onChangeText={setNote}
          maxLength={200}
        />

        {/* Fiş */}
        <Text style={styles.label}>Fiş (opsiyonel)</Text>
        {parsingReceipt && (
          <View style={styles.parsingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.parsingText}>Fiş okunuyor...</Text>
          </View>
        )}
        {lowConfidence && !parsingReceipt && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Fiş tam okunamadı, bilgileri kontrol et.</Text>
          </View>
        )}

        {previewReceipt ? (
          <View style={styles.receiptRow}>
            <Image source={{ uri: previewReceipt }} style={styles.receiptThumb} />
            <View style={styles.receiptInfo}>
              <Text style={styles.receiptName}>Fiş eklendi</Text>
              <View style={styles.receiptActions}>
                <Pressable onPress={() => setReceiptModalOpen(true)} style={styles.receiptAction}>
                  <Text style={styles.receiptActionText}>Değiştir</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setReceiptUri(null);
                    setExistingReceiptPath(null);
                  }}
                  style={styles.receiptAction}
                >
                  <Text style={[styles.receiptActionText, { color: colors.expense }]}>Kaldır</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : existingReceiptPath ? (
          <View style={styles.receiptRow}>
            <View style={styles.receiptThumbPlaceholder}>
              <Text style={{ fontSize: 24 }}>📎</Text>
            </View>
            <View style={styles.receiptInfo}>
              <Text style={styles.receiptName}>Mevcut fiş</Text>
              <View style={styles.receiptActions}>
                <Pressable onPress={() => setReceiptModalOpen(true)} style={styles.receiptAction}>
                  <Text style={styles.receiptActionText}>Değiştir</Text>
                </Pressable>
                <Pressable
                  onPress={() => setExistingReceiptPath(null)}
                  style={styles.receiptAction}
                >
                  <Text style={[styles.receiptActionText, { color: colors.expense }]}>Kaldır</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addReceiptBtn} onPress={() => setReceiptModalOpen(true)}>
            <Text style={styles.addReceiptText}>📎 Fiş Ekle</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEditing ? 'Güncelle' : 'Kaydet'}
            </Text>
          )}
        </Pressable>

        <View style={styles.keypadWrap}>
          <NumericKeypad
            onDigit={handleDigit}
            onComma={handleComma}
            onBackspace={handleBackspace}
          />
        </View>
      </ScrollView>

      <CategoryFormModal
        visible={categoryFormOpen}
        editing={null}
        onClose={() => setCategoryFormOpen(false)}
        onSaved={(cat) => {
          if (user) {
            getAvailableCategories(user.id).then((cats) => {
              setCategories(cats);
              setTouchedCategory(true);
              setCategoryId(cat.id);
            });
          }
        }}
      />

      <Modal
        visible={receiptModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReceiptModalOpen(false)}>
          <View style={styles.actionSheet}>
            <Pressable style={styles.actionItem} onPress={takePhoto}>
              <Text style={styles.actionText}>📷 Fotoğraf Çek</Text>
            </Pressable>
            <Pressable style={[styles.actionItem, { borderBottomWidth: 0 }]} onPress={pickFromGallery}>
              <Text style={styles.actionText}>🖼️ Galeriden Seç</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  amountCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  amountText: { fontFamily: fonts.heading, fontSize: 44, color: colors.ink, letterSpacing: 1 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.accentInk },

  label: { fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.xs },

  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.md },
  dateBtnText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  dateBtnHint: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  chipRow: { paddingVertical: spacing.xs, paddingRight: spacing.lg, marginBottom: spacing.md },

  newCategoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed', backgroundColor: colors.surface, marginRight: spacing.sm, justifyContent: 'center' },
  newCategoryChipText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  noteInput: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.ink, fontSize: 15, marginBottom: spacing.lg },

  parsingBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginBottom: spacing.sm },
  parsingText: { color: colors.inkSoft, fontSize: 13 },
  warningBox: { backgroundColor: '#FFF4E0', borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, padding: spacing.sm, marginBottom: spacing.sm },
  warningText: { color: colors.accent, fontSize: 12 },

  addReceiptBtn: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  addReceiptText: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.lg },
  receiptThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  receiptThumbPlaceholder: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  receiptInfo: { flex: 1 },
  receiptName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  receiptActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  receiptAction: {},
  receiptActionText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.accentInk, fontSize: 16, fontWeight: '700' },

  keypadWrap: { marginTop: spacing.xs },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingVertical: spacing.sm },
  actionItem: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  actionText: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
