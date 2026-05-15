import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { styles } from './styles/organ-select.styles';

const ORGANS = ['잎', '꽃', '열매', '줄기', '전체'] as const;
type Organ = typeof ORGANS[number];

const ORGAN_EMOJI: Record<Organ, string> = {
  '잎': '🌿',
  '꽃': '🌸',
  '열매': '🍎',
  '줄기': '🌱',
  '전체': '🌳',
};

const ORGAN_API_MAP: Record<Organ, string> = {
  '잎': 'leaf',
  '꽃': 'flower',
  '열매': 'fruit',
  '줄기': 'bark',
  '전체': 'auto',
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

  const handleSkip = () => {
    const filled: Record<number, Organ> = { ...organMap };
    uris.forEach((_, i) => { if (!filled[i]) filled[i] = '전체'; });
    navigate(filled);
  };

  const handleNext = () => {
    if (allAssigned) {
      navigate(organMap);
    } else {
      let next = uris.findIndex((_, i) => i > selectedPhotoIdx && organMap[i] === undefined);
      if (next === -1) next = uris.findIndex((_, i) => organMap[i] === undefined);
      if (next !== -1) setSelectedPhotoIdx(next);
    }
  };

  const navigate = (map: Record<number, Organ>) => {
    const organs = uris.map((_, i) => ORGAN_API_MAP[map[i] ?? '전체']);
    router.push({
      pathname: '/add-plant/analyzing',
      params: { photoUris, organs: JSON.stringify(organs) },
    });
  };

  const currentOrgan = organMap[selectedPhotoIdx];

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
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
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, styles.grayBtn]} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={styles.grayBtnText}>잘 모르겠어요</Text>
          <Text style={styles.grayBtnSub}>내가 부위를 식별해요</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>{allAssigned ? '검색' : '다음'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
