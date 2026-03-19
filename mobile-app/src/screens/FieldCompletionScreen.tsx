import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import * as ImagePicker from 'expo-image-picker';
import { submitFieldReport, type MobileService } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FieldCompletion'>;
type Route = RouteProp<RootStackParamList, 'FieldCompletion'>;

type ConsumableEntry = {
  id: number;
  name: string;
  plannedQty: number;
  actualQty: number;
};

type Photo = {
  dataUrl: string;
  comment: string;
  timestamp: string;
};

type SignatureCanvasRef = {
  clearSignature: () => void;
};

const STEPS = ['Consumables', 'Team Signature', 'Client Signature', 'Photos', 'Review'];

export default function FieldCompletionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { service, occurrenceDate } = route.params;

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialConsumables: ConsumableEntry[] = service.consumables.map(c => ({
    id: c.id,
    name: c.name,
    plannedQty: c.plannedQty,
    actualQty: c.plannedQty,
  }));

  const [consumables, setConsumables] = useState<ConsumableEntry[]>(initialConsumables);
  const [teamSignature, setTeamSignature] = useState<string>('');
  const [clientSignature, setClientSignature] = useState<string>('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState('');
  const [newPhotoComment, setNewPhotoComment] = useState('');

  const teamSigRef = useRef<SignatureCanvasRef>(null);
  const clientSigRef = useRef<SignatureCanvasRef>(null);

  function updateActualQty(id: number, value: string) {
    const qty = parseInt(value) || 0;
    setConsumables(prev =>
      prev.map(c => (c.id === id ? { ...c, actualQty: Math.max(0, qty) } : c))
    );
  }

  function hasAdjustments() {
    return consumables.some(c => c.actualQty !== c.plannedQty);
  }

  async function pickPhoto() {
    if (photos.length >= 10) {
      Alert.alert('Limit reached', 'Maximum 10 photos allowed.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      setPhotos(prev => [
        ...prev,
        { dataUrl, comment: newPhotoComment.trim(), timestamp: new Date().toISOString() },
      ]);
      setNewPhotoComment('');
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const payload = {
        serviceId: service.id,
        completionDate: occurrenceDate,
        actualConsumables: consumables,
        teamSignature: teamSignature || undefined,
        clientSignature: clientSignature || undefined,
        photos,
        hasAdjustments: hasAdjustments(),
        notes: notes.trim() || undefined,
      };
      await submitFieldReport(payload);
      navigation.replace('Success', {
        serviceId: service.id,
        clientName: service.client.name,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to submit. Please try again.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function goNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function goBack() {
    if (step > 0) setStep(s => s - 1);
  }

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <ConsumablesStep consumables={consumables} onUpdate={updateActualQty} />
        )}
        {step === 1 && (
          <SignatureStep
            title="Team Member Signature"
            sigRef={teamSigRef}
            currentSig={teamSignature}
            onSign={setTeamSignature}
            onClear={() => {
              teamSigRef.current?.clearSignature();
              setTeamSignature('');
            }}
          />
        )}
        {step === 2 && (
          <SignatureStep
            title="Client Signature"
            sigRef={clientSigRef}
            currentSig={clientSignature}
            onSign={setClientSignature}
            onClear={() => {
              clientSigRef.current?.clearSignature();
              setClientSignature('');
            }}
          />
        )}
        {step === 3 && (
          <PhotoStep
            photos={photos}
            commentValue={newPhotoComment}
            onCommentChange={setNewPhotoComment}
            onPickPhoto={pickPhoto}
            onRemovePhoto={removePhoto}
          />
        )}
        {step === 4 && (
          <ReviewStep
            service={service}
            occurrenceDate={occurrenceDate}
            consumables={consumables}
            hasTeamSig={!!teamSignature}
            hasClientSig={!!clientSignature}
            photoCount={photos.length}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack} disabled={isSubmitting}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.disabledOpacity]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ConsumablesStep({
  consumables,
  onUpdate,
}: {
  consumables: ConsumableEntry[];
  onUpdate: (id: number, val: string) => void;
}) {
  if (consumables.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No consumables assigned to this service.</Text>
        <Text style={styles.emptySubText}>Tap Next to continue.</Text>
      </View>
    );
  }
  return (
    <View style={styles.padded}>
      <Text style={styles.sectionHeader}>Adjust Consumable Quantities</Text>
      <Text style={styles.hint}>Change actual quantities used. Differences will be highlighted.</Text>
      {consumables.map(c => {
        const isDiff = c.actualQty !== c.plannedQty;
        return (
          <View key={c.id} style={[styles.consumableRow, isDiff && styles.consumableRowDiff]}>
            <View style={styles.flex1}>
              <Text style={styles.consumableName}>{c.name}</Text>
              <Text style={styles.consumablePlanned}>Planned: {c.plannedQty}</Text>
            </View>
            <View style={styles.qtyInputWrapper}>
              <TextInput
                style={[styles.qtyInput, isDiff && styles.qtyInputDiff]}
                value={String(c.actualQty)}
                onChangeText={val => onUpdate(c.id, val)}
                keyboardType="numeric"
              />
              {isDiff && (
                <Text style={styles.diffLabel}>
                  {c.actualQty > c.plannedQty ? '+' : ''}{c.actualQty - c.plannedQty}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SignatureStep({
  title,
  sigRef,
  currentSig,
  onSign,
  onClear,
}: {
  title: string;
  sigRef: React.RefObject<SignatureCanvasRef>;
  currentSig: string;
  onSign: (sig: string) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.padded}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <Text style={styles.hint}>Sign in the box below using your finger.</Text>
      <View style={styles.signatureBox}>
        <SignatureCanvas
          ref={sigRef}
          onOK={onSign}
          onEmpty={() => onSign('')}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle={`
            .m-signature-pad { box-shadow: none; border: none; }
            .m-signature-pad--body { border: none; }
            .m-signature-pad--footer .button { background-color: #1e40af; color: white; }
          `}
          style={styles.flex1}
        />
      </View>
      {currentSig ? (
        <View style={styles.sigPreview}>
          <Text style={styles.sigSaved}>Signature saved</Text>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.clearLink}>Clear & redo</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function PhotoStep({
  photos,
  commentValue,
  onCommentChange,
  onPickPhoto,
  onRemovePhoto,
}: {
  photos: Photo[];
  commentValue: string;
  onCommentChange: (v: string) => void;
  onPickPhoto: () => void;
  onRemovePhoto: (i: number) => void;
}) {
  const rows: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 2) {
    rows.push(photos.slice(i, i + 2));
  }

  return (
    <View style={styles.padded}>
      <Text style={styles.sectionHeader}>Site Photos</Text>
      <Text style={styles.hint}>Add a comment (optional), then capture a photo. Max 10 photos.</Text>

      <TextInput
        style={styles.commentInput}
        placeholder="Photo comment (optional)..."
        placeholderTextColor="#9ca3af"
        value={commentValue}
        onChangeText={onCommentChange}
        multiline
      />
      <TouchableOpacity
        style={[styles.cameraBtn, photos.length >= 10 && styles.disabledOpacity]}
        onPress={onPickPhoto}
        disabled={photos.length >= 10}
      >
        <Text style={styles.cameraBtnText}>Take Photo ({photos.length}/10)</Text>
      </TouchableOpacity>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.photoRow}>
          {row.map((p, colIdx) => {
            const idx = rowIdx * 2 + colIdx;
            return (
              <View key={idx} style={styles.photoGridCell}>
                <Image source={{ uri: p.dataUrl }} style={styles.gridThumbnail} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => onRemovePhoto(idx)}
                  style={styles.gridRemoveBtn}
                >
                  <Text style={styles.gridRemoveBtnText}>✕</Text>
                </TouchableOpacity>
                {p.comment ? (
                  <Text style={styles.gridComment} numberOfLines={2}>{p.comment}</Text>
                ) : null}
                <Text style={styles.gridTime}>
                  {new Date(p.timestamp).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
          {row.length === 1 && <View style={styles.photoGridCell} />}
        </View>
      ))}
    </View>
  );
}

function ReviewStep({
  service,
  occurrenceDate,
  consumables,
  hasTeamSig,
  hasClientSig,
  photoCount,
  notes,
  onNotesChange,
}: {
  service: MobileService;
  occurrenceDate: string;
  consumables: ConsumableEntry[];
  hasTeamSig: boolean;
  hasClientSig: boolean;
  photoCount: number;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <View style={styles.padded}>
      <Text style={styles.sectionHeader}>Review & Submit</Text>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewLabel}>Client</Text>
        <Text style={styles.reviewValue}>{service.client.name}</Text>
        <Text style={styles.reviewLabel}>Service Date</Text>
        <Text style={styles.reviewValue}>{occurrenceDate}</Text>
        <Text style={styles.reviewLabel}>Team Signature</Text>
        <Text style={[styles.reviewValue, { color: hasTeamSig ? '#059669' : '#ef4444' }]}>
          {hasTeamSig ? 'Captured' : 'Missing'}
        </Text>
        <Text style={styles.reviewLabel}>Client Signature</Text>
        <Text style={[styles.reviewValue, { color: hasClientSig ? '#059669' : '#d97706' }]}>
          {hasClientSig ? 'Captured' : 'Not provided'}
        </Text>
        <Text style={styles.reviewLabel}>Photos</Text>
        <Text style={styles.reviewValue}>{photoCount} photo{photoCount !== 1 ? 's' : ''}</Text>
      </View>

      {consumables.some(c => c.actualQty !== c.plannedQty) && (
        <View style={styles.adjustmentsCard}>
          <Text style={styles.adjustmentsLabel}>Consumable Adjustments</Text>
          {consumables
            .filter(c => c.actualQty !== c.plannedQty)
            .map(c => (
              <Text key={c.id} style={styles.reviewValue}>
                {c.name}: {c.plannedQty} → {c.actualQty}
              </Text>
            ))}
        </View>
      )}

      <Text style={[styles.sectionHeader, styles.notesHeader]}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Any additional notes for this service..."
        placeholderTextColor="#9ca3af"
        value={notes}
        onChangeText={onNotesChange}
        multiline
        numberOfLines={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  progressBar: { height: 4, backgroundColor: '#e5e7eb' },
  progressFill: { height: 4, backgroundColor: '#1e40af' },
  stepIndicator: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  content: { flex: 1 },
  padded: { padding: 16 },
  flex1: { flex: 1 },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  backBtnText: { color: '#374151', fontWeight: '600' },
  nextBtn: {
    flex: 2,
    backgroundColor: '#1e40af',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  submitBtn: {
    flex: 2,
    backgroundColor: '#059669',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabledOpacity: { opacity: 0.6 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  hint: { color: '#6b7280', fontSize: 13, marginBottom: 16 },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#374151', fontSize: 15, textAlign: 'center' },
  emptySubText: { color: '#9ca3af', fontSize: 13, marginTop: 8 },
  consumableRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  consumableRowDiff: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  consumableName: { fontWeight: '600', color: '#111827', fontSize: 14 },
  consumablePlanned: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  qtyInputWrapper: { alignItems: 'flex-end' },
  qtyInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  qtyInputDiff: { borderColor: '#f59e0b', backgroundColor: '#fef9c3', color: '#92400e' },
  diffLabel: { color: '#d97706', fontSize: 12, fontWeight: '700', marginTop: 4 },
  signatureBox: {
    height: 280,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  sigPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  sigSaved: { color: '#059669', fontWeight: '600' },
  clearLink: { color: '#ef4444', fontSize: 13 },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 60,
    marginBottom: 10,
  },
  cameraBtn: {
    backgroundColor: '#1e40af',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  photoGridCell: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  gridThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  gridRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRemoveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  gridComment: {
    color: '#374151',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  gridTime: {
    color: '#9ca3af',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  adjustmentsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftColor: '#f59e0b',
    borderLeftWidth: 4,
  },
  adjustmentsLabel: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  reviewLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  reviewValue: { color: '#111827', fontSize: 14, marginTop: 2 },
  notesHeader: { marginTop: 16 },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
