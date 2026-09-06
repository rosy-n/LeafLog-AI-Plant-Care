import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { plantImages } from "../data/plants";
import DecorImage from "./DecorImage";

/**
 * @param {{
 *   imageKey?: string,
 *   uri?: string | null,
 *   source?: import("react-native").ImageSourcePropType | null,
 *   expressionSource?: import("react-native").ImageSourcePropType | null,
 *   expressionBounds?: [number, number, number, number] | null,
 *   effectSource?: import("react-native").ImageSourcePropType | null,
 *   effectRemote?: import("react-native").ImageSourcePropType | null,
 *   effectFallback?: import("react-native").ImageSourcePropType | null,
 *   width?: number,
 *   height?: number,
 *   style?: import("react-native").StyleProp<any>,
 * }} props
 */
export default function PlantImage({
                                       imageKey = "spaghetti",
                                       uri = null,
                                       source: explicitSource = null,
                                       expressionSource = null,
                                       expressionBounds = null,
                                       effectSource = null,
                                       effectRemote = null,
                                       effectFallback = null,
                                       width = 160,
                                       height = 160,
                                       style = null,
                                   }) {
    // 원격 URL(S3 등)이 있으면 우선 사용, 없으면 번들 기본 이미지로 fallback
    const source = explicitSource ?? (uri ? { uri } : plantImages[imageKey]);

    const expressionStyle = expressionSource && expressionBounds
        ? createExpressionStyle(expressionSource, expressionBounds)
        : null;
    // 번들 효과가 있는 기존 아이템은 화분 없는 PNG가 정본이다.
    // 예전 서버의 sprite_url은 기본 화분까지 든 통짜 이미지일 수 있으므로 교체하지 않는다.
    const safeEffectRemote = effectFallback ? null : effectRemote;

    if (expressionStyle || effectSource || safeEffectRemote || effectFallback) {
        return (
            <LayeredPlantImage
                key={Image.resolveAssetSource(source)?.uri ?? imageKey}
                source={source}
                width={width}
                height={height}
                style={style}
            >
                {expressionStyle ? (
                    <Image
                        source={expressionSource}
                        style={[styles.expressionLayer, expressionStyle]}
                        resizeMode="contain"
                        pointerEvents="none"
                    />
                ) : null}
                {effectSource ? (
                    <Image
                        source={effectSource}
                        style={styles.layerImage}
                        resizeMode="contain"
                        pointerEvents="none"
                    />
                ) : null}
                {safeEffectRemote || effectFallback ? (
                    <DecorImage
                        remote={safeEffectRemote}
                        fallback={effectFallback}
                        style={styles.layerImage}
                    />
                ) : null}
            </LayeredPlantImage>
        );
    }

    return (
        <Image
            source={source}
            style={[
                styles.image,
                {
                    width,
                    height,
                },
                style,
            ]}
            resizeMode="contain"
        />
    );
}

// Remount on base-image changes so stale load events cannot reveal a new face.
function LayeredPlantImage({ source, width, height, style, children }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    return (
        <View style={[styles.layerStack, { width, height }, style]}>
            <View style={styles.canvasStack}>
                <Image
                    source={source}
                    style={styles.layerImage}
                    resizeMode="contain"
                    onLoad={() => {
                        setFailed(false);
                        setLoaded(true);
                    }}
                    onError={() => {
                        setLoaded(false);
                        setFailed(true);
                        console.warn("캐릭터 이미지를 불러오지 못했어요. 이미지 서버 연결을 확인해주세요.");
                    }}
                />
                {loaded ? children : (
                    <View style={styles.imageStatus} pointerEvents="none">
                        {failed ? (
                            <Ionicons
                                name="image-outline"
                                size={24}
                                color="#748278"
                                accessibilityLabel="캐릭터 이미지를 불러오지 못했어요"
                            />
                        ) : (
                            <ActivityIndicator
                                size="small"
                                color="#748278"
                                accessibilityLabel="캐릭터 이미지 불러오는 중"
                            />
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

function createExpressionStyle(source, bounds) {
    const [left, top, right, bottom] = bounds;
    const resolved = Image.resolveAssetSource(source);
    if (!resolved?.width || !resolved?.height || right <= left || bottom <= top) return null;

    const centerX = (left + right) / 2;
    const targetWidth = right - left;
    const targetHeight = targetWidth * (resolved.height / resolved.width);

    return {
        left: `${((centerX - targetWidth / 2) / 1024) * 100}%`,
        top: `${(top / 1024) * 100}%`,
        width: `${(targetWidth / 1024) * 100}%`,
        height: `${(targetHeight / 1024) * 100}%`,
    };
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: "transparent",
    },
    layerStack: {
        position: "relative",
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
    },
    canvasStack: {
        position: "relative",
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "transparent",
    },
    layerImage: {
        ...StyleSheet.absoluteFill,
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
    },
    expressionLayer: {
        position: "absolute",
        backgroundColor: "transparent",
    },
    imageStatus: {
        ...StyleSheet.absoluteFill,
        alignItems: "center",
        justifyContent: "center",
    },
});
