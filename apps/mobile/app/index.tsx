import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

export default function HomeScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🌿 LeafLog</Text>
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/add-plant')}
            >
                <Text style={styles.buttonText}>+ 식물 등록하기</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: 32,
        color: Colors.primary,
        marginBottom: 40,
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        paddingHorizontal: 32,
        paddingVertical: 14,
    },
    buttonText: {
        fontFamily: Fonts.neoDunggeunmo,
        color: Colors.white,
        fontSize: 16,
    },
});