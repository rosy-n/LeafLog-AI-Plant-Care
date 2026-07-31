import React, { useState } from "react";
import { useFonts } from "expo-font";
import { Fonts, FontSizes } from "./constants/fonts";
import { Colors } from "./constants/colors";
import { Spacing, Radius } from "./constants/spacing";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  checkEmail,
  login,
  setAuthToken,
  signup,
  type AuthResponse,
} from "./src/api";
import MainApp from "./App.js";
import AppButton from "./src/components/AppButton";
import BackButton from "./src/components/BackButton";
import PixelButton from "./src/components/PixelButton";

type Screen = "home" | "login" | "signup" | "nickname";
type CheckStatus = "idle" | "checking" | "available" | "taken";
type FormErrors = Partial<{
  loginEmail: string;
  loginPassword: string;
  signupEmail: string;
  signupPassword: string;
  signupConfirm: string;
  terms: string;
  nickname: string;
  emailCheck: string;
  api: string;
}>;

const assets = {
  landingBg: require("./assets/images/login-bg.png"),
  plant: require("./assets/home-plant.png"),
  meadow: require("./assets/home-meadow.png"),
  leaf: require("./assets/repot-title-icon.png"),
};


// login-bg.png 실측값. 배경이 잘려도 텍스트·버튼이 그림과 어긋나지 않게
// 세로 비율로 기준선을 잡는다.
//  titleAnchor  타이틀 블록(LeafLog+멘트) 시작점 —
//               상단 새싹 아이콘(0.22)과 식물(0.43) 사이
//  groundAnchor 잔디 아래끝 — 버튼은 이 아래에 놓인다
//  actionsMaxTop 버튼이 화면 밖으로 밀리지 않게 하는 상한(화면 높이 비율)
//  lift         배경·타이틀·버튼을 함께 끌어올리는 양(렌더 높이 비율)
const LANDING_BG = {
  width: 851,
  height: 1849,
  titleAnchor: 0.25,
  groundAnchor: 0.762,
  actionsMaxTop: 0.78,
  lift: 0.05,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

function passwordError(password: string) {
  if (!password) return "비밀번호를 입력해주세요.";
  if (password.length < 8) return "비밀번호는 8자 이상이어야 해요.";
  if (!/[A-Za-z]/.test(password)) return "비밀번호에 영문을 포함해주세요.";
  if (!/\d/.test(password)) return "비밀번호에 숫자를 포함해주세요.";
  return undefined;
}

function validateNickname(nickname: string) {
  return /^[가-힣A-Za-z0-9]{2,10}$/.test(nickname);
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / 402, height / 874, 1);
  const appWidth = Math.min(width, 402);

  // 랜딩/인증 화면에서도 커스텀 폰트가 필요 — MainApp 진입 전에 미리 로드
  const [fontsLoaded] = useFonts({
    [Fonts.neoDunggeunmo]: require("./assets/fonts/NeoDunggeunmoPro-Regular.ttf"),
    [Fonts.nanumSquareNeo.light]: require("./assets/fonts/NanumSquareNeo-aLt.ttf"),
    [Fonts.nanumSquareNeo.regular]: require("./assets/fonts/NanumSquareNeo-bRg.ttf"),
    [Fonts.nanumSquareNeo.bold]: require("./assets/fonts/NanumSquareNeo-cBd.ttf"),
    [Fonts.nanumSquareNeo.extraBold]: require("./assets/fonts/NanumSquareNeo-dEb.ttf"),
    [Fonts.nanumSquareNeo.heavy]: require("./assets/fonts/NanumSquareNeo-eHv.ttf"),
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<CheckStatus>("idle");

  const allRequiredAgreed = agreeTerms && agreePrivacy;
  const allAgreed = allRequiredAgreed && agreeMarketing;

  function toggleAllTerms() {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeMarketing(next);
    setFormErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.terms;
      return nextErrors;
    });
  }

  function clearError(...keys: (keyof FormErrors)[]) {
    setFormErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  }

  function resetLoginForm() {
    setLoginEmail("");
    setLoginPassword("");
    setShowLoginPassword(false);
  }

  function resetSignupForm() {
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
    setNickname("");
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeMarketing(false);
    setShowSignupPassword(false);
    setShowSignupConfirm(false);
    setEmailCheckStatus("idle");
  }

  function resetAuthForms() {
    resetLoginForm();
    resetSignupForm();
    setFormErrors({});
    setIsSubmitting(false);
  }

  function goHome() {
    resetAuthForms();
    setScreen("home");
  }

  function goLogin() {
    resetAuthForms();
    setScreen("login");
  }

  function goSignup() {
    resetAuthForms();
    setScreen("signup");
  }

  function requireSignupBasics() {
    const email = signupEmail.trim();
    const errors: FormErrors = {};

    if (!email) errors.signupEmail = "이메일을 입력해주세요.";
    else if (!EMAIL_PATTERN.test(email)) errors.signupEmail = "올바른 이메일 형식이 아니에요.";
    else if (emailCheckStatus !== "available") {
      errors.emailCheck =
        emailCheckStatus === "taken"
          ? "이미 가입된 이메일이에요."
          : "이메일 중복확인을 해주세요.";
    }

    const nextPasswordError = passwordError(signupPassword);
    if (nextPasswordError) errors.signupPassword = nextPasswordError;

    if (!signupConfirm) errors.signupConfirm = "비밀번호 확인을 입력해주세요.";
    else if (signupPassword !== signupConfirm) {
      errors.signupConfirm = "비밀번호가 서로 일치하지 않아요.";
    }

    if (!allRequiredAgreed) errors.terms = "필수 약관에 동의해주세요.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleLogin() {
    const email = loginEmail.trim();
    const errors: FormErrors = {};

    if (!email) errors.loginEmail = "이메일을 입력해주세요.";
    else if (!EMAIL_PATTERN.test(email)) errors.loginEmail = "올바른 이메일 형식이 아니에요.";
    if (!loginPassword) errors.loginPassword = "비밀번호를 입력해주세요.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);
    try {
      const response = await login({ email, password: loginPassword });
      setAuthToken(response.access_token);
      setAuth(response);
    } catch (error) {
      setFormErrors({
        api: error instanceof Error ? error.message : "다시 시도해주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup() {
    const trimmedNickname = nickname.trim();
    if (!validateNickname(trimmedNickname)) {
      setFormErrors({
        nickname: "닉네임은 2~10자, 한글/영문/숫자만 사용할 수 있어요.",
      });
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
      const response = await signup({
        email: signupEmail.trim(),
        password: signupPassword,
        nickname: trimmedNickname,
        marketing_opt_in: agreeMarketing,
      });
      setAuthToken(response.access_token);
      setAuth(response);
    } catch (error) {
      setFormErrors({
        api: error instanceof Error ? error.message : "다시 시도해주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailCheck() {
    const email = signupEmail.trim();

    if (!email) {
      setFormErrors((current) => ({
        ...current,
        signupEmail: "이메일을 입력해주세요.",
        emailCheck: undefined,
      }));
      setEmailCheckStatus("idle");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setFormErrors((current) => ({
        ...current,
        signupEmail: "올바른 이메일 형식이 아니에요.",
        emailCheck: undefined,
      }));
      setEmailCheckStatus("idle");
      return;
    }

    setEmailCheckStatus("checking");
    clearError("signupEmail", "emailCheck", "api");

    try {
      const result = await checkEmail(email);
      setEmailCheckStatus(result.available ? "available" : "taken");
      setFormErrors((current) => ({
        ...current,
        emailCheck: result.available
          ? "사용 가능한 이메일이에요."
          : "이미 가입된 이메일이에요.",
      }));
    } catch (error) {
      setEmailCheckStatus("idle");
      setFormErrors((current) => ({
        ...current,
        emailCheck:
          error instanceof Error ? error.message : "이메일 중복확인에 실패했어요.",
      }));
    }
  }

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#8FCB7D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#2F7831" />
      </View>
    );
  }

  if (auth) {
    return <MainApp user={auth.user} />;
  }

  // 랜딩은 배경 이미지가 화면 정중앙을 기준으로 꽉 차야 하므로
  // 402x874 고정 프레임 밖에서 전체 화면으로 렌더한다
  if (screen === "home") {
    return (
      <View style={styles.landingRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <HomeScreen onLogin={goLogin} onSignup={goSignup} />
      </View>
    );
  }

  const frameStyle = {
    width: appWidth,
    minHeight: height,
    transform: [{ scale }],
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={[styles.frame, frameStyle]}>
          {screen === "login" && (
            <LoginScreen
              email={loginEmail}
              password={loginPassword}
              errors={formErrors}
              showPassword={showLoginPassword}
              isSubmitting={isSubmitting}
              onBack={goHome}
              onEmail={(value) => {
                setLoginEmail(value);
                clearError("loginEmail", "api");
              }}
              onPassword={(value) => {
                setLoginPassword(value);
                clearError("loginPassword", "api");
              }}
              onTogglePassword={() => setShowLoginPassword((value) => !value)}
              onSubmit={handleLogin}
            />
          )}
          {screen === "signup" && (
            <SignupScreen
              email={signupEmail}
              password={signupPassword}
              confirm={signupConfirm}
              agreeTerms={agreeTerms}
              agreePrivacy={agreePrivacy}
              agreeMarketing={agreeMarketing}
              allAgreed={allAgreed}
              errors={formErrors}
              emailCheckStatus={emailCheckStatus}
              showPassword={showSignupPassword}
              showConfirm={showSignupConfirm}
              onBack={goHome}
              onEmail={(value) => {
                setSignupEmail(value);
                setEmailCheckStatus("idle");
                clearError("signupEmail", "emailCheck", "api");
              }}
              onPassword={(value) => {
                setSignupPassword(value);
                clearError("signupPassword", "signupConfirm", "api");
              }}
              onConfirm={(value) => {
                setSignupConfirm(value);
                clearError("signupConfirm", "api");
              }}
              onToggleAll={toggleAllTerms}
              onToggleTerms={() => {
                setAgreeTerms((value) => !value);
                clearError("terms", "api");
              }}
              onTogglePrivacy={() => {
                setAgreePrivacy((value) => !value);
                clearError("terms", "api");
              }}
              onToggleMarketing={() => setAgreeMarketing((value) => !value)}
              onTogglePassword={() => setShowSignupPassword((value) => !value)}
              onToggleConfirm={() => setShowSignupConfirm((value) => !value)}
              onCheckEmail={handleEmailCheck}
              onNext={() => {
                if (requireSignupBasics()) setScreen("nickname");
              }}
            />
          )}
          {screen === "nickname" && (
            <NicknameScreen
              nickname={nickname}
              error={formErrors.nickname}
              apiError={formErrors.api}
              isSubmitting={isSubmitting}
              onBack={() => {
                setFormErrors({});
                setScreen("signup");
              }}
              onNickname={(value) => {
                setNickname(value);
                clearError("nickname", "api");
              }}
              onSubmit={handleSignup}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen({
  onLogin,
  onSignup,
}: {
  onLogin: () => void;
  onSignup: () => void;
}) {
  const { width, height } = useWindowDimensions();

  // cover로 화면 중앙에 놓인 배경의 실제 위치를 역산해서, 배경·타이틀·버튼을
  // lift만큼 같이 끌어올린다. 타이틀은 배경 새싹 아이콘과 식물 캐릭터 사이,
  // 버튼은 잔디 아래끝 기준으로 배치. (배경 아래쪽은 원본 여백이라 노출되는
  // 띠는 Colors.background와 사실상 동색)
  const imageScale = Math.max(width / LANDING_BG.width, height / LANDING_BG.height);
  const imageHeight = LANDING_BG.height * imageScale;
  const imageTop = (height - imageHeight) / 2 - imageHeight * LANDING_BG.lift;
  const titleTop = Math.max(
    imageTop + imageHeight * LANDING_BG.titleAnchor,
    Spacing.huge2,
  );
  const actionsTop = Math.min(
    imageTop + imageHeight * LANDING_BG.groundAnchor + Spacing.xxxl,
    height * LANDING_BG.actionsMaxTop,
  );

  return (
    <ImageBackground
      source={assets.landingBg}
      style={styles.screen}
      imageStyle={{ transform: [{ translateY: -imageHeight * LANDING_BG.lift }] }}
      resizeMode="cover"
    >
      <View style={[styles.landingTitle, { top: titleTop }]}>
        <Text style={styles.brandText}>LeafLog</Text>
        <Text style={styles.tagline}>매일 쌓이는 초록의 기록</Text>
      </View>
      <View style={[styles.landingActions, { top: actionsTop }]}>
        <PixelButton label="로그인" size="lg" onPress={onLogin} />
        <PixelButton
          label="회원가입"
          color={Colors.background}
          size="lg"
          onPress={onSignup}
        />
      </View>
    </ImageBackground>
  );
}

function LoginScreen(props: {
  email: string;
  password: string;
  errors: FormErrors;
  showPassword: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
}) {
  return (
    <AuthScaffold onBack={props.onBack}>
      <AuthHeader title="로그인" subtitle="다시 만나서 반가워요!" pixel />
      <View style={styles.form}>
        <Field label="이메일" error={props.errors.loginEmail} pixel>
          <TextInput
            value={props.email}
            onChangeText={props.onEmail}
            placeholder="이메일을 입력해주세요"
            placeholderTextColor={Colors.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              styles.pixelText,
              props.errors.loginEmail && styles.inputError,
            ]}
          />
        </Field>
        <Field label="비밀번호" error={props.errors.loginPassword} pixel>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.password}
              onChangeText={props.onPassword}
              placeholder="비밀번호를 입력해주세요"
              placeholderTextColor={Colors.textFaint}
              secureTextEntry={!props.showPassword}
              style={[
                styles.input,
                styles.pixelText,
                styles.inputWithIcon,
                props.errors.loginPassword && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showPassword} onPress={props.onTogglePassword} pixel />
          </View>
        </Field>
        <Pressable style={styles.forgot} onPress={() => Alert.alert("준비 중", "비밀번호 찾기는 다음 단계에서 연결하면 됩니다.")}>
          <Text style={[styles.forgotText, styles.pixelText]}>비밀번호를 잊으셨나요?</Text>
        </Pressable>
        {/* PixelButton은 loading 상태가 없어 제출 중에는 라벨로 알린다 */}
        <PixelButton
          label={props.isSubmitting ? "로그인 중" : "로그인"}
          onPress={props.onSubmit}
          size="lg"
          disabled={props.isSubmitting}
          style={styles.loginButton}
        />
        <FormMessage message={props.errors.api} pixel />
      </View>
    </AuthScaffold>
  );
}

function SignupScreen(props: {
  email: string;
  password: string;
  confirm: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  allAgreed: boolean;
  errors: FormErrors;
  emailCheckStatus: CheckStatus;
  showPassword: boolean;
  showConfirm: boolean;
  onBack: () => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onToggleAll: () => void;
  onToggleTerms: () => void;
  onTogglePrivacy: () => void;
  onToggleMarketing: () => void;
  onTogglePassword: () => void;
  onToggleConfirm: () => void;
  onCheckEmail: () => void;
  onNext: () => void;
}) {
  return (
    <AuthScaffold onBack={props.onBack}>
      <AuthHeader
        title="회원가입"
        subtitle="LeafLog와 함께 시작해요!"
        compact
        pixel
        icon={false}
        heart={false}
      />
      <View style={styles.signupForm}>
        <Field
          label="이메일"
          compact
          pixel
          error={props.errors.signupEmail}
          message={props.errors.emailCheck}
          messageTone={props.emailCheckStatus === "available" ? "success" : "error"}
        >
          <View style={styles.checkRow}>
            <TextInput
              value={props.email}
              onChangeText={props.onEmail}
              placeholder="이메일을 입력해주세요"
              placeholderTextColor={Colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                styles.pixelText,
                styles.signupInput,
                styles.checkInput,
                props.errors.signupEmail && styles.inputError,
              ]}
            />
            <SmallButton
              label={props.emailCheckStatus === "checking" ? "확인중" : "중복확인"}
              disabled={props.emailCheckStatus === "checking"}
              onPress={props.onCheckEmail}
            />
          </View>
        </Field>
        <Field label="비밀번호" compact pixel error={props.errors.signupPassword}>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.password}
              onChangeText={props.onPassword}
              placeholder="8자 이상, 영문/숫자 조합"
              placeholderTextColor={Colors.textFaint}
              secureTextEntry={!props.showPassword}
              style={[
                styles.input,
                styles.pixelText,
                styles.signupInput,
                styles.inputWithIcon,
                props.errors.signupPassword && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showPassword} onPress={props.onTogglePassword} pixel />
          </View>
        </Field>
        <Field label="비밀번호 확인" compact pixel error={props.errors.signupConfirm}>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.confirm}
              onChangeText={props.onConfirm}
              placeholder="비밀번호를 다시 입력해주세요"
              placeholderTextColor={Colors.textFaint}
              secureTextEntry={!props.showConfirm}
              style={[
                styles.input,
                styles.pixelText,
                styles.signupInput,
                styles.inputWithIcon,
                props.errors.signupConfirm && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showConfirm} onPress={props.onToggleConfirm} pixel />
          </View>
        </Field>
        <View style={styles.terms}>
          <TermRow label="모두 동의합니다" checked={props.allAgreed} onPress={props.onToggleAll} strong />
          <TermRow label="[필수] 서비스 이용약관 동의" checked={props.agreeTerms} onPress={props.onToggleTerms} />
          <TermRow label="[필수] 개인정보 수집 및 이용 동의" checked={props.agreePrivacy} onPress={props.onTogglePrivacy} />
          <TermRow label="[선택] 마케팅 정보 수신 동의" checked={props.agreeMarketing} onPress={props.onToggleMarketing} />
        </View>
        <FormMessage message={props.errors.terms} pixel />
      </View>
      <PixelButton
        label="회원가입"
        onPress={props.onNext}
        size="lg"
        style={styles.signupButton}
      />
    </AuthScaffold>
  );
}

function NicknameScreen(props: {
  nickname: string;
  error?: string;
  apiError?: string;
  isSubmitting: boolean;
  onBack: () => void;
  onNickname: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.screen}>
      <BackButton onPress={props.onBack} style={styles.backButton} />
      <ScrollView
        contentContainerStyle={styles.nicknameScroll}
        keyboardShouldPersistTaps="handled"
        // 키보드가 올라오면 그만큼 스크롤 영역을 밀어 입력창이 가리지 않게 한다
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.nickTitle}>어떻게 불러드릴까요?</Text>
        <Text style={styles.nickCopy}>닉네임은 앱 내에서{"\n"}다른 식집사들에게 표시돼요!</Text>
        <View style={styles.nickForm}>
          <Field label="닉네임" error={props.error} pixel>
            <View style={styles.inputWrap}>
              <TextInput
                value={props.nickname}
                onChangeText={(value) => props.onNickname(value.slice(0, 10))}
                placeholder="닉네임을 입력해주세요"
                placeholderTextColor={Colors.textFaint}
                autoCapitalize="none"
                style={[
                  styles.input,
                  styles.pixelText,
                  styles.counterInput,
                  props.error && styles.inputError,
                ]}
                maxLength={10}
              />
              <Text style={styles.counter}>{props.nickname.length}/10</Text>
            </View>
          </Field>
          <Text style={styles.hint}>2~10자, 한글/영문/숫자 사용 가능</Text>
          <FormMessage message={props.apiError} pixel />
          {/* PixelButton은 loading 상태가 없어 제출 중에는 라벨로 알린다 */}
          <PixelButton
            label={props.isSubmitting ? "시작하는 중" : "시작하기"}
            onPress={props.onSubmit}
            disabled={props.isSubmitting}
            size="lg"
            style={styles.startButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function DoneScreen({
  nickname,
  onLogout,
}: {
  nickname: string;
  onLogout: () => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.doneContent}>
        <Image source={assets.plant} style={styles.donePlant} />
        <Text style={styles.doneTitle}>{nickname}님, 환영해요!</Text>
        <Text style={styles.doneCopy}>로그인 기능 연결이 완료됐어요.</Text>
        <AppButton label="처음 화면으로" onPress={onLogout} style={styles.doneButton} />
      </View>
      <Image source={assets.meadow} style={[styles.sprite, styles.meadow]} />
    </View>
  );
}

function AuthScaffold({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <View style={styles.screen}>
      <BackButton onPress={onBack} style={styles.backButton} />
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

// pixel: 던근모(픽셀) 글꼴로 렌더 — 로그인·회원가입·닉네임 화면에서 켠다
// icon: 제목 위 잎사귀 아이콘 · heart: 부제 뒤 하트 (회원가입 화면은 둘 다 끈다)
function AuthHeader({
  title,
  subtitle,
  compact = false,
  pixel = false,
  icon = true,
  heart = true,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
  pixel?: boolean;
  icon?: boolean;
  heart?: boolean;
}) {
  return (
    <View style={[styles.authHead, compact && styles.authHeadCompact]}>
      {icon && <Image source={assets.leaf} style={styles.authLeaf} />}
      <Text style={[styles.authTitle, pixel && styles.pixelText]}>{title}</Text>
      <Text style={[styles.authSubtitle, pixel && styles.pixelText]}>
        {subtitle}
        {heart && <Text style={[styles.heart, pixel && styles.pixelText]}> ♡</Text>}
      </Text>
    </View>
  );
}

function Field({
  label,
  children,
  error,
  message,
  messageTone = "error",
  compact = false,
  pixel = false,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  message?: string;
  messageTone?: "error" | "success";
  compact?: boolean;
  pixel?: boolean;
}) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={[styles.label, pixel && styles.pixelText]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[styles.errorText, pixel && styles.pixelText]}>{error}</Text>
      ) : null}
      {message ? (
        <Text
          style={[
            styles.errorText,
            pixel && styles.pixelText,
            messageTone === "success" && styles.successText,
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function PasswordToggle({
  visible,
  onPress,
  pixel = false,
}: {
  visible: boolean;
  onPress: () => void;
  pixel?: boolean;
}) {
  return (
    <Pressable style={styles.passwordToggle} onPress={onPress} hitSlop={8}>
      <Text style={[styles.passwordToggleText, pixel && styles.pixelText]}>
        {visible ? "숨김" : "보기"}
      </Text>
    </Pressable>
  );
}

function FormMessage({
  message,
  tone = "error",
  pixel = false,
}: {
  message?: string;
  tone?: "error" | "success";
  pixel?: boolean;
}) {
  if (!message) return null;

  return (
    <Text
      style={[
        styles.formMessage,
        pixel && styles.pixelText,
        tone === "success" && styles.successText,
      ]}
    >
      {message}
    </Text>
  );
}

function SmallButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        pressed && styles.pressed,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function TermRow({
  label,
  checked,
  strong = false,
  onPress,
}: {
  label: string;
  checked: boolean;
  strong?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.termRow} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.termText, strong && styles.termTextStrong]}>{label}</Text>
      {!strong && <Text style={styles.viewLink}>보기 ›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  landingRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboard: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  frame: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: "hidden",
    // scale(<1)의 기준점이 중앙이면 프레임 위쪽이 화면 아래로 밀려서
    // 뒤로가기 버튼 등 상단 absolute 요소가 통째로 내려간다 → 위쪽 고정
    transformOrigin: "top center",
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    position: "relative",
  },
  // 픽셀 글꼴 오버레이 — 색·크기는 각 스타일에서 오고 글꼴만 바꾼다
  pixelText: {
    fontFamily: Fonts.neoDunggeunmo,
  },
  sprite: {
    position: "absolute",
    resizeMode: "contain",
  },
  // top은 배경 위치에 맞춰 런타임에 계산 (HomeScreen 참고)
  landingTitle: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: "center",
  },
  tagline: {
    marginTop: Spacing.md,
    color: Colors.textGray,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.subtitle,
    lineHeight: 24,
  },
  brandText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.hero,
    lineHeight: 72,
    textShadowColor: Colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  heart: {
    color: Colors.danger,
    fontFamily: Fonts.nanumSquareNeo.heavy,
  },
  meadow: {
    left: 0,
    bottom: 0,
    width: 402,
    height: 78,
    resizeMode: "cover",
  },
  // 배경 잔디 아래 빈 영역에 버튼을 놓아 배경 그림을 가리지 않게 한다
  // (top은 배경 위치에 맞춰 런타임에 계산 — HomeScreen 참고)
  // 픽셀 버튼은 계단형 드롭섀도가 아래로 삐져나와 붙어 보이므로
  // 기본 gap보다 넉넉하게 띄운다 (로그인 위치는 그대로, 회원가입만 내려간다)
  landingActions: {
    position: "absolute",
    left: Spacing.huge2,
    right: Spacing.huge2,
    gap: Spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
  disabledButton: {
    opacity: 0.7,
  },
  authScroll: {
    paddingHorizontal: Spacing.section,
    paddingBottom: Spacing.huge,
  },
  // 글리프·크기는 공용 BackButton이 갖고, 여기서는 위치만 잡는다
  backButton: {
    position: "absolute",
    // SafeArea 상단에서 한 단계만 띄운다 (더 줄이면 안드로이드 상태바에 닿음)
    top: Spacing.lg,
    left: Spacing.lg,
    zIndex: 30,
  },
  authHead: {
    marginTop: 68,
    alignSelf: "center",
    width: 230,
    alignItems: "center",
  },
  authHeadCompact: {
    marginTop: 62,
  },
  authLeaf: {
    width: 31,
    height: 24,
    resizeMode: "contain",
    marginBottom: Spacing.xxs,
  },
  authTitle: {
    color: Colors.primary,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.display,
    lineHeight: 38,
  },
  authSubtitle: {
    marginTop: Spacing.sm,
    color: Colors.textGray,
    fontFamily: Fonts.nanumSquareNeo.regular,
    fontSize: FontSizes.bodyLarge,
    lineHeight: 19,
  },
  form: {
    marginTop: Spacing.section,
  },
  signupForm: {
    marginTop: Spacing.section,
  },
  field: {
    marginBottom: Spacing.xl,
  },
  fieldCompact: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginLeft: Spacing.xxs,
    marginBottom: Spacing.sm,
    color: Colors.textBlack,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.small,
  },
  inputWrap: {
    position: "relative",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkInput: {
    flex: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    color: Colors.textBlack,
    fontFamily: Fonts.nanumSquareNeo.regular,
    fontSize: FontSizes.body,
  },
  signupInput: {
    height: 44,
  },
  inputWithIcon: {
    paddingRight: 54,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 1.5,
  },
  passwordToggle: {
    position: "absolute",
    right: 11,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  passwordToggleText: {
    color: Colors.textGray,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.small,
  },
  errorText: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.xxs,
    color: Colors.danger,
    fontFamily: Fonts.nanumSquareNeo.extraBold,
    fontSize: FontSizes.small,
    lineHeight: 15,
  },
  formMessage: {
    marginTop: Spacing.md,
    color: Colors.danger,
    fontFamily: Fonts.nanumSquareNeo.extraBold,
    fontSize: FontSizes.small,
    lineHeight: 17,
    textAlign: "center",
  },
  successText: {
    color: Colors.primary,
  },
  smallButton: {
    width: 78,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: -1,
  },
  forgotText: {
    color: Colors.primary,
    fontFamily: Fonts.nanumSquareNeo.regular,
    fontSize: FontSizes.small,
    textDecorationLine: "underline",
  },
  loginButton: {
    marginTop: Spacing.huge2,
  },
  terms: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  termRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xs,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.caption,
    lineHeight: 12,
  },
  termText: {
    flex: 1,
    color: Colors.textBlack,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
  },
  termTextStrong: {
    color: Colors.textGray,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
  },
  viewLink: {
    width: 38,
    color: Colors.textBlack,
    textAlign: "right",
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
  },
  signupButton: {
    marginTop: Spacing.xxxl,
  },
  // 제목은 로그인·회원가입 헤더(authHead marginTop: 68)와 같은 시작선에 둔다
  nicknameScroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.section,
    paddingTop: Spacing.huge2 + Spacing.xl,
    paddingBottom: Spacing.huge2,
  },
  nickTitle: {
    color: Colors.primary,
    textAlign: "center",
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.screenTitle,
    lineHeight: 33,
  },
  nickCopy: {
    marginTop: Spacing.lg,
    color: Colors.textGray,
    textAlign: "center",
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    lineHeight: 23,
  },
  nickForm: {
    marginTop: Spacing.huge,
  },
  counterInput: {
    paddingRight: 56,
  },
  counter: {
    position: "absolute",
    top: 16,
    right: 13,
    color: Colors.textGray,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
  },
  hint: {
    marginTop: -14,
    marginLeft: Spacing.xxs,
    color: Colors.textFaint,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
  },
  // 폼 바로 아래에 붙여 둔다 (화면 하단으로 밀지 않음)
  startButton: {
    marginTop: Spacing.huge,
  },
  doneContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.section,
    paddingBottom: 60,
  },
  donePlant: {
    width: 240,
    height: 175,
    resizeMode: "contain",
  },
  doneTitle: {
    marginTop: Spacing.section,
    color: Colors.primary,
    fontFamily: Fonts.nanumSquareNeo.heavy,
    fontSize: FontSizes.screenTitle,
    textAlign: "center",
  },
  doneCopy: {
    marginTop: Spacing.md,
    color: Colors.textGray,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.bodyLarge,
  },
  doneButton: {
    alignSelf: "stretch",
    marginTop: Spacing.huge,
  },
});
