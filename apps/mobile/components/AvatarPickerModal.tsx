import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../lib/firebase';
import { saveUserProfile, propagateAvatarUpdate } from '@talentbank/firebase-config';
import { AVATAR_TEMPLATES, AvatarTemplate } from '../lib/avatar-templates';
import { Colors, Radius, FontSize } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  uid: string;
  onAvatarUpdated: (newUrl: string) => void;
}

async function uploadToStorage(uid: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.${ext}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

function templateImageSource(template: AvatarTemplate): { uri: string } | ReturnType<typeof require> {
  return 'uri' in template ? { uri: template.uri } : template.source;
}

export default function AvatarPickerModal({ visible, onClose, uid, onAvatarUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleUploadPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const downloadUrl = await uploadToStorage(uid, result.assets[0].uri);
      await saveUserProfile(uid, { photoURL: downloadUrl });
      await propagateAvatarUpdate(uid, downloadUrl);
      onAvatarUpdated(downloadUrl);
      onClose();
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload your photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectTemplate = async (template: AvatarTemplate) => {
    setSelectedId(template.id);
    setUploading(true);
    try {
      let photoURL: string;

      if ('uri' in template) {
        // URL-based template — save directly, no upload needed
        photoURL = template.uri;
      } else {
        // Local asset — resolve URI then upload to Firebase Storage
        const asset = Asset.fromModule(template.source);
        await asset.downloadAsync();
        const localUri = asset.localUri ?? asset.uri;
        photoURL = await uploadToStorage(uid, localUri);
      }

      await saveUserProfile(uid, { photoURL });
      await propagateAvatarUpdate(uid, photoURL);
      onAvatarUpdated(photoURL);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not apply this avatar. Please try again.');
    } finally {
      setUploading(false);
      setSelectedId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose Avatar</Text>

          {/* Upload from camera roll */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleUploadPhoto}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={20} color={Colors.accent} />
            <Text style={styles.uploadBtnText}>Upload from Camera Roll</Text>
          </TouchableOpacity>

          <Text style={styles.orLabel}>— or pick a template —</Text>

          {/* Template grid */}
          <FlatList
            data={AVATAR_TEMPLATES}
            keyExtractor={(item) => item.id}
            numColumns={4}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => {
              const isSelected = selectedId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.templateCell, isSelected && styles.templateCellSelected]}
                  onPress={() => handleSelectTemplate(item)}
                  disabled={uploading}
                  activeOpacity={0.7}
                >
                  <Image
                    source={templateImageSource(item)}
                    style={styles.templateImg}
                  />
                  {isSelected && uploading && (
                    <View style={styles.templateOverlay}>
                      <ActivityIndicator color="#fff" size="small" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />

          {/* Full-sheet upload spinner */}
          {uploading && selectedId === null && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.uploadingText}>Uploading…</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={uploading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const CELL_SIZE = 72;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderAlt,
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadBtnText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  orLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 16,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  templateCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCellSelected: {
    borderColor: Colors.accent,
  },
  templateImg: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
  },
  templateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  uploadingText: {
    color: Colors.textSub,
    fontSize: FontSize.sm,
  },
  cancelBtn: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSub,
    fontWeight: '600',
  },
});
