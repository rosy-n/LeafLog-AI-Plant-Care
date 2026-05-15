import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { common } from './styles/common.styles';
import { styles } from './styles/organ-select.styles';

const ORGANS = ['잎', '꽃', '열매', '줄기'] as const;
const AUTO_ORGAN = '잘 모르겠어요' as const;
type Organ = typeof ORGANS[number] | typeof AUTO_ORGAN;

const ORGAN_EMOJI: Record<Organ, string> = {
  '잎': '🌿',
  '꽃': '🌸',
  '열매': '🍎',
  '줄기': '🌱',
  '잘 모르겠어요': '❓',
};

const ORGAN_API_MAP: Record<Organ, string> = {
  '잎': 'leaf',
  '꽃': 'flower',
  '열매': 'fruit',
  '줄기': 'bark',
  '잘 모르겠어요': 'auto',
};

export default function OrganSelectScreen() {
  const router = useRouter();
  const { photoUris } = useLocalSearchParams<{ photoUris: string }>();

  const uris: string[] = JSON.parse(photoUris ?? '[]');
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [organMap, setOrganMap] = useState<Record<number, Organ>>({});

  const allAssigned = uris.every((_, i) => organMap[i] !== undefined);
  const isMultiple = uris.length > 1;

  const handleOrganSelect = (organ: Organ) => {
    setOrganMap((prev) => ({ ...prev, [selectedPhotoIdx]: organ }));
  };

  const handleNext = () => {
    if (allAssigned) {
      const organs = uris.map((_, i) => ORGAN_API_MAP[organMap[i]] ?? 'auto');
      router.push({
        pathname: '/add-plant/analyzing',
        params: { photoUris, organs: JSON.stringify(organs) },
      });
    } else {
      let next = uris.findIndex((_, i) => i > selectedPhotoIdx && organMap[i] === undefined);
      if (next === -1) next = uris.findIndex((_, i) => organMap[i] === undefined);
      if (next !== -1) setSelectedPhotoIdx(next);
    }
  };

  const currentOrgan = organMap[selectedPhotoIdx];

  return (
    <View style={styles.container}>
      <Text style={[common.title, styles.titleOverride]} numberOfLines={1}>
        {isMultiple ? '사진마다 부위를 선택해주세요' : '사진의 부위를 선택해주세요'}
      </Text>

      {/* Thumbnail strip — only when multiple photos */}
      {isMultiple && (
        <FlatList
          horizontal
          data={uris}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.photoStrip}
          style={styles.photoStripList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.photoThumb, index === selectedPhotoIdx && styles.photoThumbSelected]}
              onPress={() => setSelectedPhotoIdx(index)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item }} style={styles.photoThumbImage} resizeMode="cover" />
              {organMap[index] !== undefined && (
                <View style={styles.organTag}>
                  <Text style={styles.organTagText}>{organMap[index]}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Label only for multiple photos */}
      {isMultiple && <Text style={styles.selectedLabel}>선택된 사진</Text>}

      {/* Large photo preview */}
      <View style={styles.largePhotoContainer}>
        <Image
          source={{ uri: uris[selectedPhotoIdx] }}
          style={styles.largePhoto}
          resizeMode="cover"
        />
      </View>

      {/* Organ selection */}
      <View style={styles.organSection}>
        <Text style={styles.organLabel}>이 사진의 부위를 선택하세요</Text>
        <View style={styles.organChips}>
          {ORGANS.map((organ) => (
            <TouchableOpacity
              key={organ}
              style={[styles.organChip, currentOrgan === organ && styles.organChipActive]}
              onPress={() => handleOrganSelect(organ)}
              activeOpacity={0.8}
            >
              <Text style={styles.organChipEmoji}>{ORGAN_EMOJI[organ]}</Text>
              <Text style={[styles.organChipText, currentOrgan === organ && styles.organChipTextActive]}>
                {organ}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.organChipWide, currentOrgan === AUTO_ORGAN && styles.organChipActive]}
          onPress={() => handleOrganSelect(AUTO_ORGAN)}
          activeOpacity={0.8}
        >
          <Text style={styles.organChipEmoji}>{ORGAN_EMOJI[AUTO_ORGAN]}</Text>
          <View>
            <Text style={[styles.organChipText, currentOrgan === AUTO_ORGAN && styles.organChipTextActive]}>
              잘 모르겠어요
            </Text>
            <Text style={styles.organChipSub}>AI가 부위를 식별해요</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>{allAssigned ? '검색' : '다음'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
