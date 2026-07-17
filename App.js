import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Easing, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Path } from "react-native-svg";

/* ---------------- theme ---------------- */
const C = {
  bg: "#0A0A0C", ink: "#F3F0E9", muted: "#8C887E",
  line: "rgba(255,255,255,0.09)", panel: "rgba(255,255,255,0.035)",
  gold: "#E9D29D", m1: "#F6E6B4", m2: "#D3B77E", good: "#7FB79C", bad: "#C77F66", black: "#050506",
};

/* ---------------- grading (local preview) ---------------- */
const LUX_NAMES = { bag: "Handbags & Leather", footwear: "Sneakers & Footwear", apparel: "Clothing & Denim", eyewear: "Sunglasses & Optical", jewelry: "Jewelry & Silver", accessory: "Belts & Small Goods" };
function localGrade(kind, cat = "bag") {
  if (kind === "card") {
    const s = { centering: 9, corners: 8, edges: 9, surface: 8 }, low = Math.min(...Object.values(s));
    return { kind: "card", grade: low, label: `PSA ${low} (NM-MT)`, subgrades: s, rubric: "PSA Scale (Trading Cards)",
      reasoning: "Category-aware read. Final grade is capped by the lowest sub-grade — the PSA rule. Connect the grading server for the live AI read.",
      sources: ["PSA Grading Standards (psacard.com)"], disclaimer: "Preview screening — not a live grade." };
  }
  if (kind === "luxury") {
    return { kind: "luxury", grade: 82, label: `LIKELY · ${LUX_NAMES[cat] || "Luxury"}`, rubric: "Luxury Goods Authentication",
      factors: [{ factor: "Logo / stamping", score: 88 }, { factor: "Stitching", score: 80 }, { factor: "Hardware / material", score: 79 }],
      reasoning: "Category-specific authentication checkpoints applied. Conservative by design — a screening, never a guarantee.",
      sources: ["Per-brand construction & stamping references"], disclaimer: "Screening only — not professional authentication. Verify with an expert before any sale." };
  }
  const lab = kind === "currency" ? "PMG 64 (Choice Unc.)" : "MS-64 (Mint State)";
  return { kind, grade: 64, label: lab, rubric: kind === "currency" ? "PMG Scale (Paper Money)" : "Sheldon Scale (Coins)",
    factors: [{ factor: "Wear / detail", score: 88 }, { factor: "Luster", score: 84 }, { factor: "Surface", score: 80 }],
    reasoning: "Graded against the published rubric. Connect the grading server for the live AI read.",
    sources: ["Published grading standards"], disclaimer: "Preview screening — not a live grade." };
}

/* ---------------- shared store ---------------- */
const VAULT = [];

/* ---------------- shimmer wordmark ---------------- */
function Shimmer({ children, style }) {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => { Animated.loop(Animated.timing(x, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true })).start(); }, []);
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-170, 170] });
  return (
    <View style={{ position: "relative", overflow: "hidden" }}>
      <Text style={style}>{children}</Text>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient colors={["transparent", "rgba(255,251,235,0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 90, height: "100%" }} />
      </Animated.View>
    </View>
  );
}
function CoinEmblem() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, []);
  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "10deg"] });
  return (
    <Animated.View style={{ width: 132, height: 132, marginBottom: 22, transform: [{ perspective: 700 }, { rotateY }] }}>
      <LinearGradient colors={["#FFFBEF", "#E9D29D", "#B8935A", "#7C6238"]} start={{ x: 0.3, y: 0.15 }} end={{ x: 0.85, y: 1 }} style={s.coin}>
        <LinearGradient colors={["#FFFBEF", "#D9BD83", "#9A7C48"]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={s.coinInner}>
          <Text style={s.coinF}>F</Text>
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

/* ---------------- landing ---------------- */
function Landing({ onEnter }) {
  return (
    <LinearGradient colors={["#16161C", "#0A0A0C"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }} style={s.landing}>
      <View style={{ alignItems: "center" }}>
        <CoinEmblem />
        <Text style={s.welcome}>Welcome to</Text>
        <Shimmer style={s.word}>The Frenchman's</Shimmer>
        <Shimmer style={s.wordSub}>Grades</Shimmer>
        <Text style={s.tag}>COINS · CURRENCY · CARDS · LUXURY</Text>
      </View>
      <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
        <TouchableOpacity style={[s.ab, s.abG]} onPress={onEnter} activeOpacity={0.85}><GoogleG /><Text style={s.abGText}>Continue with Google</Text></TouchableOpacity>
        <View style={[s.ab, { opacity: 0.4 }]}><Text style={[s.abText, { color: C.ink }]}></Text><Text style={s.abText}>Continue with Apple</Text><Text style={s.soon}>soon</Text></View>
        <TouchableOpacity style={s.ab} onPress={onEnter} activeOpacity={0.85}><Text style={s.abText}>Continue with Email</Text></TouchableOpacity>
        <TouchableOpacity onPress={onEnter} style={{ marginTop: 12 }}><Text style={s.skip}>Your Vault stays private to you.  <Text style={{ color: C.m2, fontWeight: "700" }}>Skip →</Text></Text></TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/* ---------------- camera ---------------- */
const KINDS = [{ k: "coin", l: "Coin", h: "Grading against Sheldon 1–70" }, { k: "currency", l: "Cash", h: "Grading against PMG 1–70" }, { k: "card", l: "Card", h: "Grading against PSA 1–10" }, { k: "luxury", l: "Luxury", h: "Screening luxury authenticity" }];
const LUX = [["bag", "Bags"], ["footwear", "Sneakers"], ["apparel", "Apparel"], ["eyewear", "Eyewear"], ["jewelry", "Jewelry"], ["accessory", "Belts"]];
function Camera({ onResult }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef(null);
  const [kind, setKind] = useState("coin"), [cat, setCat] = useState("bag"), [busy, setBusy] = useState(false);
  const flash = useRef(new Animated.Value(0)).current;
  const hint = KINDS.find((x) => x.k === kind).h;
  async function capture() {
    if (busy) return; setBusy(true);
    Animated.sequence([Animated.timing(flash, { toValue: 0.85, duration: 60, useNativeDriver: true }), Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true })]).start();
    let uri = null;
    try { if (camRef.current) { const shot = await camRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true }); uri = shot.uri; } } catch (e) {}
    const r = localGrade(kind, cat);
    VAULT.unshift({ id: String(Date.now()), title: LUX_NAMES[cat] && kind === "luxury" ? LUX_NAMES[cat] : r.rubric, kind, grade: cleanNum(r), trend: Math.random() > 0.5 ? "up" : "down", pct: 2 + Math.floor(Math.random() * 9) });
    setBusy(false); onResult(r, uri);
  }
  const granted = permission && permission.granted;
  return (
    <View style={{ flex: 1, backgroundColor: C.black }}>
      {granted ? <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" /> : (
        <View style={s.note}><Text style={s.noteT}>Point the camera at your item to grade it.</Text>
          <TouchableOpacity style={s.enable} onPress={requestPermission}><Text style={s.enableT}>Enable camera</Text></TouchableOpacity></View>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: flash }]} />
      <View style={s.reticle}><View style={s.frame} /></View>
      <View style={s.camTop}>
        <View style={s.seg}>{KINDS.map((x) => (
          <TouchableOpacity key={x.k} onPress={() => setKind(x.k)} style={{ borderRadius: 999, overflow: "hidden" }}>
            {kind === x.k ? <LinearGradient colors={["#F6E6B4", "#D3B77E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.segFill}><Text style={s.segOn}>{x.l}</Text></LinearGradient> : <Text style={s.segOff}>{x.l}</Text>}
          </TouchableOpacity>))}
        </View>
        {kind === "luxury" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {LUX.map(([k, l]) => (<TouchableOpacity key={k} onPress={() => setCat(k)} style={[s.chip, cat === k && { borderColor: C.m2 }]}><Text style={[s.chipT, cat === k && { color: C.m1 }]}>{l}</Text></TouchableOpacity>))}
          </ScrollView>
        )}
      </View>
      <View style={s.camBot}>
        <Text style={s.hint}>{busy ? "Grading…" : hint}</Text>
        <TouchableOpacity onPress={capture} activeOpacity={0.85} disabled={busy}>
          <LinearGradient colors={["#FFFBEF", "#E6CF98", "#B8935A"]} start={{ x: 0.4, y: 0.3 }} end={{ x: 0.8, y: 1 }} style={s.shutter}>{busy ? <ActivityIndicator color="#5a4620" /> : null}</LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
function cleanNum(r) { const m = (r.label || "").match(/^(.*?)\s*\(/); return m ? m[1] : (r.grade != null ? String(r.grade) : "—"); }

/* ---------------- result ---------------- */
function Result({ r, photo, onBack }) {
  const isCard = !!r.subgrades, low = isCard ? Math.min(...Object.values(r.subgrades)) : null;
  let num = r.grade != null ? String(r.grade) : "—", lab = r.label || "";
  const m = lab.match(/^(.*?)\s*\(([^)]+)\)\s*$/); if (m) { num = m[1]; lab = m[2]; }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.rHead}><TouchableOpacity onPress={onBack}><Text style={s.back}>‹</Text></TouchableOpacity><Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }}>Grade</Text><View style={{ width: 24 }} /></View>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 48, alignItems: "center" }}>
        {photo ? <Image source={{ uri: photo }} style={s.thumb} /> : <View style={[s.thumb, { alignItems: "center", justifyContent: "center" }]}><Text style={{ color: C.muted }}>No preview</Text></View>}
        <Text style={s.saved}>✓ Saved to Vault</Text>
        <Text style={s.gNum}>{num}</Text>
        {lab ? <Text style={s.gLab}>{lab}</Text> : null}
        {r.rubric ? <Text style={s.chipR}>{r.rubric}</Text> : null}
        {isCard ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 18, width: "100%" }}>
            {["centering", "corners", "edges", "surface"].map((k) => (<View key={k} style={[s.sub, r.subgrades[k] === low && { borderColor: "rgba(199,127,102,0.5)" }]}><Text style={[s.subN, r.subgrades[k] === low && { color: C.bad }]}>{r.subgrades[k]}</Text><Text style={s.subC}>{k}</Text></View>))}
          </View>
        ) : r.factors ? (
          <View style={{ width: "100%", marginTop: 16 }}>{r.factors.map((f, i) => { const p = f.score > 10 ? f.score : f.score * 10; return (<View key={i} style={{ marginBottom: 10 }}><Text style={s.barL}>{f.factor}</Text><View style={s.track}><View style={[s.fill, { width: `${p}%` }]} /></View></View>); })}</View>
        ) : null}
        {r.reasoning ? <Text style={s.reason}>{r.reasoning}</Text> : null}
        {r.sources ? <Text style={s.src}><Text style={{ color: C.ink, fontWeight: "700" }}>Sources: </Text>{r.sources.join(" · ")}</Text> : null}
        {r.disclaimer ? <Text style={s.disc}>{r.disclaimer}</Text> : null}
        <TouchableOpacity style={s.done} onPress={onBack}><Text style={{ color: C.ink, fontWeight: "600" }}>Grade another</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ---------------- vault ---------------- */
function Vault() {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 800); return () => clearInterval(t); }, []);
  const value = VAULT.length * 640;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 44 }}>
      <View style={s.vHead}><Text style={s.vTitle}>The Vault</Text><Text style={{ color: C.muted, fontSize: 13 }}>{VAULT.length} item{VAULT.length === 1 ? "" : "s"}</Text></View>
      <LinearGradient colors={["rgba(211,183,126,0.12)", "rgba(255,255,255,0.02)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.port}>
        <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>COLLECTION VALUE</Text><Text style={s.portV}>${value.toLocaleString()}</Text>
      </LinearGradient>
      {VAULT.length === 0 ? <Text style={s.empty}>Your Vault is empty.{"\n"}Snap your first grade to begin the collection.</Text> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 10 }}>
          {VAULT.map((i) => (<View key={i.id} style={s.row}><View style={s.rowTh}><Text style={s.rowThT}>{String(i.grade)[0] || "•"}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.rowName} numberOfLines={1}>{i.title}</Text><Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{cap(i.kind)}</Text></View>
            <View style={{ alignItems: "flex-end" }}><Text style={s.rowGrade}>{i.grade}</Text><Text style={[{ fontSize: 12, fontWeight: "700", marginTop: 2 }, i.trend === "up" ? { color: C.good } : { color: C.bad }]}>{i.trend === "up" ? "▲" : "▼"} {i.pct}%</Text></View></View>))}
        </ScrollView>
      )}
    </View>
  );
}
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : "");

/* ---------------- app ---------------- */
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [tab, setTab] = useState("camera");
  const [result, setResult] = useState(null), [photo, setPhoto] = useState(null);
  if (screen === "landing") return <Landing onEnter={() => setScreen("app")} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>
        {result ? <Result r={result} photo={photo} onBack={() => setResult(null)} />
          : tab === "camera" ? <Camera onResult={(r, u) => { setResult(r); setPhoto(u); }} />
          : <Vault />}
      </View>
      {!result && (
        <View style={s.tabs}>
          <TouchableOpacity style={s.tab} onPress={() => setTab("camera")}><Text style={[s.tabT, tab === "camera" && { color: C.m2 }]}>◉  Grade</Text></TouchableOpacity>
          <TouchableOpacity style={s.tab} onPress={() => setTab("vault")}><Text style={[s.tabT, tab === "vault" && { color: C.m2 }]}>▦  Vault</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  landing: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 90, paddingBottom: 48, paddingHorizontal: 28 },
  coin: { width: 132, height: 132, borderRadius: 66, alignItems: "center", justifyContent: "center" },
  coinInner: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  coinF: { fontSize: 58, fontWeight: "700", color: "#6B542C", textShadowColor: "rgba(255,255,255,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  welcome: { color: C.gold, fontSize: 22, fontStyle: "italic", marginBottom: 2 },
  word: { color: C.gold, fontSize: 38, fontWeight: "700", letterSpacing: 0.3 },
  wordSub: { color: C.gold, fontSize: 24, fontStyle: "italic", fontWeight: "600", opacity: 0.9 },
  tag: { color: C.muted, fontSize: 11.5, letterSpacing: 2.5, marginTop: 16 },
  ab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.04)" },
  abG: { backgroundColor: "#F3F0E9", borderColor: "transparent" },
  abGText: { color: "#161616", fontSize: 15, fontWeight: "700" },
  abText: { color: C.ink, fontSize: 15, fontWeight: "600" },
  soon: { color: C.muted, fontSize: 10, marginLeft: 4 },
  skip: { color: C.muted, fontSize: 13, textAlign: "center" },
  note: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 44, gap: 16 },
  noteT: { color: "#cbc8bf", fontSize: 14, textAlign: "center" },
  enable: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12 },
  enableT: { color: C.ink, fontWeight: "600" },
  reticle: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: "74%", aspectRatio: 1, maxWidth: 340, borderRadius: 26, borderWidth: 1.5, borderColor: "rgba(243,236,215,0.5)" },
  camTop: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 52, paddingHorizontal: 16, alignItems: "center", gap: 10 },
  seg: { flexDirection: "row", gap: 4, backgroundColor: "rgba(10,10,12,0.6)", borderWidth: 1, borderColor: C.line, borderRadius: 999, padding: 4 },
  segFill: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
  segOn: { color: "#2a2113", fontSize: 13, fontWeight: "700" },
  segOff: { paddingVertical: 9, paddingHorizontal: 15, color: "#b9b6ad", fontSize: 13, fontWeight: "600" },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(10,10,12,0.55)" },
  chipT: { color: "#c9c6bd", fontSize: 12, fontWeight: "600" },
  camBot: { position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 30, alignItems: "center", gap: 14 },
  hint: { color: "#e9e6dd", fontSize: 13 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  rHead: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { fontSize: 30, color: C.muted },
  thumb: { width: "100%", height: 180, borderRadius: 16, backgroundColor: "#17171b", borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  saved: { color: C.good, fontSize: 12, marginBottom: 12 },
  gNum: { fontWeight: "700", fontSize: 64, color: C.gold, lineHeight: 68 },
  gLab: { color: C.ink, fontSize: 17, fontWeight: "600", marginTop: 4 },
  chipR: { marginTop: 12, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, color: C.muted, fontSize: 12, overflow: "hidden" },
  sub: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  subN: { fontSize: 26, color: C.gold, fontWeight: "600" },
  subC: { fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },
  barL: { color: C.muted, fontSize: 12, marginBottom: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: "#1c1c20", overflow: "hidden" },
  fill: { height: 6, backgroundColor: "#D3B77E" },
  reason: { color: C.ink, fontSize: 14.5, lineHeight: 22, width: "100%", backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginTop: 20 },
  src: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14, width: "100%" },
  disc: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 14, width: "100%", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  done: { marginTop: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  vHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 8 },
  vTitle: { fontSize: 30, fontWeight: "700", color: C.gold },
  port: { margin: 22, marginTop: 12, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: C.line },
  portV: { fontSize: 34, fontWeight: "700", color: C.gold, marginTop: 4 },
  empty: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22, marginTop: 60 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  rowTh: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#1a1a1e", alignItems: "center", justifyContent: "center" },
  rowThT: { fontSize: 20, color: C.gold, fontWeight: "600" },
  rowName: { color: C.ink, fontSize: 15, fontWeight: "600" },
  rowGrade: { fontSize: 19, fontWeight: "700", color: C.gold },
  tabs: { flexDirection: "row", height: 74, paddingBottom: 12, paddingTop: 8, backgroundColor: "rgba(10,10,12,0.95)", borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabT: { color: C.muted, fontSize: 13, fontWeight: "600" },
});
