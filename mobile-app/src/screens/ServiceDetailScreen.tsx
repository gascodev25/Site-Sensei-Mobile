import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ServiceDetail'>;
type Route = RouteProp<RootStackParamList, 'ServiceDetail'>;

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ServiceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { service, occurrenceDate } = route.params;
  const { client, consumables, equipment } = service;

  function openMaps() {
    const query = encodeURIComponent(client.addressText);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url);
  }

  function callClient() {
    if (client.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  }

  const serviceTypeName = service.type === 'service_contract' ? 'Service Contract' : 'Installation';
  const intervalLabel = service.recurrencePattern?.interval
    ? `Every ${service.recurrencePattern.interval}`
    : 'Once-off';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.hero}>
        <Text style={styles.heroClient}>{client.name}</Text>
        <Text style={styles.heroType}>{serviceTypeName}</Text>
        {occurrenceDate && (
          <Text style={styles.heroDate}>{formatDate(occurrenceDate)}</Text>
        )}
      </View>

      <View style={styles.card}>
        <SectionTitle>Client Details</SectionTitle>
        <InfoRow label="Contact" value={client.contactPerson || 'N/A'} />
        <InfoRow label="Address" value={client.addressText} />
        {client.city && <InfoRow label="City" value={client.city} />}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={openMaps}>
            <Text style={styles.actionBtnText}>Open in Maps</Text>
          </TouchableOpacity>
          {client.phone ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={callClient}>
              <Text style={styles.actionBtnText}>Call Client</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle>Service Info</SectionTitle>
        <InfoRow label="Type" value={serviceTypeName} />
        <InfoRow label="Schedule" value={intervalLabel} />
        <InfoRow label="Priority" value={service.status || 'Scheduled'} />
        {service.recurrencePattern?.end_date && (
          <InfoRow label="Contract End" value={formatDate(service.recurrencePattern.end_date)} />
        )}
      </View>

      {consumables && consumables.length > 0 && (
        <View style={styles.card}>
          <SectionTitle>Consumables Required</SectionTitle>
          {consumables.map((c, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName}>{c.name}</Text>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>×{c.plannedQty}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {equipment && equipment.length > 0 && (
        <View style={styles.card}>
          <SectionTitle>Equipment Installed</SectionTitle>
          {equipment.map((e, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName}>{e.name}</Text>
              <View style={[styles.qtyBadge, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.qtyText, { color: '#065f46' }]}>×{e.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.startButton}
        onPress={() =>
          navigation.navigate('FieldCompletion', {
            service,
            occurrenceDate: occurrenceDate || new Date().toISOString().substring(0, 10),
          })
        }
      >
        <Text style={styles.startButtonText}>Start Service</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  hero: {
    backgroundColor: '#1e40af',
    padding: 24,
    paddingTop: 20,
  },
  heroClient: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroType: { color: '#93c5fd', fontSize: 15 },
  heroDate: { color: '#bfdbfe', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoLabel: { width: 90, color: '#6b7280', fontSize: 13, fontWeight: '500' },
  infoValue: { flex: 1, color: '#111827', fontSize: 13 },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1e40af',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  actionBtnGreen: { backgroundColor: '#059669' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemName: { color: '#374151', fontSize: 14, flex: 1 },
  qtyBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qtyText: { color: '#1e40af', fontWeight: '700', fontSize: 13 },
  startButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    margin: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
