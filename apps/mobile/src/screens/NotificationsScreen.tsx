import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import PlantImage from "../components/PlantImage";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

export type CareNotice = {
    id: string;
    /** 카드를 눌렀을 때 어디로 보낼지 — 물주기는 개체탭, 월 1회 갱신은 갱신 흐름 */
    kind: "WATERING" | "MONTHLY_REFRESH";
    plantId: string;
    title: string;
    speech: string;
    when: string;
    /** 지금 할 일 (예정일이 지났거나 오늘) */
    urgent: boolean;
    imageUri: string | null;
    imageKey?: string;
};

/**
 * 돌봄 알림 목록.
 *
 * 기기에 도착한 알림 이력을 저장하지 않고 서버 일정에서 계산한 목록을 보여준다.
 * 사용자가 알고 싶은 건 "무엇을 해야 하는지"이고 그건 지금 일정만으로 답할 수 있다.
 * 그래서 읽음 표시가 없다 — 할 일이 없어지면 목록에서 사라진다.
 */
export default function NotificationsScreen({
    navigation,
    notices,
    plants,
}: {
    navigation: any;
    notices: CareNotice[];
    plants: any[];
}) {
    // 갱신 카드는 개체탭이 아니라 갱신 흐름으로 보낸다 —
    // 이 카드를 누르는 것이 곧 "지금 갱신하겠다"는 뜻이다
    const openNotice = (notice: CareNotice) => {
        const target = plants?.find((p) => p.id === notice.plantId);
        if (!target) return;
        navigation.navigate(
            notice.kind === "MONTHLY_REFRESH" ? "MonthlyRefresh" : "PlantDetail",
            { plant: target },
        );
    };

    const urgentItems = notices.filter((n) => n.urgent);
    const upcomingItems = notices.filter((n) => !n.urgent);

    const renderCard = (item: CareNotice) => (
        <TouchableOpacity
            key={item.id}
            style={[styles.card, item.urgent && styles.cardUnread]}
            onPress={() => openNotice(item)}
            activeOpacity={0.8}
        >
            {item.urgent && <View style={styles.unreadBar} />}
            <PlantImage
                uri={item.imageUri ?? undefined}
                imageKey={item.imageKey}
                width={56}
                height={56}
                style={undefined}
            />
            <View style={styles.cardBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.speech}>{`“${item.speech}”`}</Text>
                <Text style={styles.time}>{item.when}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <ScreenHeader title="알림" onBack={() => navigation.goBack()} />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {urgentItems.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>지금 할 일</Text>
                            {urgentItems.map(renderCard)}
                        </View>
                    )}

                    {upcomingItems.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionDividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.sectionLabel}>예정</Text>
                                <View style={styles.dividerLine} />
                            </View>
                            {upcomingItems.map(renderCard)}
                        </View>
                    )}

                    {urgentItems.length === 0 && upcomingItems.length === 0 && (
                        <View style={styles.emptyArea}>
                            <Ionicons
                                name="notifications-off-outline"
                                size={40}
                                color={GreenTint.soft}
                            />
                            <Text style={styles.emptyText}>돌봐야 할 식물이 없어요</Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    scrollContent: {
        ...screenContent,
        flexGrow: 1,
    },

    section: {
        gap: Spacing.md,
    },

    sectionLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    sectionDividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        marginTop: Spacing.xs,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: GreenTint.soft,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        overflow: "hidden",
        paddingRight: Spacing.lg,
        paddingVertical: Spacing.sm,
        gap: Spacing.md,
    },
    cardUnread: {
        backgroundColor: Colors.background,
        borderColor: GreenTint.soft,
    },
    unreadBar: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: GreenTint.medium,
        borderTopLeftRadius: Radius.lg,
        borderBottomLeftRadius: Radius.lg,
    },
    cardBody: {
        flex: 1,
        gap: Spacing.xs,
    },
    title: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },
    speech: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.primary,
        includeFontPadding: false,
        lineHeight: 20,
    },
    time: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.line,
        includeFontPadding: false,
    },

    emptyArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.md,
        paddingTop: 80,
    },
    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.line,
        includeFontPadding: false,
    },

});