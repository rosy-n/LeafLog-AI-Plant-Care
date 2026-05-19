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

const FONT = "NeoDunggeunmoPro-Regular";

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
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>알림</Text>
                </View>

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
                                color="#C8D8BC"
                            />
                            <Text style={styles.emptyText}>알림이 없어요</Text>
                        </View>
                    )}
                </ScrollView>

                {/* 하단 닫기 버튼 */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close" size={26} color="#2B3E25" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },
    safe: {
        flex: 1,
    },

    header: {
        height: 60,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    headerTitle: {
        fontFamily: FONT,
        fontSize: 25,
        color: "#111111",
        includeFontPadding: false,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 20,
        gap: 16,
        flexGrow: 1,
    },

    section: {
        gap: 10,
    },

    sectionLabel: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#5A8A5A",
        includeFontPadding: false,
    },

    sectionDividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#E0EBCD",
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        overflow: "hidden",
        paddingRight: 16,
        paddingVertical: 6,
        gap: 12,
    },
    cardUnread: {
        backgroundColor: "#F4FBF0",
        borderColor: "#B8D8A8",
    },
    unreadBar: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: "#5A9A5A",
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    plantImage: {
        width: 72,
        height: 72,
        marginLeft: 8,
    },
    cardBody: {
        flex: 1,
        gap: 5,
    },
    title: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#8AA880",
        includeFontPadding: false,
    },
    speech: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#1E3D1C",
        includeFontPadding: false,
        lineHeight: 20,
    },
    time: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#9AAA90",
        includeFontPadding: false,
    },

    emptyArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingTop: 80,
    },
    emptyText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#B0C0A8",
        includeFontPadding: false,
    },

    footer: {
        height: 80,
        justifyContent: "center",
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: "#EEF5E6",
    },
    closeBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#D0E8C0",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#335235",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
});