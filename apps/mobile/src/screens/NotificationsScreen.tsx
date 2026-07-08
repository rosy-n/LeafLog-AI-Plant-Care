import React, { useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

const PLANT_IMAGES: Record<string, any> = {
    spaghetti: require("../../assets/plants/spaghetti.png"),
    rubber: require("../../assets/plants/rubber.png"),
    sansevieria: require("../../assets/plants/sansevieria.png"),
    pachira: require("../../assets/plants/pachira.png"),
    myeongrani: require("../../assets/plants/myeongrani.png"),
};

export type AppNotification = {
    id: string;
    plantKey: string;
    title: string;
    speech: string;
    time: string;
    read: boolean;
    isToday: boolean;
};

export default function NotificationsScreen({
    navigation,
    notifications,
    setNotifications,
}: {
    navigation: any;
    notifications: AppNotification[];
    setNotifications: (n: AppNotification[]) => void;
}) {
    useEffect(() => {
        setNotifications(notifications.map((n) => ({ ...n, read: true })));
    }, []);

    const todayItems = notifications.filter((n) => n.isToday);
    const pastItems = notifications.filter((n) => !n.isToday);

    const renderCard = (item: AppNotification) => (
        <View
            key={item.id}
            style={[styles.card, !item.read && styles.cardUnread]}
        >
            {!item.read && <View style={styles.unreadBar} />}
            <Image
                source={PLANT_IMAGES[item.plantKey]}
                style={styles.plantImage}
                resizeMode="contain"
            />
            <View style={styles.cardBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.speech}>{`“${item.speech}”`}</Text>
                <Text style={styles.time}>{item.time}</Text>
            </View>
        </View>
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
                    {todayItems.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>오늘</Text>
                            {todayItems.map(renderCard)}
                        </View>
                    )}

                    {pastItems.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionDividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.sectionLabel}>지난 알림</Text>
                                <View style={styles.dividerLine} />
                            </View>
                            {pastItems.map(renderCard)}
                        </View>
                    )}

                    {todayItems.length === 0 && pastItems.length === 0 && (
                        <View style={styles.emptyArea}>
                            <Ionicons
                                name="notifications-off-outline"
                                size={40}
                                color={GreenTint.soft}
                            />
                            <Text style={styles.emptyText}>알림이 없어요</Text>
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
    plantImage: {
        width: 72,
        height: 72,
        marginLeft: Spacing.sm,
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