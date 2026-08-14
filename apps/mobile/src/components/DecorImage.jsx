import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

/*
    꾸미기 이미지 — 번들 사본을 먼저 그리고, 원격(S3) 이미지가 다 받아지면 바꿔 끼운다.

    같은 그림이 앱 번들과 S3 양쪽에 있다. 원격만 쓰면 화면을 열 때마다 다운로드를
    기다려야 하고(스프라이트가 장당 600KB 대라 눈에 띄게 늦다), 번들만 쓰면 서버에서
    그림을 갈아끼워도 앱을 새로 배포하기 전엔 반영되지 않는다. 그래서 둘 다 쓴다 —
    첫 프레임은 번들로 즉시 그리고, 원격이 준비되면 그때 교체한다.

    한쪽만 있으면 있는 쪽을 그대로 그린다(교체용 View 를 만들지 않는다).
*/
export default function DecorImage({ remote, fallback, style, resizeMode = "contain" }) {
    /*
        "다 받았다"를 boolean 이 아니라 URL 로 기억한다 — 미리보기처럼 한 자리에서
        source 만 바뀌는 경우, boolean 이면 이전 아이템의 완료 상태가 남아
        번들 사본이 가려진 채 새 URL 을 기다리는 동안 빈 칸이 보인다.
    */
    const [loadedUri, setLoadedUri] = useState(null);
    const uri = remote?.uri ?? null;
    const remoteReady = uri !== null && loadedUri === uri;

    if (!remote) {
        return fallback ? (
            <Image source={fallback} style={style} resizeMode={resizeMode} />
        ) : null;
    }
    if (!fallback) {
        return <Image source={remote} style={style} resizeMode={resizeMode} />;
    }

    // style 에 크기가 들어 있으므로 컨테이너가 그 크기를 잡고 두 장을 겹쳐 둔다.
    // 언마운트하지 않고 감추기만 해서, 교체 순간에 빈 칸이 보이지 않게 한다.
    return (
        <View style={style}>
            <Image
                source={fallback}
                style={[StyleSheet.absoluteFill, remoteReady && styles.hidden]}
                resizeMode={resizeMode}
            />
            <Image
                source={remote}
                style={[StyleSheet.absoluteFill, !remoteReady && styles.hidden]}
                resizeMode={resizeMode}
                onLoad={() => setLoadedUri(uri)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    hidden: {
        opacity: 0,
    },
});