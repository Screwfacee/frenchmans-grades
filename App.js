import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Easing, ActivityIndicator, TextInput, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Path } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { useFonts } from "expo-font";
import { PinyonScript_400Regular } from "@expo-google-fonts/pinyon-script";
import { CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";

/* ============ theme ============ */
const C = {
  bg: "#101018", bg2: "#171722", ink: "#F3EEE0", muted: "#9A968A",
  line: "rgba(233,210,157,0.14)", glass: "rgba(255,255,255,0.045)",
  gold: "#E9D29D", gold2: "#D3B77E", goldDeep: "#B8935A",
  good: "#8FC7AC", bad: "#D08C74", black: "#08080C",
};
const SCRIPT = "PinyonScript_400Regular";
const SERIF = "CormorantGaramond_600SemiBold";
const SERIF_M = "CormorantGaramond_500Medium";
const SERIF_I = "CormorantGaramond_500Medium";
const SANS = "Inter_500Medium";
const SANS_B = "Inter_600SemiBold";
const GOLD_GRAD = ["#7C6238", "#B8935A", "#F6E6B4", "#E9D29D", "#9C7C42"];

/* ============ AI key storage ============ */
const KEY_STORE = "tfg_gemini_key";
async function loadKey() { try { return await SecureStore.getItemAsync(KEY_STORE); } catch { return null; } }
async function saveKey(k) { try { await SecureStore.setItemAsync(KEY_STORE, k); } catch {} }
const looksLikeKey = (s) => !!s && /AIza[0-9A-Za-z_\-]{20,}/.test(s.trim());
const extractKey = (s) => { const m = (s || "").match(/AIza[0-9A-Za-z_\-]{20,}/); return m ? m[0] : ""; };

/* ============ Gemini vision grading ============ */
const PROMPT = `You are the master grader and authenticator for "The Frenchman's Grades", a collectibles app. You NEVER fake or guess a grade — honesty is the brand. Look at the photographed item and return a STRICT JSON object (no markdown) with these fields:
{
 "kind": one of "coin","currency","card","luxury","other",
 "identification": short exact name of the item (e.g. "1921 Morgan Silver Dollar", "Louis Vuitton Neverfull MM", "Louis Vuitton Monogram Hat"),
 "grade_label": the grade/verdict text using the correct real scale — coins: Sheldon MS/AU/XF 1-70; paper money: PMG 1-70 (+EPQ if warranted); cards: PSA 1-10; luxury/other: an authenticity verdict of "Consistent with authentic","Likely authentic","Inconclusive", or "Counterfeit indicators present",
 "grade_number": the numeric grade if the scale has one (coin/card/currency), else null,
 "scale": the scale name used,
 "confidence": integer 0-100 of how confident YOU are from this single photo,
 "reasoning": 2-4 sentences on what you see and why, plainly,
 "dossier": {
   "what": one sentence on what this item is,
   "origin": country / mint / maison / manufacturer of origin,
   "year": year or era, or "Unknown",
   "population": realistic note on how many exist / mintage / rarity, or "Unknown — needs registry lookup",
   "notable": one interesting real fact about this exact item or model,
   "est_value": realistic market value range in USD, or "Unknown"
 },
 "sources": array of the real standards/registries a collector would verify against (e.g. ["PCGS CoinFacts","Sheldon Scale"]),
 "disclaimer": one honest sentence — for luxury say screening only, verify with a professional before any sale; for graded items say a photo estimate is not a certified grade.
}
If the photo is blank, too dark, or shows no gradeable collectible, set kind "other", grade_label "No item detected", confidence 0, and say so in reasoning. Return ONLY the JSON.`;

async function gradeWithGemini(base64, key) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = res.status + "";
    try { const e = await res.json(); msg = (e.error && e.error.message) || msg; } catch {}
    throw new Error(msg);
  }
  const d = await res.json();
  const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = txt.replace(/^```json/i, "").replace(/```$/, "").trim();
  return JSON.parse(clean);
}

/* ============ shared vault (real data only) ============ */
const VAULT = [];
let vaultSeq = 1;

/* ============ decorative bits ============ */
function Sparkles({ count = 10, area = { l: 8, t: 4, w: 84, h: 40 } }) {
  const items = useRef(Array.from({ length: count }, (_, i) => ({
    left: area.l + ((i * 37) % area.w), top: area.t + ((i * 53) % area.h),
    a: new Animated.Value(0), d: (i * 231) % 2600,
  }))).current;
  useEffect(() => {
    items.forEach((s) => {
      const loop = () => Animated.sequence([
        Animated.timing(s.a, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(s.a, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => loop());
      setTimeout(loop, s.d);
    });
  }, []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((s, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: s.left + "%", top: s.top + "%",
          width: 3, height: 3, borderRadius: 3, backgroundColor: "#FDEFC6",
          shadowColor: "#F6E6B4", shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
          opacity: s.a, transform: [{ scale: s.a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.3] }) }] }} />
      ))}
    </View>
  );
}

function Shimmer({ children, style, width = 200 }) {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => { Animated.loop(Animated.timing(x, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: true })).start(); }, []);
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-width, width] });
  return (
    <View style={{ position: "relative", overflow: "hidden" }}>
      <Text style={style}>{children}</Text>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient colors={["transparent", "rgba(255,251,235,0.55)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 80, height: "100%" }} />
      </Animated.View>
    </View>
  );
}

function Backdrop() {
  const g = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([
    Animated.timing(g, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    Animated.timing(g, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
  ])).start(); }, []);
  const op = g.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["#1C1C28", "#141420", "#0E0E16"]} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ position: "absolute", top: -120, left: -60, width: 320, height: 320, borderRadius: 320, opacity: op }}>
        <LinearGradient colors={["rgba(211,183,126,0.20)", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.3, y: 0.3 }} end={{ x: 1, y: 1 }} />
      </Animated.View>
      <View style={{ position: "absolute", bottom: -140, right: -80, width: 340, height: 340, borderRadius: 340, opacity: 0.28 }}>
        <LinearGradient colors={["rgba(184,147,90,0.16)", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.7, y: 0.7 }} end={{ x: 0, y: 0 }} />
      </View>
    </View>
  );
}

function CoinEmblem({ size = 132 }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, []);
  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "12deg"] });
  return (
    <Animated.View style={{ width: size, height: size, marginBottom: 22, transform: [{ perspective: 800 }, { rotateY }],
      shadowColor: "#D3B77E", shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 10 } }}>
      <LinearGradient colors={["#FFFBEF", "#E9D29D", "#B8935A", "#7C6238"]} start={{ x: 0.3, y: 0.15 }} end={{ x: 0.85, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
        <LinearGradient colors={["#FFFBEF", "#D9BD83", "#9A7C48"]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={{ width: size - 20, height: size - 20, borderRadius: (size - 20) / 2, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: SERIF, fontSize: size * 0.44, color: "#6B542C", textShadowColor: "rgba(255,255,255,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>F</Text>
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

const GoogleG = () => (
  <Svg width={18} height={18} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.6z" />
    <Path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z" />
    <Path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.6-5.9c-2.1 1.4-4.8 2.3-7.7 2.3-6.4 0-11.8-3.7-13.6-9.4l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
  </Svg>
);

/* ============ headings ============ */
const Script = ({ children, size = 34, style }) => (
  <Text style={[{ fontFamily: SCRIPT, color: C.gold, fontSize: size, textShadowColor: "rgba(211,183,126,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }, style]}>{children}</Text>
);

/* ============ landing (kept) ============ */
function Landing({ onEnter }) {
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Sparkles count={14} area={{ l: 12, t: 8, w: 76, h: 44 }} />
      <View style={st.landing}>
        <View style={{ alignItems: "center" }}>
          <CoinEmblem />
          <Script size={24} style={{ marginBottom: -2, fontFamily: SERIF_I, color: C.gold }}>Welcome to</Script>
          <Shimmer style={{ fontFamily: SCRIPT, color: C.gold, fontSize: 56, lineHeight: 66, textShadowColor: "rgba(211,183,126,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 }} width={230}>The Frenchman's</Shimmer>
          <Shimmer style={{ fontFamily: SCRIPT, color: C.gold, fontSize: 40, lineHeight: 46, marginTop: -6 }} width={140}>Grades</Shimmer>
          <Text style={{ color: C.muted, fontSize: 11.5, letterSpacing: 3, marginTop: 16, fontFamily: SANS }}>COINS · CURRENCY · CARDS · LUXURY</Text>
        </View>
        <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
          <TouchableOpacity style={[st.ab, st.abG]} onPress={onEnter} activeOpacity={0.85}><GoogleG /><Text style={st.abGText}>Continue with Google</Text></TouchableOpacity>
          <View style={[st.ab, { opacity: 0.4 }]}><Text style={st.abText}>Continue with Apple</Text><Text style={st.soon}>soon</Text></View>
          <TouchableOpacity style={st.ab} onPress={onEnter} activeOpacity={0.85}><Text style={st.abText}>Continue with Email</Text></TouchableOpacity>
          <TouchableOpacity onPress={onEnter} style={{ marginTop: 12 }}><Text style={st.skip}>Your Vault stays private to you.  <Text style={{ color: C.gold2, fontFamily: SANS_B }}>Skip →</Text></Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ============ API key onboarding ============ */
function KeyOnboarding({ visible, onClose, onSaved }) {
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");

  async function openStudio() {
    setMsg("");
    await Clipboard.setStringAsync(""); // clear so we detect a fresh copy
    await WebBrowser.openBrowserAsync("https://aistudio.google.com/app/apikey");
    // on return, auto-read clipboard
    setChecking(true);
    try {
      const clip = await Clipboard.getStringAsync();
      if (looksLikeKey(clip)) { const k = extractKey(clip); await saveKey(k); onSaved(k); setMsg(""); return; }
      setMsg("Copied your key? Paste it below — I couldn't read it from the clipboard automatically.");
    } catch { setMsg("Paste your key below."); }
    setChecking(false);
  }
  async function useManual() {
    const k = extractKey(manual);
    if (!k) { setMsg("That doesn't look like a Google AI key (starts with AIza…)."); return; }
    await saveKey(k); onSaved(k);
  }
  async function pasteClip() {
    const clip = await Clipboard.getStringAsync();
    if (looksLikeKey(clip)) setManual(extractKey(clip)); else setMsg("Clipboard doesn't have a key yet.");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.modalWrap}>
        <View style={st.modalCard}>
          <Sparkles count={8} area={{ l: 6, t: 4, w: 88, h: 30 }} />
          <Script size={30} style={{ textAlign: "center" }}>Unlock the Grader</Script>
          <Text style={st.modalBody}>Grading is powered by Google's AI. Get your own <Text style={{ color: C.gold, fontFamily: SERIF }}>free</Text> key — it takes 20 seconds and stays private on your phone.</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={openStudio}>
            <LinearGradient colors={["#F6E6B4", "#D3B77E", "#B8935A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.modalCta}>
              <Text style={st.modalCtaT}>{checking ? "Reading your key…" : "Get my free key  →"}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={st.modalHint}>Opens Google AI Studio · tap "Create API key" · Copy it · come back here — I'll grab it automatically.</Text>
          <View style={st.orRow}><View style={st.orLine} /><Text style={st.orTxt}>or paste it</Text><View style={st.orLine} /></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={manual} onChangeText={setManual} placeholder="AIza…" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} style={st.input} />
            <TouchableOpacity style={st.pasteBtn} onPress={pasteClip}><Text style={{ color: C.gold, fontFamily: SANS_B, fontSize: 13 }}>Paste</Text></TouchableOpacity>
          </View>
          {msg ? <Text style={st.modalErr}>{msg}</Text> : null}
          <TouchableOpacity style={st.saveBtn} onPress={useManual}><Text style={{ color: C.ink, fontFamily: SANS_B }}>Save key</Text></TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={st.modalSkip}>Not now</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ============ camera (full screen, translucent) ============ */
const KINDS = [
  { k: "auto", l: "Auto", h: "Point and shoot — I'll identify it" },
  { k: "coin", l: "Coin", h: "Grading against Sheldon 1–70" },
  { k: "currency", l: "Cash", h: "Grading against PMG 1–70" },
  { k: "card", l: "Card", h: "Grading against PSA 1–10" },
  { k: "luxury", l: "Luxury", h: "Authenticating — any luxury good" },
];

function Camera({ apiKey, onNeedKey, onResult }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef(null);
  const [kind, setKind] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const flash = useRef(new Animated.Value(0)).current;
  const hint = KINDS.find((x) => x.k === kind).h;

  async function capture() {
    if (busy) return;
    if (!camRef.current) { setErr("Camera not ready yet."); return; }
    if (!apiKey) { onNeedKey(); return; }
    setBusy(true); setErr("");
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    try {
      const shot = await camRef.current.takePictureAsync({ quality: 0.55, base64: true, skipProcessing: true });
      const hintKind = kind === "auto" ? "" : `The user says this is a ${kind}. `;
      const r = await gradeWithGemini(shot.base64, apiKey);
      if (hintKind && !r.kind) r.kind = kind;
      onResult(r, shot.uri);
    } catch (e) {
      const m = String(e.message || e);
      if (/API key|API_KEY|invalid|PERMISSION_DENIED|401|403/i.test(m)) { setErr("Your AI key was rejected. Re-add it."); onNeedKey(); }
      else setErr("Grading failed: " + m);
    }
    setBusy(false);
  }

  const granted = permission && permission.granted;
  return (
    <View style={{ flex: 1, backgroundColor: C.black }}>
      {granted ? (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={StyleSheet.absoluteFill}><Backdrop /></View>
      )}

      {/* decorative overlays — all pass-through */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flash }]} />
      {granted ? (
        <View pointerEvents="none" style={st.corners}>
          <View style={[st.corner, st.cTL]} /><View style={[st.corner, st.cTR]} />
          <View style={[st.corner, st.cBL]} /><View style={[st.corner, st.cBR]} />
        </View>
      ) : null}

      {/* top controls */}
      <LinearGradient pointerEvents="box-none" colors={["rgba(8,8,12,0.75)", "transparent"]} style={st.camTop}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 6 }}>
          {KINDS.map((x) => (
            <TouchableOpacity key={x.k} onPress={() => setKind(x.k)} activeOpacity={0.8} style={{ borderRadius: 999, overflow: "hidden" }}>
              {kind === x.k
                ? <LinearGradient colors={["#F6E6B4", "#D3B77E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.segFill}><Text style={st.segOn}>{x.l}</Text></LinearGradient>
                : <Text style={st.segOff}>{x.l}</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* enable-camera prompt (on top, tappable) */}
      {!granted ? (
        <View style={st.enableWrap}>
          <Script size={26} style={{ textAlign: "center" }}>Open the Lens</Script>
          <Text style={st.enableTxt}>Point the camera at your item to grade it.</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={requestPermission}>
            <LinearGradient colors={["#F6E6B4", "#D3B77E", "#B8935A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.enableBtn}>
              <Text style={st.enableBtnT}>Enable camera</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* bottom controls */}
      <LinearGradient pointerEvents="box-none" colors={["transparent", "rgba(8,8,12,0.8)"]} style={st.camBot}>
        {err ? <Text style={st.camErr}>{err}</Text> : <Text style={st.hint}>{busy ? "Grading…" : hint}</Text>}
        <TouchableOpacity onPress={capture} activeOpacity={0.85} disabled={busy}>
          <View style={st.shutterRing}>
            <LinearGradient colors={["#FFFBEF", "#E6CF98", "#B8935A"]} start={{ x: 0.4, y: 0.3 }} end={{ x: 0.8, y: 1 }} style={st.shutter}>
              {busy ? <ActivityIndicator color="#5a4620" /> : null}
            </LinearGradient>
          </View>
        </TouchableOpacity>
        {!apiKey ? <Text style={st.keyHint}>Tap the shutter to add your free AI key</Text> : null}
      </LinearGradient>
    </View>
  );
}

/* ============ result / dossier ============ */
function Dossier({ r }) {
  const d = r.dossier || {};
  const rows = [
    ["What it is", d.what], ["Origin", d.origin], ["Year / era", d.year],
    ["How many exist", d.population], ["Notable", d.notable], ["Est. market value", d.est_value],
  ].filter(([, v]) => v && String(v).trim());
  if (!rows.length) return null;
  return (
    <View style={st.dossier}>
      <Script size={22} style={{ marginBottom: 8 }}>The Dossier</Script>
      {rows.map(([k, v], i) => (
        <View key={i} style={[st.dRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={st.dKey}>{k}</Text>
          <Text style={st.dVal}>{String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

function Result({ r, photo, onBack }) {
  const num = r.grade_number != null ? String(r.grade_number) : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <View style={st.rHead}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={st.back}>‹</Text></TouchableOpacity>
        <Script size={22}>Grade</Script><View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, alignItems: "center" }}>
        {photo ? <Image source={{ uri: photo }} style={st.thumb} /> : null}
        <Text style={st.saved}>✓ Saved to your Vault</Text>
        {r.identification ? <Text style={st.ident}>{r.identification}</Text> : null}
        {num ? <Script size={72} style={{ lineHeight: 82 }}>{num}</Script> : null}
        <Text style={st.gradeLabel}>{r.grade_label || "—"}</Text>
        <View style={st.metaRow}>
          {r.scale ? <Text style={st.chip}>{r.scale}</Text> : null}
          {r.confidence != null ? <Text style={st.chip}>{r.confidence}% confidence</Text> : null}
        </View>
        {r.reasoning ? <Text style={st.reason}>{r.reasoning}</Text> : null}
        <Dossier r={r} />
        {r.sources?.length ? <Text style={st.src}><Text style={{ color: C.gold, fontFamily: SERIF }}>Verify against:  </Text>{r.sources.join(" · ")}</Text> : null}
        {r.disclaimer ? <Text style={st.disc}>{r.disclaimer}</Text> : null}
        <TouchableOpacity style={st.done} onPress={onBack}><Text style={{ color: C.ink, fontFamily: SANS_B }}>Grade another</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ============ vault ============ */
function Vault({ onOpen }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 700); return () => clearInterval(t); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 44 }}>
      <Backdrop />
      <View style={st.vHead}>
        <Script size={40}>The Vault</Script>
        <Text style={{ color: C.muted, fontSize: 13, fontFamily: SANS }}>{VAULT.length} item{VAULT.length === 1 ? "" : "s"}</Text>
      </View>
      {VAULT.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 70, paddingHorizontal: 30 }}>
          <Text style={st.empty}>Your Vault is empty.{"\n"}Snap your first grade to begin the collection.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 10 }}>
          {VAULT.map((i) => (
            <TouchableOpacity key={i.id} activeOpacity={0.85} onPress={() => onOpen(i)} style={st.row}>
              {i.photo ? <Image source={{ uri: i.photo }} style={st.rowTh} /> : <View style={st.rowTh}><Text style={{ fontFamily: SERIF, color: C.gold, fontSize: 20 }}>{(i.r.grade_number != null ? String(i.r.grade_number) : (i.r.identification || "•"))[0]}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={st.rowName} numberOfLines={1}>{i.r.identification || cap(i.r.kind) || "Item"}</Text>
                <Text style={st.rowSub} numberOfLines={1}>{i.r.grade_label || ""}</Text>
              </View>
              <Text style={st.rowArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : "");

/* ============ app ============ */
export default function App() {
  const [fonts] = useFonts({
    PinyonScript_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold,
    Inter_500Medium, Inter_600SemiBold,
  });
  const [screen, setScreen] = useState("landing");
  const [tab, setTab] = useState("camera");
  const [result, setResult] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { loadKey().then((k) => setApiKey(k)); }, []);

  const onResult = useCallback((r, uri) => {
    if (r && r.identification && (r.grade_label || "").toLowerCase() !== "no item detected" && r.confidence !== 0) {
      VAULT.unshift({ id: "v" + vaultSeq++, r, photo: uri });
    }
    setResult(r); setPhoto(uri);
  }, []);

  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold2} /></View>;
  if (screen === "landing") return <Landing onEnter={() => setScreen("app")} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>
        {result ? <Result r={result} photo={photo} onBack={() => setResult(null)} />
          : tab === "camera" ? <Camera apiKey={apiKey} onNeedKey={() => setShowKey(true)} onResult={onResult} />
          : <Vault onOpen={(i) => { setResult(i.r); setPhoto(i.photo); }} />}
      </View>
      {!result && (
        <LinearGradient colors={["rgba(16,16,24,0.6)", "rgba(8,8,12,0.96)"]} style={st.tabs}>
          <TouchableOpacity style={st.tab} onPress={() => setTab("camera")}><Text style={[st.tabT, tab === "camera" && st.tabOn]}>◉  Grade</Text></TouchableOpacity>
          <TouchableOpacity style={st.tab} onPress={() => setTab("vault")}><Text style={[st.tabT, tab === "vault" && st.tabOn]}>▦  Vault</Text></TouchableOpacity>
        </LinearGradient>
      )}
      <KeyOnboarding visible={showKey} onClose={() => setShowKey(false)} onSaved={(k) => { setApiKey(k); setShowKey(false); }} />
    </View>
  );
}

/* ============ styles ============ */
const st = StyleSheet.create({
  landing: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 88, paddingBottom: 46, paddingHorizontal: 28 },
  ab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass },
  abG: { backgroundColor: "#F3EEE0", borderColor: "transparent" },
  abGText: { color: "#161616", fontSize: 15, fontFamily: SANS_B },
  abText: { color: C.ink, fontSize: 15, fontFamily: SANS_B },
  soon: { color: C.muted, fontSize: 10, marginLeft: 4, fontFamily: SANS },
  skip: { color: C.muted, fontSize: 13, textAlign: "center", fontFamily: SANS },

  corners: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: "rgba(246,230,180,0.8)" },
  cTL: { top: "24%", left: "12%", borderLeftWidth: 2, borderTopWidth: 2, borderTopLeftRadius: 8 },
  cTR: { top: "24%", right: "12%", borderRightWidth: 2, borderTopWidth: 2, borderTopRightRadius: 8 },
  cBL: { bottom: "26%", left: "12%", borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 8 },
  cBR: { bottom: "26%", right: "12%", borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 8 },

  camTop: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 50, paddingBottom: 16 },
  segFill: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  segOn: { color: "#2a2113", fontSize: 13, fontFamily: SANS_B },
  segOff: { paddingVertical: 9, paddingHorizontal: 16, color: "#d9d6cd", fontSize: 13, fontFamily: SANS_B, backgroundColor: "rgba(10,10,14,0.5)", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  enableWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 },
  enableTxt: { color: "#d6d3ca", fontSize: 14, textAlign: "center", fontFamily: SANS },
  enableBtn: { paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14, marginTop: 6 },
  enableBtnT: { color: "#2a2113", fontSize: 15, fontFamily: SANS_B },

  camBot: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 30, paddingBottom: 30, alignItems: "center", gap: 12 },
  hint: { color: "#efe9db", fontSize: 13.5, fontFamily: SERIF_M },
  camErr: { color: "#F0B49A", fontSize: 13, fontFamily: SANS, textAlign: "center", paddingHorizontal: 30 },
  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: "rgba(246,230,180,0.5)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  keyHint: { color: C.gold2, fontSize: 11.5, fontFamily: SANS },

  rHead: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { fontSize: 32, color: C.gold2, lineHeight: 32 },
  thumb: { width: "100%", height: 200, borderRadius: 18, backgroundColor: "#17171f", borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  saved: { color: C.good, fontSize: 12, marginBottom: 8, fontFamily: SANS },
  ident: { color: C.ink, fontSize: 20, fontFamily: SERIF, textAlign: "center", marginBottom: 2 },
  gradeLabel: { color: C.gold, fontSize: 19, fontFamily: SERIF, marginTop: 2, textAlign: "center" },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  chip: { paddingVertical: 5, paddingHorizontal: 13, borderRadius: 999, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, color: C.muted, fontSize: 12, fontFamily: SANS, overflow: "hidden" },
  reason: { color: C.ink, fontSize: 15, lineHeight: 23, width: "100%", backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginTop: 20, fontFamily: SERIF_M },
  dossier: { width: "100%", marginTop: 16, backgroundColor: "rgba(211,183,126,0.05)", borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 },
  dRow: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(233,210,157,0.1)" },
  dKey: { color: C.gold2, fontSize: 13, fontFamily: SANS_B, width: 120 },
  dVal: { color: C.ink, fontSize: 14.5, fontFamily: SERIF_M, flex: 1, textAlign: "right", lineHeight: 20 },
  src: { color: C.muted, fontSize: 12.5, lineHeight: 18, marginTop: 16, width: "100%", fontFamily: SANS },
  disc: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 14, width: "100%", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, fontFamily: SANS },
  done: { marginTop: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14 },

  vHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 10 },
  empty: { color: C.muted, fontSize: 14.5, textAlign: "center", lineHeight: 24, fontFamily: SERIF_M },
  row: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 },
  rowTh: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#1b1b24", alignItems: "center", justifyContent: "center" },
  rowName: { color: C.ink, fontSize: 16, fontFamily: SERIF },
  rowSub: { color: C.muted, fontSize: 12.5, marginTop: 2, fontFamily: SANS },
  rowArrow: { color: C.gold2, fontSize: 22 },

  tabs: { flexDirection: "row", height: 76, paddingBottom: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabT: { color: C.muted, fontSize: 13.5, fontFamily: SANS_B },
  tabOn: { color: C.gold },

  modalWrap: { flex: 1, backgroundColor: "rgba(6,6,10,0.82)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 400, backgroundColor: "#14141d", borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 22, overflow: "hidden" },
  modalBody: { color: C.ink, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 6, marginBottom: 16, fontFamily: SERIF_M },
  modalCta: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  modalCtaT: { color: "#2a2113", fontSize: 15.5, fontFamily: SANS_B },
  modalHint: { color: C.muted, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 10, fontFamily: SANS },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: C.line },
  orTxt: { color: C.muted, fontSize: 12, fontFamily: SANS },
  input: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: C.ink, fontFamily: SANS, fontSize: 14 },
  pasteBtn: { paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.glass },
  modalErr: { color: "#F0B49A", fontSize: 12.5, marginTop: 10, fontFamily: SANS, textAlign: "center" },
  saveBtn: { marginTop: 12, borderWidth: 1, borderColor: C.gold2, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: "rgba(211,183,126,0.08)" },
  modalSkip: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 12, fontFamily: SANS },
});
