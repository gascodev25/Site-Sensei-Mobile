import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../navigation/AuthContext';
import { getMobileServices, type MobileService } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ServiceList'>;
type TabRange = 'today' | 'week' | 'month';

type ServiceListItem = MobileService & { occurrenceDate: string };

const TABS: { key: TabRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', weekday: 'short' });
}

function ServiceCard({ service, onPress }: { service: ServiceListItem; onPress: () => void }) {
  const isPending = service.pendingOccurrenceDates.length > 0;
  const displayDate = service.occurrenceDate || service.installationDate || '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.clientName}>{service.client.name}</Text>
        <View style={[styles.badge, isPending ? styles.badgePending : styles.badgeDone]}>
          <Text style={styles.badgeText}>{isPending ? 'Pending' : 'Done'}</Text>
        </View>
      </View>

      <Text style={styles.serviceType}>
        {service.type === 'service_contract' ? 'Service Contract' : 'Installation'}
      </Text>

      {displayDate ? <Text style={styles.dateText}>{formatDate(displayDate)}</Text> : null}

      <Text style={styles.address} numberOfLines={2}>
        {service.client.addressText}
        {service.client.city ? `, ${service.client.city}` : ''}
      </Text>

      {service.consumables.length > 0 && (
        <View style={styles.pills}>
          {service.consumables.slice(0, 3).map((c, i) => (
            <View key={i} style={styles.pill}>
              <Text style={styles.pillText}>{c.name} ×{c.plannedQty}</Text>
            </View>
          ))}
          {service.consumables.length > 3 && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>+{service.consumables.length - 3} more</Text>
            </View>
          )}
        </View>
      )}

      {service.equipment.length > 0 && (
        <Text style={styles.equipText}>
          Equipment: {service.equipment.map(e => e.name).join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ServiceListScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<TabRange>('today');
  const [services, setServices] = useState<MobileService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isSuperuser = user?.roles?.includes('superuser') || user?.roles?.includes('manager');

  async function load(range: TabRange, silent = false) {
    if (!isSuperuser && !user?.linkedTeamId) return;
    if (!silent) setIsLoading(true);
    try {
      const data = await getMobileServices(range, user?.linkedTeamId ?? null);
      setServices(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        Alert.alert('Session expired', 'Please log in again.', [{ text: 'OK', onPress: logout }]);
      } else {
        Alert.alert('Error', 'Could not load services. Check your connection.');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [tab, user?.linkedTeamId])
  );

  function handleTabChange(range: TabRange) {
    setTab(range);
    load(range);
  }

  function handleRefresh() {
    setRefreshing(true);
    load(tab, true);
  }

  const allListData: ServiceListItem[] = services.flatMap(service => {
    if (service.pendingOccurrenceDates.length > 0) {
      return service.pendingOccurrenceDates.map(date => ({ ...service, occurrenceDate: date }));
    }
    // Completed services: use the actual occurrence dates from the range (proper YYYY-MM-DD strings).
    // Do NOT fall back to installationDate — it is a timestamp object and renders as "Invalid Date".
    if (service.occurrenceDatesInRange.length > 0) {
      return service.occurrenceDatesInRange.map(date => ({ ...service, occurrenceDate: date }));
    }
    // Absolute last resort: format installationDate safely
    const iso = service.installationDate
      ? new Date(service.installationDate).toISOString().substring(0, 10)
      : '';
    return [{ ...service, occurrenceDate: iso }];
  });

  const q = searchQuery.trim().toLowerCase();
  const flatListData: ServiceListItem[] = q
    ? allListData.filter(item => {
        const name = item.client.name?.toLowerCase() ?? '';
        const address = item.client.addressText?.toLowerCase() ?? '';
        const city = item.client.city?.toLowerCase() ?? '';
        return name.includes(q) || address.includes(q) || city.includes(q);
      })
    : allListData;

  if (!isSuperuser && !user?.linkedTeamId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No team assigned</Text>
        <Text style={styles.emptySubtitle}>
          Your account is not linked to a service team yet. Contact your manager.
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.firstName || 'Team'}</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutLink}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => handleTabChange(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by client, address or city..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      ) : (
        <FlatList<ServiceListItem>
          data={flatListData}
          keyExtractor={(item, idx) => `${item.id}-${item.occurrenceDate || idx}`}
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              onPress={() =>
                navigation.navigate('ServiceDetail', {
                  service: item,
                  occurrenceDate: item.occurrenceDate,
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {q ? 'No results found' : 'No services scheduled'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {q ? `No services match "${searchQuery}".` : 'Pull down to refresh or check another tab.'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1e40af" />
          }
          contentContainerStyle={flatListData.length === 0 ? styles.fillFlex : styles.listPadding}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e40af',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  greeting: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutLink: { color: '#93c5fd', fontSize: 14 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1e40af' },
  tabText: { color: '#6b7280', fontWeight: '500', fontSize: 14 },
  tabTextActive: { color: '#1e40af', fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
  },
  searchClear: {
    marginLeft: 10,
    padding: 4,
  },
  searchClearText: {
    color: '#6b7280',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeDone: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  serviceType: { color: '#6b7280', fontSize: 13, marginBottom: 4 },
  dateText: { color: '#1e40af', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  address: { color: '#374151', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  pill: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: '#1e40af', fontSize: 12 },
  equipText: { color: '#374151', fontSize: 12, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#6b7280', marginTop: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptySubtitle: { color: '#9ca3af', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  fillFlex: { flex: 1 },
  listPadding: { paddingBottom: 24 },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: '600' },
});
