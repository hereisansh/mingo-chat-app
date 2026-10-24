import { useCallback, useEffect, useRef, useState } from "react";
import { FiBookOpen, FiExternalLink, FiHeadphones, FiHeart, FiMessageCircle, FiMusic, FiPlus, FiSend, FiInstagram, FiTrash2, FiSearch, FiPlay, FiShuffle, FiArrowUpRight } from "react-icons/fi";
import api, { assetUrl } from "../config/api";
import socketAPI from "../config/webSocket";
import toast from "react-hot-toast";

const getVideoId = (raw = "") => {
  try {
    const url = new URL(raw.trim());
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const match = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
    return match?.[1] || "";
  } catch { return /^[\w-]{11}$/.test(raw.trim()) ? raw.trim() : ""; }
};
const spotifyLink = (raw = "") => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !["open.spotify.com", "www.open.spotify.com"].includes(url.hostname.toLowerCase())) return "";
    const match = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([A-Za-z0-9]+)\/?$/i);
    return match ? `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}` : "";
  } catch { return ""; }
};
const themes = ["peach", "lavender", "ocean", "sunset"];
function Reels() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api.get("/instagram/reels").then(({ data }) => { if (active) setItems(data.data || []); }).catch((err) => { if (active) setError(err.response?.data?.message || "Couldn't load your Instagram Reels."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!items.length) return;
    const processEmbeds = () => window.instgrm?.Embeds?.process?.();
    const script = document.getElementById("instagram-embed-script");
    if (script) { if (window.instgrm) processEmbeds(); else script.addEventListener("load", processEmbeds, { once: true }); return; }
    const embedScript = document.createElement("script"); embedScript.id = "instagram-embed-script"; embedScript.async = true; embedScript.src = "https://www.instagram.com/embed.js"; embedScript.onload = processEmbeds; document.body.appendChild(embedScript);
  }, [items]);
  const addReel = async (event) => {
    event.preventDefault(); if (!draft.trim() || saving) return;
    setSaving(true); setError("");
    try { const { data } = await api.post("/instagram/reels", { url: draft.trim() }); setItems((current) => [data.data, ...current.filter((item) => item.shortcode !== data.data.shortcode)]); setDraft(""); }
    catch (err) { const message = err.response?.data?.message || "Couldn't add this Reel."; setError(message); toast.error(message); }
    finally { setSaving(false); }
  };
  const removeReel = async (shortcode) => {
    try { await api.delete(`/instagram/reels/${encodeURIComponent(shortcode)}`); setItems((current) => current.filter((item) => item.shortcode !== shortcode)); }
    catch (err) { toast.error(err.response?.data?.message || "Couldn't remove this Reel."); }
  };
  const copyLink = async (url) => { try { await navigator.clipboard.writeText(url); toast.success("Instagram Reel link copied."); } catch { toast.error("Could not copy this link."); } };
  return <div className="feature-page reels-page"><div className="feature-heading"><span className="feature-icon"><FiInstagram /></span><div><span className="eyebrow">A LITTLE SCROLL BREAK</span><h2>Instagram Reels</h2><p>Save public Instagram Reel links here and watch them inside Mingo.</p></div><a className="reel-explore-button" href="https://www.instagram.com/reels/" target="_blank" rel="noreferrer"><FiArrowUpRight/> Explore Instagram</a></div>
    <form className="instagram-reel-add" onSubmit={addReel}><FiInstagram/><input type="url" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Paste a public Instagram Reel link" aria-label="Instagram Reel link" required/><button disabled={!draft.trim() || saving}><FiPlus/>{saving ? "Adding…" : "Add Reel"}</button></form>
    <p className="instagram-reel-note">Only public Reels that allow embedding can play here. Your saved Reel links are private to your Mingo account.</p>
    {error && <div className="feature-alert">{error}</div>}{loading && <div className="music-loading">Loading your Instagram Reels…</div>}
    {!loading && !items.length && <div className="instagram-reel-empty"><FiInstagram/><strong>Your Reel feed is ready</strong><span>Paste a public Instagram Reel link above to add the first video.</span></div>}
    <div className="reel-feed instagram-reel-feed">{items.map((item) => <article className="reel-card instagram-reel-card" key={item.shortcode}><blockquote className="instagram-media" data-instgrm-permalink={item.url} data-instgrm-version="14"><a href={item.url} target="_blank" rel="noreferrer">View this Reel on Instagram</a></blockquote><div className="instagram-reel-actions"><button type="button" onClick={() => copyLink(item.url)} aria-label="Copy Reel link"><FiExternalLink/><span>Share</span></button><button type="button" onClick={() => removeReel(item.shortcode)} aria-label="Remove Reel from your list"><FiTrash2/><span>Remove</span></button></div></article>)}</div>
    <p className="feature-footnote">Instagram controls playback and availability. Private, removed, or embedding-disabled Reels may not load. Mingo stores the links, while Instagram serves the embedded video.</p></div>;
}

function Study({ user }) {
  const key = `mingo-notes-${user?._id || "guest"}`;
  const [notes, setNotes] = useState([]);
  const [chat, setChat] = useState([{ role: "assistant", content: "Hi! I can explain a topic, make revision notes, or quiz you. What are you studying?" }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [aiAvailable, setAiAvailable] = useState(null);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memoryReady, setMemoryReady] = useState(false);
  const [memoryItems, setMemoryItems] = useState([]);
  const [memoryQuestion, setMemoryQuestion] = useState("");
  const [memoryAnswer, setMemoryAnswer] = useState(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryAiAvailable, setMemoryAiAvailable] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api.get("/memory/notes"), api.get("/memory/settings"), api.get("/memory/items")]).then(async ([notesResult, settingsResult, itemsResult]) => {
      if (!active) return;
      let serverNotes = notesResult.data.data || [];
      const importedKey = `${key}-imported`;
      if (!localStorage.getItem(importedKey)) {
        localStorage.setItem(importedKey, "yes");
        let localNotes = []; try { localNotes = JSON.parse(localStorage.getItem(key)) || []; } catch { /* ignore old browser data */ }
        for (const note of localNotes) {
          if (note.text?.trim()) {
            try { const { data } = await api.post("/memory/notes", { title: note.title || "Imported study note", text: note.text }); serverNotes = [data.data, ...serverNotes]; }
            catch { /* keep loading other existing notes */ }
          }
        }
      }
      setNotes(serverNotes);
      setMemoryEnabled(Boolean(settingsResult.data.data?.enabled)); setMemoryAiAvailable(Boolean(settingsResult.data.data?.aiAvailable)); setAiProvider(settingsResult.data.data?.provider || "gemini");
      setMemoryItems(itemsResult.data.data || []); setMemoryReady(true);
    }).catch(() => { if (active) { setMemoryReady(true); toast.error("Couldn't load your private notes and memory."); } });
    return () => { active = false; };
  }, [key]);
  useEffect(() => { api.get("/study/status").then(({ data }) => { setAiAvailable(Boolean(data.data?.enabled)); setAiProvider(data.data?.provider || "gemini"); }).catch(() => setAiAvailable(null)); }, []);
  const ask = async (event) => {
    event.preventDefault();
    const question = draft.trim(); if (!question || busy) return;
    const history = chat.slice(-8);
    setChat((list) => [...list, { role: "user", content: question }]); setDraft(""); setBusy(true);
    try { const { data } = await api.post("/study/ask", { question, history }); setChat((list) => [...list, { role: "assistant", content: data.data.answer }]); }
    catch (error) { const message = error.response?.data?.message || "Couldn't reach Study Buddy. Try again."; toast.error(message); setChat((list) => [...list, { role: "assistant", content: message }]); }
    finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!noteDraft.trim() || !noteTitle.trim()) return toast.error("Add a short title and your note.");
    try { const { data } = await api.post("/memory/notes", { title: noteTitle.trim(), text: noteDraft.trim() }); setNotes((list) => [data.data, ...list]); setNoteDraft(""); setNoteTitle(""); toast.success(memoryEnabled ? "Note saved and added to your private memory." : "Private note saved."); }
    catch (error) { toast.error(error.response?.data?.message || "Couldn't save your note."); }
  };
  const toggleMemory = async () => {
    try { const { data } = await api.patch("/memory/settings", { enabled: !memoryEnabled }); setMemoryEnabled(data.data.enabled); toast.success(data.data.enabled ? "Mingo Memory is on for your account." : "Mingo Memory is off. Your saved items remain private."); }
    catch (error) { toast.error(error.response?.data?.message || "Couldn't update Mingo Memory."); }
  };
  const askMemory = async (event) => {
    event.preventDefault(); const question = memoryQuestion.trim(); if (!question || memoryBusy || !memoryEnabled) return;
    setMemoryBusy(true); setMemoryAnswer(null); setComparison(null);
    try { const { data } = await api.post("/memory/ask", { question }); setMemoryAnswer(data.data); }
    catch (error) { toast.error(error.response?.data?.message || "Couldn't search your memory."); }
    finally { setMemoryBusy(false); }
  };
  const compareSearch = async () => {
    if (!memoryQuestion.trim() || !memoryEnabled) return;
    try { const { data } = await api.post("/memory/compare", { question: memoryQuestion.trim() }); setComparison(data.data); }
    catch (error) { toast.error(error.response?.data?.message || "Couldn't compare searches."); }
  };
  const removeNote = async (note) => { try { await api.delete(`/memory/notes/${note._id}`); setNotes((list) => list.filter((item) => item._id !== note._id)); } catch { toast.error("Couldn't delete that note."); } };
  const removeMemory = async (item) => { try { await api.delete(`/memory/items/${item._id}`); setMemoryItems((list) => list.filter((entry) => entry._id !== item._id)); toast.success("Removed from your private memory."); } catch { toast.error("Couldn't remove that memory."); } };
  return <div className="feature-page study-page"><div className="feature-heading"><span className="feature-icon"><FiBookOpen /></span><div><span className="eyebrow">YOUR STUDY CORNER</span><h2>Study Buddy & Mingo Memory</h2><p>Ask questions about your own saved notes and chat memories. Each account has a separate private memory.</p></div></div>
    <section className="memory-card"><div className="memory-card-heading"><div><span className="eyebrow">YOUR PRIVATE AI MEMORY</span><h3>Find a detail you saved</h3><p>Only your study notes and messages you personally save are included. Your partner’s messages are never indexed.</p></div><label className="memory-toggle"><input type="checkbox" checked={memoryEnabled} onChange={toggleMemory} disabled={!memoryReady}/><span className="memory-toggle-track"/><strong>{memoryEnabled ? "On" : "Off"}</strong></label></div>
      <form className="memory-search-form" onSubmit={askMemory}><FiSearch/><input value={memoryQuestion} onChange={(e) => setMemoryQuestion(e.target.value)} placeholder={memoryEnabled ? "Ask, e.g. what topics did I save for my exam?" : "Turn on Mingo Memory to search your saved details"} maxLength={1000} disabled={!memoryEnabled || memoryBusy}/><button className="feature-primary" disabled={!memoryEnabled || memoryBusy || !memoryQuestion.trim()}>{memoryBusy ? "Searching…" : <><FiSend/> Ask</>}</button></form>
      {!memoryEnabled && <div className="memory-privacy-note">Your memories stay off until you switch them on. You can turn this off or delete saved items any time.</div>}
      {memoryEnabled && !memoryAiAvailable && <div className="memory-privacy-note">Without a configured AI key, Mingo uses a simple keyword search and shows matching saved details. OpenAI semantic ranking is used only when the OpenAI provider is selected.</div>}{memoryEnabled && memoryAiAvailable && <div className="memory-privacy-note">{aiProvider === "gemini" ? "With Gemini selected, your question and matching saved text go to Google; free limits apply and prompts may be used to improve products." : "With OpenAI selected, your question and matching saved text go to OpenAI. API usage may incur charges."}</div>}
      {memoryAnswer && <article className="memory-answer"><div className="memory-answer-label">{memoryAnswer.answeredBy === "ai" ? "MINGO MEMORY · AI ANSWER" : `MINGO MEMORY · ${memoryAnswer.method === "semantic" ? "SEMANTIC SEARCH" : "MATCHING DETAILS"}`}</div><p>{memoryAnswer.answer}</p>{memoryAnswer.sources?.length > 0 && <div className="memory-citations">{memoryAnswer.sources.map((source) => <div key={`${source.sourceType}-${source.sourceId}`}><strong>{source.title}</strong><span>{source.sourceType === "note" ? "Study note" : "Saved chat message"} · {new Date(source.createdAt).toLocaleDateString()}</span><p>{source.snippet}</p></div>)}</div>}</article>}
      {memoryEnabled && <div className="memory-tools"><button type="button" className="memory-compare-button" onClick={compareSearch} disabled={!memoryQuestion.trim()}>Compare keyword vs semantic results</button>{comparison && <div className="memory-comparison"><div><strong>Semantic</strong>{comparison.semantic?.length ? comparison.semantic.map((item, index) => <span key={`${item.title}-${index}`}>{index + 1}. {item.title}</span>) : <span>{comparison.semanticAvailable ? "No matching result" : "Semantic ranking needs the OpenAI provider; keyword search works with Gemini."}</span>}</div><div><strong>Keyword</strong>{comparison.keyword.map((item, index) => <span key={`${item.title}-${index}`}>{index + 1}. {item.title}</span>)}</div></div>}</div>}
      {memoryEnabled && memoryItems.length > 0 && <div className="memory-saved-list"><strong>Your saved chat memories</strong>{memoryItems.map((item) => <article key={item._id}><div><span>{item.text}</span><small>{new Date(item.createdAt).toLocaleDateString()}</small></div><button type="button" onClick={() => removeMemory(item)} title="Remove memory"><FiTrash2/></button></article>)}</div>}
    </section>
    {aiAvailable === false && <div className="ai-setup-banner"><div><strong>One quick setup step to turn on Study Buddy</strong><span>Create a Gemini API key, then save it in Render as GEMINI_API_KEY. Keep the key private; don’t paste it into chat or the app.</span></div><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get free-tier key ↗</a></div>}{aiAvailable === true && <div className="ai-ready-banner">Study Buddy is connected. Ask away ✨</div>}
    <div className="study-layout"><section className="study-chat"><div className="study-chat-title"><FiMessageCircle/> Study Buddy <span>{aiAvailable === true ? "AI ready" : aiAvailable === false ? "Needs API" : "…"}</span></div><div className="study-suggestions"><span>Try:</span>{["Explain my notes simply", "Make revision notes from my notes", "Quiz me from my notes"].map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div><div className="study-messages">{chat.map((item, index) => <div key={index} className={`study-message ${item.role}`}>{item.content}</div>)}{busy && <div className="study-message assistant study-thinking"><i/><i/><i/> Thinking through it…</div>}</div><form className="study-compose" onSubmit={ask}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a topic or your saved notes…" maxLength={4000}/><button disabled={busy || !draft.trim()} aria-label="Send question"><FiSend/></button></form></section><section className="notes-panel"><div className="study-chat-title"><FiBookOpen/> My notes <span>{notes.length}</span></div><p className="notes-ai-hint">Study Buddy can use your saved notes when you ask it a question.</p><input className="memory-note-title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title, e.g. Biology revision" maxLength={120}/><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write or paste a note to keep…" maxLength={5000}/><button className="feature-primary" onClick={saveNote}><FiPlus/> Save private note</button><div className="saved-notes">{notes.map((note) => <article key={note._id}><time>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</time><strong>{note.title}</strong><p>{note.text}</p><button onClick={() => removeNote(note)}>Delete</button></article>)}</div></section></div><p className="feature-footnote">When you ask Study Buddy, your question and any saved notes it uses are sent to {aiProvider === "gemini" ? "Google Gemini. Its free tier has usage limits and may use prompts to improve Google's products." : "OpenAI. API usage may incur charges."} AI responses can be wrong; check important facts.</p></div>;
}

function Stories({ user, selected }) {
  const [stories, setStories] = useState([]);
  const [text, setText] = useState(""); const [musicUrl, setMusicUrl] = useState(""); const [theme, setTheme] = useState("peach"); const [busy, setBusy] = useState(false); const [active, setActive] = useState(null);
  const load = () => api.get("/stories").then(({ data }) => setStories(data.data || [])).catch(() => toast.error("Couldn't load stories."));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!active) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setActive(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [active]);
  const post = async (event) => { event.preventDefault(); if (!text.trim() || busy) return; setBusy(true); try { await api.post("/stories", { text, musicUrl, theme, shareWith: selected?._id }); setText(""); setMusicUrl(""); await load(); toast.success("Your story is up for 24 hours."); } catch (error) { toast.error(error.response?.data?.message || "Couldn't post the story."); } finally { setBusy(false); } };
  const musicId = getVideoId(active?.musicUrl);
  return <div className="feature-page stories-page"><div className="feature-heading"><span className="feature-icon"><FiHeart /></span><div><span className="eyebrow">LITTLE MOMENTS</span><h2>Stories</h2><p>Share a thought with {selected?.fullName || "your partner"}. Stories disappear after 24 hours.</p></div></div><form className={`story-create story-theme-${theme}`} onSubmit={post}><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What moment do you want to share?" maxLength={500}/><div className="story-create-bottom"><div className="story-themes">{themes.map((color) => <button type="button" key={color} aria-label={`${color} story theme`} className={`theme-dot ${color} ${theme === color ? "chosen" : ""}`} onClick={() => setTheme(color)}/>)}</div><button className="feature-primary" disabled={busy || !text.trim() || !selected}><FiPlus/> Share story</button></div><label className="story-music"><FiMusic/><input value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)} placeholder="Add optional YouTube/Spotify music link"/></label></form><div className="story-list">{stories.map((story) => <button className={`story-tile story-theme-${story.theme}`} key={story._id} onClick={() => setActive(story)}><span className="story-avatar">{story.userId?.avatar ? <img src={assetUrl(story.userId.avatar)} alt=""/> : story.userId?.fullName?.slice(0,1)}</span><strong>{story.userId?._id === user?._id ? "Your story" : story.userId?.fullName || "Mingo friend"}</strong><p>{story.text}</p>{story.musicUrl && <small><FiMusic/> Music added</small>}<time>{new Date(story.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</time></button>)}</div>{active && <div className="story-viewer" onClick={() => setActive(null)}><button className="story-close">×</button><article className={`story-view-card story-theme-${active.theme}`} onClick={(e) => e.stopPropagation()}><strong>{active.userId?.fullName || "Your friend"}</strong><p>{active.text}</p>{active.musicUrl && <a href={active.musicUrl} target="_blank" rel="noreferrer"><FiMusic/> Open story music <FiExternalLink/></a>}{musicId && <iframe src={`https://www.youtube-nocookie.com/embed/${musicId}?autoplay=1`} title="Story music" allow="autoplay; encrypted-media"/>}</article></div>}</div>;
}

let spotifyIframeApiPromise;
const loadSpotifyIframeApi = () => {
  if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi);
  if (!spotifyIframeApiPromise) spotifyIframeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => { previous?.(api); window.SpotifyIframeApi = api; resolve(api); };
    let script = document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (!script) { script = document.createElement("script"); script.src = "https://open.spotify.com/embed/iframe-api/v1"; script.async = true; document.head.appendChild(script); }
    script.addEventListener("error", () => reject(new Error("Spotify player could not load.")), { once: true });
  });
  return spotifyIframeApiPromise;
};

function SpotifyMusicPlayer({ url, controllerRef, onPlayback, onReady }) {
  const hostRef = useRef(null); const playbackCallback = useRef(onPlayback); const readyCallback = useRef(onReady);
  useEffect(() => { playbackCallback.current = onPlayback; readyCallback.current = onReady; }, [onPlayback, onReady]);
  useEffect(() => {
    if (!url || !hostRef.current) return undefined;
    let alive = true; let controller;
    loadSpotifyIframeApi().then((api) => {
      if (!alive || !hostRef.current) return;
      api.createController(hostRef.current, { url, width: "100%", height: 152 }, (created) => {
        controller = created;
        if (!alive) { created.destroy(); return; }
        controllerRef.current = created; readyCallback.current?.(created);
        created.addListener("playback_update", (event) => playbackCallback.current(event.data, created));
      });
    }).catch(() => {});
    return () => { alive = false; if (controllerRef.current === controller) controllerRef.current = null; controller?.destroy(); };
  }, [url, controllerRef]);
  return <div className="spotify-music-player" ref={hostRef} aria-label="Spotify shared music player"/>;
}

let youtubeIframeApiPromise;
const loadYouTubeIframeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeIframeApiPromise) youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) { script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.appendChild(script); }
    script.addEventListener("error", () => reject(new Error("YouTube player could not load.")), { once: true });
  });
  return youtubeIframeApiPromise;
};

function YouTubeMusicPlayer({ videoId, controllerRef, onPlayback, onReady }) {
  const hostRef = useRef(null); const playbackCallback = useRef(onPlayback); const readyCallback = useRef(onReady);
  useEffect(() => { playbackCallback.current = onPlayback; readyCallback.current = onReady; }, [onPlayback, onReady]);
  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;
    let alive = true; let player;
    loadYouTubeIframeApi().then((api) => {
      if (!alive || !hostRef.current) return;
      player = new api.Player(hostRef.current, { width: "100%", height: "390", videoId, playerVars: { playsinline: 1, origin: window.location.origin }, events: {
        onReady: (event) => { if (!alive) return; controllerRef.current = event.target; readyCallback.current?.(event.target); },
        onStateChange: (event) => playbackCallback.current?.({ state: event.data, position: event.target.getCurrentTime?.() || 0 }, event.target),
      } });
    }).catch(() => {});
    return () => { alive = false; if (controllerRef.current === player) controllerRef.current = null; player?.destroy(); };
  }, [videoId, controllerRef]);
  return <div className="youtube-music-player" ref={hostRef} aria-label="YouTube shared music player"/>;
}

function MusicRoom({ contacts, user, selected }) {
  const peer = selected || contacts[0];
  const categories = ["bollywood", "hindi classics", "ambient", "electronic", "indie rock", "hip hop", "jazz", "classical", "folk", "experimental", "lofi", "soundtrack"];
  const storageKey = `mingo-music-room-${user?._id || "guest"}`; const trackStorageKey = `${storageKey}-track`;
  const [term, setTerm] = useState("ambient"); const [tracks, setTracks] = useState([]); const [spotifyTracks, setSpotifyTracks] = useState([]); const [spotifyTerm, setSpotifyTerm] = useState(""); const [spotifyBusy, setSpotifyBusy] = useState(false); const [spotifyStatus, setSpotifyStatus] = useState("Search Spotify songs by title, artist, or album."); const [youtubeTracks, setYoutubeTracks] = useState([]); const [youtubeTerm, setYoutubeTerm] = useState(""); const [youtubeBusy, setYoutubeBusy] = useState(false); const [youtubeStatus, setYoutubeStatus] = useState("Search YouTube songs, artists, or Bollywood tracks."); const [track, setTrack] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(trackStorageKey) || "null"); if (saved?.audioUrl?.startsWith("https://archive.org/download/") || spotifyLink(saved?.spotifyUrl || "") || /^[A-Za-z0-9_-]{11}$/.test(saved?.youtubeVideoId || "")) return saved; localStorage.removeItem(trackStorageKey); return null; } catch { localStorage.removeItem(trackStorageKey); return null; } }); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("Search free MP3 tracks from independent netlabels.");
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem(storageKey) || ""); const [joinCode, setJoinCode] = useState(""); const [roomCount, setRoomCount] = useState(0);
  const playerRef = useRef(null); const roomRef = useRef(roomCode); const joinCodeRef = useRef(""); const suppressSyncRef = useRef(false); const spotifyPlaybackRef = useRef(null); const youtubePlaybackRef = useRef(null); const pendingRoomEventRef = useRef(null);
  useEffect(() => { roomRef.current = roomCode; }, [roomCode]);
  const search = useCallback(async (query) => {
    setBusy(true);
    try {
      const { data } = await api.get("/music/search", { params: { q: query } });
      const found = data.data || [];
      setTracks(found); setStatus(found.length ? `Found ${found.length} free MP3 tracks for “${query}”.` : /bollywood|hindi classics|hindi hits/i.test(query) ? "This free MP3 collection doesn't include licensed Bollywood catalog songs." : `No free MP3 tracks found for “${query}”. Try a broader search.`);
    } catch (error) { setTracks([]); setStatus(error.response?.data?.message || "Free MP3 search is unavailable. Try again."); }
    finally { setBusy(false); }
  }, []);
  const searchSpotify = useCallback(async (query) => {
    const normalized = query.trim();
    if (!normalized) return;
    setSpotifyBusy(true); setSpotifyStatus(`Searching Spotify for “${normalized}”…`);
    try {
      const { data } = await api.get("/music/spotify/search", { params: { q: normalized } });
      const found = data.data || [];
      setSpotifyTracks(found); setSpotifyStatus(found.length ? `Found ${found.length} Spotify songs for “${normalized}”.` : `No Spotify songs found for “${normalized}”.`);
    } catch (error) {
      setSpotifyTracks([]); setSpotifyStatus(error.response?.data?.message || "Spotify search is unavailable. Try again.");
    } finally { setSpotifyBusy(false); }
  }, []);
  const searchYouTube = useCallback(async (query) => {
    const normalized = query.trim();
    if (!normalized) return;
    setYoutubeBusy(true); setYoutubeStatus(`Searching YouTube for “${normalized}”…`);
    try {
      const { data } = await api.get("/music/youtube/search", { params: { q: normalized } });
      const found = data.data || [];
      setYoutubeTracks(found); setYoutubeStatus(found.length ? `Found ${found.length} YouTube songs for “${normalized}”.` : `No YouTube songs found for “${normalized}”.`);
    } catch (error) { setYoutubeTracks([]); setYoutubeStatus(error.response?.data?.message || "YouTube search is unavailable. Try again."); }
    finally { setYoutubeBusy(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => search("ambient"), 0); return () => window.clearTimeout(timer); }, [search]);
  const applyRoomEvent = useCallback((event) => {
    suppressSyncRef.current = true; window.setTimeout(() => { suppressSyncRef.current = false; }, 1200);
    if (event.action === "load" && event.track) {
      setTrack(event.track); localStorage.setItem(trackStorageKey, JSON.stringify(event.track));
      setStatus("Your listening partner picked a song. Press play when you’re ready."); return;
    }
    const player = playerRef.current;
    if (!player) { pendingRoomEventRef.current = event; return; }
    if (track?.youtubeVideoId) {
      if (Number.isFinite(event.time)) player.seekTo(Math.floor(event.time), true);
      if (event.action === "play") player.playVideo();
      if (event.action === "pause") player.pauseVideo();
      if (event.action === "seek") player.seekTo(Math.floor(event.time || 0), true);
      return;
    }
    if (track?.spotifyUrl) {
      if (Number.isFinite(event.time)) player.seek(Math.floor(event.time));
      if (event.action === "play") player.play();
      if (event.action === "pause") player.pause();
      if (event.action === "seek") player.seek(Math.floor(event.time || 0));
      return;
    }
    if (Number.isFinite(event.time)) player.currentTime = event.time;
    if (event.action === "play") player.play().catch(() => setStatus("Press play to start the shared MP3 on this device."));
    if (event.action === "pause") player.pause();
    if (event.action === "seek") player.currentTime = event.time || 0;
  }, [track?.spotifyUrl, track?.youtubeVideoId, trackStorageKey]);
  const joinWithCode = useCallback((code, silent = false) => {
    if (!code || !socketAPI.connected) { if (!silent) toast.error("Mingo is reconnecting. Please wait a moment and try again."); return; }
    joinCodeRef.current = code;
    socketAPI.emit("music-room:join", { code }, (result) => {
      if (!result?.success) { joinCodeRef.current = ""; localStorage.removeItem(storageKey); if (!silent) toast.error(result?.message || "That room has expired. Create a new one."); setRoomCode(""); return; }
      roomRef.current = result.code; setRoomCode(result.code); localStorage.setItem(storageKey, result.code); setRoomCount(result.count);
      if (!silent) { setJoinCode(""); setStatus(`Joined listening room ${result.code}.`); toast.success("You joined the shared listening room."); }
    });
  }, [storageKey]);
  useEffect(() => {
    const connect = () => { if (roomRef.current) joinWithCode(roomRef.current, true); };
    if (roomRef.current && socketAPI.connected) connect();
    socketAPI.on("connect", connect);
    return () => socketAPI.off("connect", connect);
  }, [joinWithCode]);
  useEffect(() => {
    const sync = (event) => {
      if (String(event.from) === String(user?._id)) return;
      if (String(event.code) === String(roomRef.current)) applyRoomEvent(event);
      else if (!roomRef.current && String(event.code) === String(joinCodeRef.current)) { roomRef.current = event.code; setRoomCode(event.code); setRoomCount(2); applyRoomEvent(event); }
    };
    const presence = (event) => { if (String(event.code) === String(roomRef.current)) setRoomCount(event.count || 0); };
    socketAPI.on("music-room:sync", sync); socketAPI.on("music-room:presence", presence);
    return () => { socketAPI.off("music-room:sync", sync); socketAPI.off("music-room:presence", presence); };
  }, [applyRoomEvent, user?._id]);
  const sendRoomEvent = (event) => { if (roomRef.current) socketAPI.emit("music-room:sync", { ...event, code: roomRef.current }); };
  const chooseTrack = (item) => { setTrack(item); localStorage.setItem(trackStorageKey, JSON.stringify(item)); setStatus(`Ready to play ${item.title} in Mingo.`); sendRoomEvent({ action: "load", track: item }); };
  const spotifyPlayback = (data, controller) => {
    if (!data || !roomRef.current) return;
    const position = Math.max(0, Number(data.position) || 0) / 1000; const paused = Boolean(data.isPaused); const now = Date.now();
    const previous = spotifyPlaybackRef.current; spotifyPlaybackRef.current = { paused, position, at: now };
    if (suppressSyncRef.current) return;
    if (previous && previous.paused !== paused) sendRoomEvent({ action: paused ? "pause" : "play", time: position });
    if (previous && now - previous.at > 2500) {
      const expected = previous.position + (previous.paused ? 0 : (now - previous.at) / 1000);
      if (Math.abs(position - expected) > 4) sendRoomEvent({ action: "seek", time: position });
    }
    if (controller && !paused && previous?.paused) setStatus("Spotify is playing in your shared listening room.");
  };
  const spotifyPlayerReady = () => {
    const pending = pendingRoomEventRef.current; pendingRoomEventRef.current = null;
    if (pending && pending.action !== "load") applyRoomEvent(pending);
  };
  const youtubePlayback = (data) => {
    if (!data || !roomRef.current) return;
    const state = Number(data.state); const position = Math.max(0, Number(data.position) || 0); const now = Date.now();
    const previous = youtubePlaybackRef.current; youtubePlaybackRef.current = { state, position, at: now };
    if (suppressSyncRef.current || !previous) return;
    if (state !== previous.state && state === 1) sendRoomEvent({ action: "play", time: position });
    if (state !== previous.state && state === 2) sendRoomEvent({ action: "pause", time: position });
    if (now - previous.at > 2000) {
      const expected = previous.position + (previous.state === 1 ? (now - previous.at) / 1000 : 0);
      if (Math.abs(position - expected) > 4) sendRoomEvent({ action: "seek", time: position });
    }
  };
  const youtubePlayerReady = () => {
    const pending = pendingRoomEventRef.current; pendingRoomEventRef.current = null;
    if (pending && pending.action !== "load") applyRoomEvent(pending);
  };
  const joinRoom = (event) => { event.preventDefault(); const code = joinCode.replace(/\D/g, "").slice(0, 6); if (code.length !== 6) return toast.error("Enter the 6-digit room code."); joinWithCode(code); };
  const createRoom = () => { if (!socketAPI.connected) return toast.error("Mingo is reconnecting. Please wait a moment and try again."); socketAPI.emit("music-room:create", (result) => {
    if (!result?.success) return toast.error("Couldn’t create a listening room. Check your connection and retry.");
    roomRef.current = result.code; setRoomCode(result.code); localStorage.setItem(storageKey, result.code); setRoomCount(result.count); setStatus("Room created and saved on this device. Share the code with your friend.");
    if (track) socketAPI.emit("music-room:sync", { code: result.code, action: "load", track });
    toast.success("Your room code is ready and saved.");
  }); };
  const copyCode = async () => { try { await navigator.clipboard.writeText(roomCode); toast.success("Room code copied. You can switch to chat and come back later."); } catch { toast.error("Copy didn’t work. Select and copy the code."); } };
  const leaveRoom = () => { socketAPI.emit("music-room:leave", { code: roomCode }); roomRef.current = ""; setRoomCode(""); setRoomCount(0); localStorage.removeItem(storageKey); toast("You left the listening room.", { icon: "🌙" }); };
  const playerState = (state, player) => {
    if (suppressSyncRef.current || !roomRef.current) return;
    if (state === "play") sendRoomEvent({ action: "play", time: player.currentTime });
    if (state === "pause") sendRoomEvent({ action: "pause", time: player.currentTime });
  };
  return <div className="feature-page music-page"><div className="feature-heading"><span className="feature-icon"><FiHeadphones /></span><div><span className="eyebrow">SAME SONG, DIFFERENT PLACES</span><h2>Music room <span className="feature-live-pill">TOGETHER</span></h2><p>Search songs across the catalog and play them inside Mingo{peer ? ` · listening with ${peer.fullName}` : ""}.</p></div></div>
    <section className="listening-room-card"><div><span className="eyebrow">PRIVATE LISTENING ROOM</span><strong>{roomCode ? `Room ${roomCode}` : "Make a room for two"}</strong><small>{roomCode ? `${roomCount || 1} listener${roomCount === 1 ? "" : "s"} connected · code is saved if you switch tabs` : "Create a 6-digit code or enter a friend’s code to join."}</small></div>{roomCode ? <div className="listening-room-code"><code>{roomCode}</code><button type="button" onClick={copyCode}>Copy code</button><button type="button" onClick={leaveRoom}>Leave</button></div> : <div className="listening-room-actions"><button type="button" className="feature-primary" onClick={createRoom}>Create a room code</button><form onSubmit={joinRoom}><input aria-label="Listening room code" inputMode="numeric" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code"/><button type="submit">Join room</button></form></div>}</section>
    <div className="music-search-controls"><form onSubmit={(event) => { event.preventDefault(); searchYouTube(youtubeTerm); }}><FiSearch/><input value={youtubeTerm} onChange={(event) => setYoutubeTerm(event.target.value)} placeholder="Search YouTube songs, Bollywood…" aria-label="Search YouTube music"/><button disabled={youtubeBusy || !youtubeTerm.trim()}>{youtubeBusy ? "Searching…" : "Search YouTube"}</button></form><form onSubmit={(event) => { event.preventDefault(); searchSpotify(spotifyTerm); }}><FiSearch/><input value={spotifyTerm} onChange={(event) => setSpotifyTerm(event.target.value)} placeholder="Search Spotify songs, artists, albums" aria-label="Search Spotify music"/><button disabled={spotifyBusy || !spotifyTerm.trim()}>{spotifyBusy ? "Searching…" : "Search songs"}</button></form><form onSubmit={(event) => { event.preventDefault(); search(term.trim()); }}><FiSearch/><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search free MP3s"/><button disabled={busy || !term.trim()}>{busy ? "Searching…" : "Search MP3s"}</button></form><a className="music-search-link" href="https://www.jiosaavn.com/" target="_blank" rel="noreferrer"><FiMusic/> Open JioSaavn <FiExternalLink/></a><div className="music-genre-chips">{categories.map((genre) => <button type="button" key={genre} className={term.toLowerCase() === genre ? "active" : ""} onClick={() => { setTerm(genre); setSpotifyTerm(genre); setYoutubeTerm(genre); search(genre); searchSpotify(genre); searchYouTube(genre); }}>{genre}</button>)}</div></div>
    <div className="music-library-heading"><div><span className="eyebrow">YOUTUBE MUSIC · SELECT TO PLAY</span><h3>{youtubeTerm || "Search YouTube"}</h3></div><span>{youtubeTracks.length} songs</span></div>
    <div className="music-track-grid">{youtubeTracks.map((item) => <article className={`music-track-card ${track?.youtubeVideoId === item.youtubeVideoId ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play together in Mingo</em></span><FiPlay/></button></article>)}</div>{youtubeBusy && <div className="music-loading">Searching YouTube…</div>}{!youtubeBusy && !youtubeTracks.length && <div className="music-empty-results">{youtubeStatus}</div>}
    <div className="music-library-heading"><div><span className="eyebrow">SPOTIFY SONGS · SELECT TO PLAY</span><h3>{spotifyTerm || "Search Spotify"}</h3></div><span>{spotifyTracks.length} songs</span></div>
    <div className="music-track-grid">{spotifyTracks.map((item) => <article className={`music-track-card ${track?.id === item.id ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play together in Mingo</em></span><FiPlay/></button></article>)}</div>{spotifyBusy && <div className="music-loading">Searching Spotify…</div>}{!spotifyBusy && !spotifyTracks.length && <div className="music-empty-results">{spotifyStatus}</div>}
    <div className="music-library-heading"><div><span className="eyebrow">FREE MP3 CATALOG</span><h3>{term || "Explore music"}</h3></div><span>{tracks.length} tracks</span></div>
    <div className="music-library-heading"><div><span className="eyebrow">MUSIC BROWSER · FREE MP3S</span><h3>{term || "Explore music"}</h3></div><span>{tracks.length} tracks</span></div>
    <div className="music-track-grid">{tracks.map((item) => <article className={`music-track-card ${track?.id === item.id ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play MP3 in Mingo</em></span><FiPlay/></button></article>)}</div>{busy && <div className="music-loading">Searching free MP3s…</div>}{!busy && !tracks.length && <div className="music-empty-results">{status}{/bollywood|hindi classics|hindi hits/i.test(term) && <p>Find Bollywood songs on <a href="https://open.spotify.com/search/bollywood" target="_blank" rel="noreferrer">Spotify</a>, then copy a song or playlist link into the Spotify box above. For free licensed streaming, <a href="https://www.jiosaavn.com/" target="_blank" rel="noreferrer">JioSaavn</a> plays its music on its own site.</p>}</div>}
    <section className="shared-audio-card"><div className="shared-audio-heading"><img src={track?.artwork || ""} alt=""/><div><span className="eyebrow">NOW PLAYING IN YOUR ROOM</span><strong>{track?.title || "Choose music to play"}</strong><small>{track?.artist || status}</small></div></div>{track?.youtubeVideoId ? <YouTubeMusicPlayer key={track.youtubeVideoId} videoId={track.youtubeVideoId} controllerRef={playerRef} onPlayback={youtubePlayback} onReady={youtubePlayerReady}/> : track?.spotifyUrl ? <SpotifyMusicPlayer key={track.spotifyUrl} url={track.spotifyUrl} controllerRef={playerRef} onPlayback={spotifyPlayback} onReady={spotifyPlayerReady}/> : track?.audioUrl ? <audio key={track.id} ref={playerRef} className="mp3-music-player" src={track.audioUrl} controls preload="none" onPlay={(event) => playerState("play", event.currentTarget)} onPause={(event) => playerState("pause", event.currentTarget)} aria-label={`Play ${track.title}`} /> : <div className="music-player-placeholder"><span>♫</span><strong>Your next song is waiting</strong><small>Search YouTube, MP3s, or Spotify.</small></div>}{track?.youtubeVideoId ? <p>YouTube streams this video in its official player. Playback syncs in the room; each listener may need to press play once.</p> : <p>{track?.spotifyUrl ? "Spotify supplies the player. Playback and availability depend on Spotify and each listener’s account. Each listener may need to press play once." : "Free independent music streams as MP3 from the Internet Archive Netlabels collection. Track rights and availability are set by each uploader."}</p>}</section>
    <p className="feature-footnote">Search for a song or artist above, then select a result to load it in the shared Spotify player. Spotify may require sign-in and controls which tracks each listener can play. JioSaavn opens in a separate tab; its playback does not sync with this room. Free independent MP3s are also available. <a href="https://archive.org/details/netlabels" target="_blank" rel="noreferrer">Browse free MP3s</a>. Room codes and selected tracks are saved on this device.</p></div>;
}

export default function FeatureHub({ tab, user, contacts, selected }) {
  if (tab === "reels") return <Reels/>;
  if (tab === "study") return <Study user={user}/>;
  if (tab === "stories") return <Stories user={user} selected={selected}/>;
  if (tab === "games") return <Games peer={selected}/>;
  return <MusicRoom contacts={contacts} user={user} selected={selected}/>;
}

function Games({ peer }) {
  const [activeGame, setActiveGame] = useState("tic-tac-toe");
  const playerLabel = peer?.fullName || "your person";
  return <div className="feature-page games-page"><div className="feature-heading"><span className="feature-icon">✦</span><div><span className="eyebrow">A LITTLE PLAY BREAK</span><h2>Mini games</h2><p>Quick pass-and-play games for you and {playerLabel} on one screen.</p></div></div>
    <div className="mini-game-tabs" role="tablist" aria-label="Choose a mini game"><button role="tab" aria-selected={activeGame === "tic-tac-toe"} className={activeGame === "tic-tac-toe" ? "active" : ""} onClick={() => setActiveGame("tic-tac-toe")}>Tic-tac-toe</button><button role="tab" aria-selected={activeGame === "memory"} className={activeGame === "memory" ? "active" : ""} onClick={() => setActiveGame("memory")}>Memory match</button></div>
    {activeGame === "tic-tac-toe" ? <TicTacToe/> : <MemoryMatch/>}</div>;
}

function TicTacToe() {
  const emptyBoard = () => Array(9).fill("");
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState("X");
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = wins.map(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c] ? board[a] : "").find(Boolean);
  const draw = !winner && board.every(Boolean);
  const play = (index) => {
    if (board[index] || winner || draw) return;
    const next = [...board]; next[index] = turn; setBoard(next);
    const won = wins.some(([a,b,c]) => next[a] && next[a] === next[b] && next[a] === next[c]);
    if (won) setScores((current) => ({ ...current, [turn]: current[turn] + 1 }));
    else setTurn(turn === "X" ? "O" : "X");
  };
  const reset = () => { setBoard(emptyBoard()); setTurn("X"); };
  return <section className="mini-game-card"><div className="mini-game-heading"><div><span className="eyebrow">TWO PLAYER · SAME SCREEN</span><h3>Tic-tac-toe</h3><p>{winner ? `${winner === "X" ? "Player 1" : "Player 2"} wins this round!` : draw ? "It’s a draw. Play again?" : `${turn === "X" ? "Player 1" : "Player 2"}’s turn`}</p></div><div className="mini-game-score"><span>Player 1 <b>{scores.X}</b></span><span>Player 2 <b>{scores.O}</b></span></div></div><div className="tic-tac-toe-board" role="grid" aria-label="Tic-tac-toe board">{board.map((mark, index) => <button key={index} role="gridcell" aria-label={`Square ${index + 1}${mark ? `, ${mark}` : ""}`} className={`tic-tac-toe-cell ${mark === "X" ? "mark-x" : "mark-o"}`} onClick={() => play(index)} disabled={Boolean(mark || winner || draw)}>{mark}</button>)}</div><button className="feature-primary game-reset" onClick={reset}>New round</button><small className="game-note">Scores stay here until you leave this page.</small></section>;
}

const memorySymbols = ["✿", "☀", "♡", "☾", "✦", "☁", "♬", "❀"];
const shuffledMemoryDeck = () => [...memorySymbols, ...memorySymbols].map((symbol, index) => ({ id: `${index}-${Math.random().toString(36).slice(2)}`, symbol })).sort(() => Math.random() - 0.5);

function MemoryMatch() {
  const [cards, setCards] = useState(shuffledMemoryDeck);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const reset = () => { setCards(shuffledMemoryDeck()); setFlipped([]); setMatched([]); setMoves(0); setLocked(false); };
  const flip = (card) => {
    if (locked || flipped.includes(card.id) || matched.includes(card.symbol)) return;
    const next = [...flipped, card.id]; setFlipped(next);
    if (next.length === 2) {
      setMoves((count) => count + 1);
      const first = cards.find((item) => item.id === next[0]);
      if (first.symbol === card.symbol) { setMatched((current) => [...current, card.symbol]); setFlipped([]); }
      else { setLocked(true); window.setTimeout(() => { setFlipped([]); setLocked(false); }, 750); }
    }
  };
  const complete = matched.length === memorySymbols.length;
  return <section className="mini-game-card memory-match-card"><div className="mini-game-heading"><div><span className="eyebrow">TWO PLAYER · SAME SCREEN</span><h3>Memory match</h3><p>{complete ? `You found every pair in ${moves} moves!` : "Take turns flipping cards and find all eight pairs."}</p></div><div className="mini-game-score"><span>Moves <b>{moves}</b></span><span>Pairs <b>{matched.length}/{memorySymbols.length}</b></span></div></div><div className="memory-match-board" aria-label="Memory match cards">{cards.map((card, index) => { const faceUp = flipped.includes(card.id) || matched.includes(card.symbol); return <button type="button" key={card.id} className={`memory-match-card-tile ${faceUp ? "face-up" : ""} ${matched.includes(card.symbol) ? "matched" : ""}`} onClick={() => flip(card)} disabled={locked || faceUp} aria-label={faceUp ? `Card ${index + 1}: ${card.symbol}` : `Hidden card ${index + 1}`}>{faceUp ? card.symbol : "✦"}</button>; })}</div><button className="feature-primary game-reset" onClick={reset}>New game</button><small className="game-note">Take turns with someone beside you. A new game reshuffles the cards.</small></section>;
}
