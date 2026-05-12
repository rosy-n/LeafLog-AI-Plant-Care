import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  signup,
  type AuthResponse,
} from "./src/api";

type Screen = "home" | "login" | "signup" | "nickname" | "done";
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
  cloudLeft: require("./assets/home-cloud-left.png"),
  cloudRight: require("./assets/home-cloud-right.png"),
  plant: require("./assets/home-plant.png"),
  meadow: require("./assets/home-meadow.png"),
  leaf: require("./assets/repot-title-icon.png"),
  nicknameSun: require("./assets/nickname-sun.png"),
  nicknamePlant: require("./assets/nickname-plant-scene.png"),
};

const colors = {
  paper: "#fffdf5",
  ink: "#1e1f1d",
  muted: "#807d74",
  line: "#d9d2c2",
  green: "#4f8d3d",
  greenDark: "#1b5a26",
  heart: "#ff6f61",
};

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

  const nicknameGreeting = useMemo(() => {
    const trimmed = nickname.trim();
    return trimmed.length > 0 ? `안녕하세요, ${trimmed}님!` : "안녕하세요, 초록님!";
  }, [nickname]);

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
      setAuth(response);
      setScreen("done");
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
      setAuth(response);
      setScreen("done");
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

  const frameStyle = {
    width: appWidth,
    minHeight: height,
    transform: [{ scale }],
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={[styles.frame, frameStyle]}>
          {screen === "home" && (
            <HomeScreen
              onLogin={goLogin}
              onSignup={goSignup}
            />
          )}
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
              greeting={nicknameGreeting}
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
          {screen === "done" && (
            <DoneScreen
              nickname={auth?.user.nickname || "초록"}
              onLogout={() => {
                setAuth(null);
                resetAuthForms();
                setScreen("home");
              }}
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
  return (
    <View style={styles.screen}>
      <Image source={assets.cloudLeft} style={[styles.sprite, styles.cloudLeft]} />
      <Image source={assets.cloudRight} style={[styles.sprite, styles.cloudRight]} />
      <View style={styles.landingTitle}>
        <Image source={assets.leaf} style={styles.titleLeaf} />
        <Text style={styles.brandText}>LeafLog</Text>
        <Text style={styles.tagline}>
          작은 식물, 큰 행복 <Text style={styles.heart}>♡</Text>
        </Text>
      </View>
      <Image source={assets.plant} style={[styles.sprite, styles.landingPlant]} />
      <View style={styles.landingActions}>
        <PixelButton label="로그인" onPress={onLogin} />
        <PixelButton label="회원가입" variant="secondary" onPress={onSignup} />
      </View>
      <Image source={assets.meadow} style={[styles.sprite, styles.meadow]} />
    </View>
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
      <AuthHeader title="로그인" subtitle="다시 만나서 반가워요!" />
      <View style={styles.form}>
        <Field label="이메일" error={props.errors.loginEmail}>
          <TextInput
            value={props.email}
            onChangeText={props.onEmail}
            placeholder="이메일을 입력해주세요"
            placeholderTextColor="#b7b4ae"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, props.errors.loginEmail && styles.inputError]}
          />
        </Field>
        <Field label="비밀번호" error={props.errors.loginPassword}>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.password}
              onChangeText={props.onPassword}
              placeholder="비밀번호를 입력해주세요"
              placeholderTextColor="#b7b4ae"
              secureTextEntry={!props.showPassword}
              style={[
                styles.input,
                styles.inputWithIcon,
                props.errors.loginPassword && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showPassword} onPress={props.onTogglePassword} />
          </View>
        </Field>
        <Pressable style={styles.forgot} onPress={() => Alert.alert("준비 중", "비밀번호 찾기는 다음 단계에서 연결하면 됩니다.")}>
          <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
        </Pressable>
        <PixelButton
          label="로그인"
          onPress={props.onSubmit}
          loading={props.isSubmitting}
          style={styles.loginButton}
        />
        <FormMessage message={props.errors.api} />
        <Divider />
        <View style={styles.socials}>
          <SocialButton icon="G" label="Google" />
          <SocialButton icon="" label="Apple" />
          <SocialButton icon="●" label="Kakao" tone="kakao" />
        </View>
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
      <AuthHeader title="회원가입" subtitle="LeafLog와 함께 시작해요!" compact />
      <View style={styles.signupForm}>
        <Field
          label="이메일"
          compact
          error={props.errors.signupEmail}
          message={props.errors.emailCheck}
          messageTone={props.emailCheckStatus === "available" ? "success" : "error"}
        >
          <View style={styles.checkRow}>
            <TextInput
              value={props.email}
              onChangeText={props.onEmail}
              placeholder="이메일을 입력해주세요"
              placeholderTextColor="#b7b4ae"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
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
        <Field label="비밀번호" compact error={props.errors.signupPassword}>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.password}
              onChangeText={props.onPassword}
              placeholder="8자 이상, 영문/숫자 조합"
              placeholderTextColor="#b7b4ae"
              secureTextEntry={!props.showPassword}
              style={[
                styles.input,
                styles.signupInput,
                styles.inputWithIcon,
                props.errors.signupPassword && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showPassword} onPress={props.onTogglePassword} />
          </View>
        </Field>
        <Field label="비밀번호 확인" compact error={props.errors.signupConfirm}>
          <View style={styles.inputWrap}>
            <TextInput
              value={props.confirm}
              onChangeText={props.onConfirm}
              placeholder="비밀번호를 다시 입력해주세요"
              placeholderTextColor="#b7b4ae"
              secureTextEntry={!props.showConfirm}
              style={[
                styles.input,
                styles.signupInput,
                styles.inputWithIcon,
                props.errors.signupConfirm && styles.inputError,
              ]}
            />
            <PasswordToggle visible={props.showConfirm} onPress={props.onToggleConfirm} />
          </View>
        </Field>
        <View style={styles.terms}>
          <TermRow label="모두 동의합니다" checked={props.allAgreed} onPress={props.onToggleAll} strong />
          <TermRow label="[필수] 서비스 이용약관 동의" checked={props.agreeTerms} onPress={props.onToggleTerms} />
          <TermRow label="[필수] 개인정보 수집 및 이용 동의" checked={props.agreePrivacy} onPress={props.onTogglePrivacy} />
          <TermRow label="[선택] 마케팅 정보 수신 동의" checked={props.agreeMarketing} onPress={props.onToggleMarketing} />
        </View>
        <FormMessage message={props.errors.terms} />
      </View>
      <PixelButton label="회원가입" onPress={props.onNext} style={styles.signupButton} />
    </AuthScaffold>
  );
}

function NicknameScreen(props: {
  nickname: string;
  greeting: string;
  error?: string;
  apiError?: string;
  isSubmitting: boolean;
  onBack: () => void;
  onNickname: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.screen}>
      <BackButton onPress={props.onBack} />
      <ScrollView contentContainerStyle={styles.nicknameScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.nickHero}>
          <View style={styles.nickBubbleShadow} />
          <View style={styles.nickBubble}>
            <Text style={styles.nickBubbleText}>{props.greeting}</Text>
            <View style={styles.cursor} />
            <View style={styles.nickBubbleTailBorder} />
            <View style={styles.nickBubbleTailFill} />
          </View>
          <Image source={assets.nicknameSun} style={styles.nickSun} />
          <Image source={assets.nicknamePlant} style={styles.nickPlantScene} />
        </View>
        <Text style={styles.nickTitle}>어떻게 불러드릴까요?</Text>
        <Text style={styles.nickCopy}>닉네임은 앱 내에서{"\n"}다른 식집사들에게 표시돼요!</Text>
        <View style={styles.nickForm}>
          <Field label="닉네임" error={props.error}>
            <View style={styles.inputWrap}>
              <TextInput
                value={props.nickname}
                onChangeText={(value) => props.onNickname(value.slice(0, 10))}
                placeholder="닉네임을 입력해주세요"
                placeholderTextColor="#b7b4ae"
                autoCapitalize="none"
                style={[
                  styles.input,
                  styles.counterInput,
                  props.error && styles.inputError,
                ]}
                maxLength={10}
              />
              <Text style={styles.counter}>{props.nickname.length}/10</Text>
            </View>
          </Field>
          <Text style={styles.hint}>2~10자, 한글/영문/숫자 사용 가능</Text>
          <FormMessage message={props.apiError} />
          <PixelButton
            label="시작하기"
            onPress={props.onSubmit}
            loading={props.isSubmitting}
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
        <PixelButton label="처음 화면으로" onPress={onLogout} style={styles.doneButton} />
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
      <BackButton onPress={onBack} />
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton} hitSlop={12}>
      <Text style={styles.backText}>‹</Text>
    </Pressable>
  );
}

function AuthHeader({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.authHead, compact && styles.authHeadCompact]}>
      <Image source={assets.leaf} style={styles.authLeaf} />
      <Text style={styles.authTitle}>{title}</Text>
      <Text style={styles.authSubtitle}>
        {subtitle} <Text style={styles.heart}>♡</Text>
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
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  message?: string;
  messageTone?: "error" | "success";
  compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? (
        <Text
          style={[
            styles.errorText,
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
}: {
  visible: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.passwordToggle} onPress={onPress} hitSlop={8}>
      <Text style={styles.passwordToggleText}>{visible ? "숨김" : "보기"}</Text>
    </Pressable>
  );
}

function FormMessage({
  message,
  tone = "error",
}: {
  message?: string;
  tone?: "error" | "success";
}) {
  if (!message) return null;

  return (
    <Text style={[styles.formMessage, tone === "success" && styles.successText]}>
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

function PixelButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  style?: object;
}) {
  const secondary = variant === "secondary";
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pixelButton,
        secondary && styles.pixelButtonSecondary,
        pressed && styles.pressed,
        loading && styles.disabledButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.green : "#fff"} />
      ) : (
        <Text style={[styles.pixelButtonText, secondary && styles.pixelButtonSecondaryText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>또는</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function SocialButton({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone?: "kakao";
}) {
  return (
    <Pressable
      style={styles.socialButton}
      onPress={() => Alert.alert("준비 중", `${label} 로그인은 추후 연결하면 됩니다.`)}
    >
      <Text style={[styles.socialIcon, tone === "kakao" && styles.kakaoIcon]}>{icon}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
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
    backgroundColor: "#e9ece3",
    alignItems: "center",
  },
  keyboard: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  frame: {
    flex: 1,
    backgroundColor: colors.paper,
    overflow: "hidden",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    position: "relative",
  },
  sprite: {
    position: "absolute",
    resizeMode: "contain",
  },
  cloudLeft: {
    top: 96,
    left: 38,
    width: 110,
    height: 54,
  },
  cloudRight: {
    top: 109,
    right: 36,
    width: 98,
    height: 57,
  },
  landingTitle: {
    position: "absolute",
    top: 105,
    left: 71,
    width: 260,
    alignItems: "center",
  },
  titleLeaf: {
    width: 39,
    height: 29,
    resizeMode: "contain",
  },
  brandText: {
    marginTop: 19,
    color: "#3e7c37",
    fontSize: 51,
    lineHeight: 54,
    fontWeight: "900",
    textShadowColor: "#235c2b",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  tagline: {
    marginTop: 14,
    color: "#807a70",
    fontSize: 15,
    fontWeight: "800",
  },
  heart: {
    color: colors.heart,
    fontWeight: "900",
  },
  landingPlant: {
    top: 323,
    left: 40,
    width: 325,
    height: 236,
  },
  meadow: {
    left: 0,
    bottom: 0,
    width: 402,
    height: 78,
    resizeMode: "cover",
  },
  landingActions: {
    position: "absolute",
    left: 49,
    right: 49,
    top: 625,
    gap: 12,
    backgroundColor: colors.paper,
  },
  pixelButton: {
    height: 56,
    borderWidth: 2,
    borderColor: colors.greenDark,
    borderRadius: 6,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2b652f",
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pixelButtonSecondary: {
    backgroundColor: colors.paper,
    shadowOpacity: 0,
    elevation: 0,
  },
  pixelButtonText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },
  pixelButtonSecondaryText: {
    color: colors.green,
  },
  pressed: {
    opacity: 0.78,
  },
  disabledButton: {
    opacity: 0.7,
  },
  authScroll: {
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  backButton: {
    position: "absolute",
    top: 28,
    left: 22,
    width: 34,
    height: 34,
    zIndex: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#111",
    fontSize: 38,
    lineHeight: 38,
    fontWeight: "300",
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
    marginBottom: 1,
  },
  authTitle: {
    color: colors.greenDark,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  authSubtitle: {
    marginTop: 8,
    color: "#7f7c74",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  form: {
    marginTop: 28,
  },
  signupForm: {
    marginTop: 26,
  },
  field: {
    marginBottom: 20,
  },
  fieldCompact: {
    marginBottom: 14,
  },
  label: {
    marginLeft: 2,
    marginBottom: 8,
    color: "#242424",
    fontSize: 12,
    fontWeight: "900",
  },
  inputWrap: {
    position: "relative",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkInput: {
    flex: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "#fffef9",
    paddingHorizontal: 15,
    color: "#373737",
    fontSize: 14,
    fontWeight: "700",
  },
  signupInput: {
    height: 44,
  },
  inputWithIcon: {
    paddingRight: 54,
  },
  inputError: {
    borderColor: colors.heart,
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
    color: "#6f6a61",
    fontSize: 12,
    fontWeight: "900",
  },
  errorText: {
    marginTop: 6,
    marginLeft: 2,
    color: colors.heart,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  formMessage: {
    marginTop: 10,
    color: colors.heart,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  successText: {
    color: colors.green,
  },
  smallButton: {
    width: 78,
    height: 44,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 9,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: -1,
  },
  forgotText: {
    color: "#4d8642",
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  loginButton: {
    marginTop: 46,
  },
  divider: {
    marginTop: 48,
    marginBottom: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1dbce",
  },
  dividerText: {
    color: "#8e877d",
    fontSize: 13,
    fontWeight: "700",
  },
  socials: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 58,
    borderWidth: 1,
    borderColor: "#d9d2c4",
    borderRadius: 9,
    backgroundColor: "#fffef9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  socialIcon: {
    color: "#4285f4",
    fontSize: 19,
    fontWeight: "900",
  },
  kakaoIcon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#f8d43e",
    color: "#2d241f",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  socialLabel: {
    color: "#33302c",
    fontSize: 13,
    fontWeight: "800",
  },
  terms: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: "#fffef9",
  },
  termRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#d4cfc4",
    borderRadius: 3,
    backgroundColor: "#fffef9",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#4d8b40",
    backgroundColor: "#4d8b40",
  },
  checkmark: {
    color: "#fff",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
  },
  termText: {
    flex: 1,
    color: "#646057",
    fontSize: 12,
    fontWeight: "800",
  },
  termTextStrong: {
    color: "#4a5046",
    fontSize: 13,
    fontWeight: "900",
  },
  viewLink: {
    width: 38,
    color: "#56534d",
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  signupButton: {
    marginTop: 30,
  },
  nicknameScroll: {
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  nickHero: {
    position: "relative",
    width: 330,
    height: 220,
    marginTop: 130,
    alignSelf: "center",
  },
  nickBubbleShadow: {
    position: "absolute",
    top: 7,
    left: 83,
    width: 174,
    height: 48,
    backgroundColor: "#e5d8c5",
  },
  nickSun: {
    position: "absolute",
    top: 26,
    right: 38,
    width: 46,
    height: 48,
    resizeMode: "contain",
  },
  nickPlantScene: {
    position: "absolute",
    top: 78,
    left: 72,
    width: 186,
    height: 124,
    resizeMode: "contain",
  },
  nickBubble: {
    position: "absolute",
    top: 3,
    left: 79,
    width: 174,
    height: 48,
    borderWidth: 1,
    borderColor: "#9b7a57",
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    zIndex: 3,
    overflow: "visible",
  },
  nickBubbleTailBorder: {
    position: "absolute",
    left: 64,
    bottom: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#9b7a57",
  },
  nickBubbleTailFill: {
    position: "absolute",
    left: 65,
    bottom: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.paper,
  },
  nickBubbleText: {
    color: "#1f2a1e",
    fontSize: 14,
    fontWeight: "900",
  },
  cursor: {
    width: 2,
    height: 14,
    marginLeft: 2,
    backgroundColor: colors.green,
  },
  nickTitle: {
    marginTop: 24,
    color: colors.greenDark,
    textAlign: "center",
    fontSize: 29,
    lineHeight: 33,
    fontWeight: "900",
  },
  nickCopy: {
    marginTop: 18,
    color: "#76736c",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },
  nickForm: {
    marginTop: 42,
  },
  counterInput: {
    paddingRight: 56,
  },
  counter: {
    position: "absolute",
    top: 16,
    right: 13,
    color: "#8f8980",
    fontSize: 12,
    fontWeight: "800",
  },
  hint: {
    marginTop: -14,
    marginLeft: 2,
    color: "#a5a097",
    fontSize: 11,
    fontWeight: "800",
  },
  startButton: {
    marginTop: 36,
  },
  doneContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  donePlant: {
    width: 240,
    height: 175,
    resizeMode: "contain",
  },
  doneTitle: {
    marginTop: 28,
    color: colors.greenDark,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  doneCopy: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  doneButton: {
    alignSelf: "stretch",
    marginTop: 42,
  },
});
