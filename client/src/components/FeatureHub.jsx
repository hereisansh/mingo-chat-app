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
  const categories = ["Bollywood Hits", "Latest Bollywood", "90s Bollywood", "Romantic Hindi", "Hindi Sad Songs", "Hindi Party Songs", "Punjabi Hits", "Hindi classics", "ambient", "electronic", "indie rock", "hip hop", "jazz", "classical", "folk", "lofi", "soundtrack"];
  const storageKey = `mingo-music-room-${user?._id || "guest"}`; const trackStorageKey = `${storageKey}-track`;
  const [term, setTerm] = useState("ambient"); const [tracks, setTracks] = useState([]); const [youtubeTracks, setYoutubeTracks] = useState([]); const [youtubeTerm, setYoutubeTerm] = useState(""); const [youtubeBusy, setYoutubeBusy] = useState(false); const [youtubeStatus, setYoutubeStatus] = useState("Search Bollywood songs, artists, or albums."); const [youtubeNextPage, setYoutubeNextPage] = useState(""); const [track, setTrack] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(trackStorageKey) || "null"); if (saved?.audioUrl?.startsWith("https://archive.org/download/") || /^[A-Za-z0-9_-]{11}$/.test(saved?.youtubeVideoId || "")) return saved; localStorage.removeItem(trackStorageKey); return null; } catch { localStorage.removeItem(trackStorageKey); return null; } }); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("Search free MP3 tracks from independent netlabels.");
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem(storageKey) || ""); const [joinCode, setJoinCode] = useState(""); const [roomCount, setRoomCount] = useState(0);
  const playerRef = useRef(null); const playerSectionRef = useRef(null); const scrollToPlayerRef = useRef(false); const roomRef = useRef(roomCode); const joinCodeRef = useRef(""); const suppressSyncRef = useRef(false); const youtubePlaybackRef = useRef(null); const pendingRoomEventRef = useRef(null);
  useEffect(() => {
    if (!scrollToPlayerRef.current || !track) return;
    scrollToPlayerRef.current = false;
    playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [track]);
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
  const searchYouTube = useCallback(async (query, pageToken = "", append = false) => {
    const normalized = query.trim();
    if (!normalized) return;
    setYoutubeBusy(true); setYoutubeStatus(`Searching YouTube for “${normalized}”…`);
    try {
      const { data } = await api.get("/music/youtube/search", { params: { q: normalized, pageToken } });
      const found = data.data || [];
      setYoutubeTracks((previous) => append ? [...previous, ...found] : found); setYoutubeNextPage(data.nextPageToken || "");
      setYoutubeStatus(found.length ? `Showing YouTube results for “${normalized}”.` : `No YouTube songs found for “${normalized}”.`);
    } catch (error) { if (!append) setYoutubeTracks([]); setYoutubeNextPage(""); setYoutubeStatus(error.response?.data?.message || "YouTube search is unavailable. Try again."); }
    finally { setYoutubeBusy(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => search("ambient"), 0); return () => window.clearTimeout(timer); }, [search]);
  const applyRoomEvent = useCallback((event) => {
    suppressSyncRef.current = true; window.setTimeout(() => { suppressSyncRef.current = false; }, 1200);
    if (event.action === "load" && event.track) {
      const playableTrack = event.track.youtubeVideoId || event.track.audioUrl?.startsWith("https://archive.org/download/") ? event.track : null;
      setTrack(playableTrack);
      if (playableTrack) localStorage.setItem(trackStorageKey, JSON.stringify(playableTrack)); else localStorage.removeItem(trackStorageKey);
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
    if (Number.isFinite(event.time)) player.currentTime = event.time;
    if (event.action === "play") player.play().catch(() => setStatus("Press play to start the shared MP3 on this device."));
    if (event.action === "pause") player.pause();
    if (event.action === "seek") player.currentTime = event.time || 0;
  }, [track?.youtubeVideoId, trackStorageKey]);
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
  const chooseTrack = (item) => { scrollToPlayerRef.current = true; setTrack(item); localStorage.setItem(trackStorageKey, JSON.stringify(item)); setStatus(`Ready to play ${item.title} in Mingo.`); sendRoomEvent({ action: "load", track: item }); };
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
    <div className="music-search-controls"><form onSubmit={(event) => { event.preventDefault(); searchYouTube(youtubeTerm); }}><FiSearch/><input value={youtubeTerm} onChange={(event) => setYoutubeTerm(event.target.value)} placeholder="Search Bollywood songs, artists, albums…" aria-label="Search YouTube music"/><button disabled={youtubeBusy || !youtubeTerm.trim()}>{youtubeBusy ? "Searching…" : "Search songs"}</button></form><form onSubmit={(event) => { event.preventDefault(); search(term.trim()); }}><FiSearch/><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search free MP3s"/><button disabled={busy || !term.trim()}>{busy ? "Searching…" : "Search MP3s"}</button></form><div className="music-genre-chips">{categories.map((genre) => <button type="button" key={genre} className={youtubeTerm.toLowerCase() === genre.toLowerCase() ? "active" : ""} onClick={() => { setYoutubeTerm(genre); searchYouTube(genre); if (!["Bollywood Hits", "Latest Bollywood", "90s Bollywood", "Romantic Hindi", "Hindi Sad Songs", "Hindi Party Songs", "Punjabi Hits", "Hindi classics"].includes(genre)) { setTerm(genre); search(genre); } }}>{genre}</button>)}</div></div>
    <div className="music-library-heading"><div><span className="eyebrow">YOUTUBE MUSIC · SELECT TO PLAY</span><h3>{youtubeTerm || "Search YouTube"}</h3></div><span>{youtubeTracks.length} songs</span></div>
    <div className="music-track-grid">{youtubeTracks.map((item) => <article className={`music-track-card ${track?.youtubeVideoId === item.youtubeVideoId ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play together in Mingo</em></span><FiPlay/></button></article>)}</div>{youtubeBusy && <div className="music-loading">Searching YouTube…</div>}{!youtubeBusy && !youtubeTracks.length && <div className="music-empty-results">{youtubeStatus}</div>}{youtubeNextPage && <button type="button" className="music-search-link" disabled={youtubeBusy} onClick={() => searchYouTube(youtubeTerm, youtubeNextPage, true)}>{youtubeBusy ? "Loading…" : "Load more songs"}</button>}
    <div className="music-library-heading"><div><span className="eyebrow">FREE MP3 CATALOG</span><h3>{term || "Explore music"}</h3></div><span>{tracks.length} tracks</span></div>
    <div className="music-library-heading"><div><span className="eyebrow">MUSIC BROWSER · FREE MP3S</span><h3>{term || "Explore music"}</h3></div><span>{tracks.length} tracks</span></div>
    <div className="music-track-grid">{tracks.map((item) => <article className={`music-track-card ${track?.id === item.id ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play MP3 in Mingo</em></span><FiPlay/></button></article>)}</div>{busy && <div className="music-loading">Searching free MP3s…</div>}{!busy && !tracks.length && <div className="music-empty-results">{status}{/bollywood|hindi classics|hindi hits/i.test(term) && <p>Try the Bollywood categories above and search YouTube songs here. The free MP3 collection does not include licensed Bollywood catalog tracks.</p>}</div>}
    <section className="shared-audio-card" ref={playerSectionRef}><div className="shared-audio-heading"><img src={track?.artwork || ""} alt=""/><div><span className="eyebrow">NOW PLAYING IN YOUR ROOM</span><strong>{track?.title || "Choose music to play"}</strong><small>{track?.artist || status}</small></div></div>{track?.youtubeVideoId ? <YouTubeMusicPlayer key={track.youtubeVideoId} videoId={track.youtubeVideoId} controllerRef={playerRef} onPlayback={youtubePlayback} onReady={youtubePlayerReady}/> : track?.audioUrl ? <audio key={track.id} ref={playerRef} className="mp3-music-player" src={track.audioUrl} controls preload="none" onPlay={(event) => playerState("play", event.currentTarget)} onPause={(event) => playerState("pause", event.currentTarget)} aria-label={`Play ${track.title}`} /> : <div className="music-player-placeholder"><span>♫</span><strong>Your next song is waiting</strong><small>Search songs above and choose one to play here.</small></div>}{track?.youtubeVideoId ? <p>YouTube streams this video in its official player. Playback syncs in the room; each listener may need to press play once.</p> : <p>Free independent music streams as MP3 from the Internet Archive Netlabels collection. Track rights and availability are set by each uploader.</p>}</section>
    <p className="feature-footnote">Search for a song or artist above, then choose a result to play it in YouTube’s player and sync controls with your room. Search results come from YouTube and are not a complete licensed Bollywood catalog. Free independent MP3s are also available. Room codes and selected tracks are saved on this device.</p></div>;
}

export default function FeatureHub({ tab, user, contacts, selected, gameInvite, onGameInviteHandled }) {
  if (tab === "reels") return <Reels/>;
  if (tab === "study") return <Study user={user}/>;
  if (tab === "stories") return <Stories user={user} selected={selected}/>;
  if (tab === "games") return <Games peer={selected} contacts={contacts} user={user} invite={gameInvite} onInviteHandled={onGameInviteHandled}/>;
  return <MusicRoom contacts={contacts} user={user} selected={selected}/>;
}

function Games({ peer, contacts, user, invite, onInviteHandled }) {
  const [activeGame, setActiveGame] = useState(invite?.gameType === "memory" ? "memory-online" : invite?.gameType === "snake" ? "snake-online" : "online");
  const [localGame, setLocalGame] = useState("tic-tac-toe");
  useEffect(() => { if (invite?.gameType === "memory") setActiveGame("memory-online"); else if (invite?.gameType === "snake") setActiveGame("snake-online"); else if (invite) setActiveGame("online"); }, [invite]);
  const playerLabel = peer?.fullName || "your person";
  return <div className="feature-page games-page"><div className="feature-heading"><span className="feature-icon">✦</span><div><span className="eyebrow">A LITTLE PLAY BREAK</span><h2>Mini games</h2><p>Challenge {playerLabel} or play a quick game side by side.</p></div></div>
    <div className="mini-game-tabs" role="tablist" aria-label="Choose a mini game"><button role="tab" aria-selected={activeGame === "online"} className={activeGame === "online" ? "active" : ""} onClick={() => setActiveGame("online")}>Tic-tac-toe</button><button role="tab" aria-selected={activeGame === "memory-online"} className={activeGame === "memory-online" ? "active" : ""} onClick={() => setActiveGame("memory-online")}>Memory match</button><button role="tab" aria-selected={activeGame === "snake-online"} className={activeGame === "snake-online" ? "active" : ""} onClick={() => setActiveGame("snake-online")}>Snake duel</button><button role="tab" aria-selected={activeGame === "local"} className={activeGame === "local" ? "active" : ""} onClick={() => setActiveGame("local")}>Same device</button></div>
    {activeGame === "online" || activeGame === "memory-online" || activeGame === "snake-online" ? <OnlineGame key={activeGame} gameType={activeGame === "memory-online" ? "memory" : activeGame === "snake-online" ? "snake" : "tic-tac-toe"} peer={peer} contacts={contacts} user={user} invite={invite} onInviteHandled={onInviteHandled}/> : <><div className="mini-game-tabs local-game-tabs" role="tablist" aria-label="Choose a same-device game"><button className={localGame === "tic-tac-toe" ? "active" : ""} onClick={() => setLocalGame("tic-tac-toe")}>Tic-tac-toe</button><button className={localGame === "memory" ? "active" : ""} onClick={() => setLocalGame("memory")}>Memory match</button></div>{localGame === "tic-tac-toe" ? <TicTacToe/> : <MemoryMatch/>}</>}</div>;
}

function OnlineGame({ gameType, peer, contacts, user, invite, onInviteHandled }) {
  const [room, setRoom] = useState(null);
  const [targetId, setTargetId] = useState(peer && !peer.isGroup ? String(peer._id) : "");
  const [joinCode, setJoinCode] = useState("");
  const roomRef = useRef(null);
  useEffect(() => { if (peer && !peer.isGroup) setTargetId(String(peer._id)); }, [peer?._id, peer?.isGroup]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    const update = (state) => { if (String(state.code) === String(roomRef.current?.code) && state.gameType === gameType) { roomRef.current = state; setRoom(state); sessionStorage.setItem("mingoGameRoom", state.code); sessionStorage.setItem("mingoGameType", state.gameType); } };
    const closed = ({ code }) => { if (String(code) === String(roomRef.current?.code)) { setRoom(null); roomRef.current = null; sessionStorage.removeItem("mingoGameRoom"); sessionStorage.removeItem("mingoGameType"); toast("This game invite has expired."); } };
    const resume = () => { const code = roomRef.current?.code || sessionStorage.getItem("mingoGameRoom"); if (code && (!sessionStorage.getItem("mingoGameType") || sessionStorage.getItem("mingoGameType") === gameType)) socketAPI.emit("game:join", { code }, (result) => { if (result?.success && result.data.gameType === gameType) { roomRef.current = result.data; setRoom(result.data); } }); };
    socketAPI.on("game:update", update); socketAPI.on("game:closed", closed); socketAPI.on("connect", resume);
    const savedCode = sessionStorage.getItem("mingoGameRoom"); if (savedCode && socketAPI.connected) resume();
    return () => { socketAPI.off("game:update", update); socketAPI.off("game:closed", closed); socketAPI.off("connect", resume); };
  }, [gameType]);
  useEffect(() => {
    if (gameType !== "snake") return undefined;
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      const direction = ({ ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" })[event.key];
      if (!direction) return;
      event.preventDefault();
      const current = roomRef.current;
      if (current?.status === "playing") socketAPI.emit("game:snake:turn", { code: current.code, direction });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameType]);
  const create = () => {
    if (!targetId) return toast.error("Choose a friend first.");
    socketAPI.emit("game:create", { to: targetId, gameType }, (result) => {
      if (!result?.success) return toast.error(result?.message || "Couldn’t start the game.");
      roomRef.current = result.data; setRoom(result.data); sessionStorage.setItem("mingoGameRoom", result.data.code); sessionStorage.setItem("mingoGameType", gameType);
      toast.success("Game invite sent! Your friend can join from their Games tab.");
    });
  };
  const join = (code = joinCode) => {
    socketAPI.emit("game:join", { code }, (result) => {
      if (!result?.success) return toast.error(result?.message || "Couldn’t join that game.");
      if (result.data.gameType !== gameType) { socketAPI.emit("game:leave", { code: result.data.code }); return toast.error("That code belongs to another game. Open its invite first."); }
      roomRef.current = result.data; setRoom(result.data); sessionStorage.setItem("mingoGameRoom", result.data.code); sessionStorage.setItem("mingoGameType", result.data.gameType); setJoinCode(""); onInviteHandled?.();
    });
  };
  const leave = () => { if (room) socketAPI.emit("game:leave", { code: room.code }); setRoom(null); roomRef.current = null; sessionStorage.removeItem("mingoGameRoom"); sessionStorage.removeItem("mingoGameType"); onInviteHandled?.(); };
  const play = (index) => { if (room && room.status === "playing" && room.turnUserId === String(user?._id)) socketAPI.emit("game:move", { code: room.code, index }); };
  const flip = (index) => { if (room && room.status === "playing" && room.turnUserId === String(user?._id)) socketAPI.emit("game:memory:flip", { code: room.code, index }); };
  const steer = (direction) => { if (room?.status === "playing") socketAPI.emit("game:snake:turn", { code: room.code, direction }); };
  const myIndex = room?.players?.indexOf(String(user?._id)) ?? -1;
  const myMark = myIndex === 0 ? "X" : myIndex === 1 ? "O" : "";
  const isMyTurn = room?.turnUserId === String(user?._id);
  const opponentId = room?.players?.find((playerId) => playerId !== String(user?._id)) || room?.invitedUserId;
  const opponent = contacts.find((person) => String(person._id) === String(opponentId));
  const opponentName = opponent?.fullName || peer?.fullName || "Your friend";
  const winningPlayerId = room?.winner ? room.players?.[room.winner === "X" ? 0 : 1] : null;
  const winnerText = room?.winner ? (gameType === "memory" || gameType === "snake" ? (room.winnerUserId === String(user?._id) ? "You win! 🎉" : `${opponentName} wins!`) : (winningPlayerId === String(user?._id) ? "You win! 🎉" : `${opponentName} wins!`)) : room?.draw ? "It’s a draw. Play another round?" : null;
  const invitedFriend = contacts.find((person) => String(person._id) === String(invite?.from));
  const matchingInvite = invite?.gameType === gameType;
  return <section className="mini-game-card online-game-card">
    <div className="mini-game-heading"><div><span className="eyebrow">LIVE · PLAY TOGETHER</span><h3>{gameType === "memory" ? "Memory match" : gameType === "snake" ? "Snake duel" : "Tic-tac-toe"}</h3><p>{room ? room.status === "waiting" ? "Invite sent — waiting for your friend to join…" : winnerText || (gameType === "snake" ? "Use arrow keys or the controls to steer your snake." : isMyTurn ? "Your turn" : "Waiting for your friend’s move…") : "Invite a connected friend and play from two devices."}</p></div>{room && <div className="mini-game-score">{gameType === "memory" || gameType === "snake" ? <><span>You <b>{room.scores?.[myIndex] || 0}{gameType === "memory" ? " pairs" : ""}</b></span><span>{opponentName} <b>{room.scores?.[myIndex === 0 ? 1 : 0] || 0}{gameType === "memory" ? " pairs" : ""}</b></span></> : <><span>You <b>{myMark || "—"}</b></span><span>{opponentName || invitedFriend?.fullName || "Friend"} <b>{myMark === "X" ? "O" : myMark === "O" ? "X" : "—"}</b></span></>}</div>}</div>
    {matchingInvite && <div className="game-invite-banner"><span>🎮</span><div><strong>{invitedFriend?.fullName || "Your friend"} challenged you</strong><small>Join their {gameType === "memory" ? "Memory match" : gameType === "snake" ? "Snake duel" : "Tic-tac-toe"} game</small></div><button onClick={() => join(invite.code)}>Join game</button></div>}
    {!room && <div className="game-lobby"><label>Challenge a friend<select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose from your circle</option>{contacts.filter((person) => person.connected || person.following).map((person) => <option key={person._id} value={person._id}>{person.fullName}</option>)}</select></label><button className="feature-primary" onClick={create}>Create game invite</button><div className="game-join-divider"><span>or join with a code</span></div><form onSubmit={(event) => { event.preventDefault(); join(); }}><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit game code" inputMode="numeric"/><button className="feature-primary" disabled={joinCode.length !== 6}>Join</button></form></div>}
    {room && <><div className="game-room-code"><span>ROOM CODE <b>{room.code}</b></span><button onClick={async () => { try { await navigator.clipboard.writeText(room.code); toast.success("Game code copied!"); } catch { toast.error("Couldn’t copy the code."); } }}>Copy code</button></div>{gameType === "memory" ? <div className="memory-match-board online-memory-board" aria-label="Online Memory match cards">{room.cards.map((symbol, index) => { const faceUp = room.flipped.includes(index) || room.matched.includes(index); const matched = room.matched.includes(index); return <button type="button" key={index} className={`memory-match-card-tile ${faceUp ? "face-up" : ""} ${matched ? "matched" : ""}`} onClick={() => flip(index)} disabled={!isMyTurn || room.status !== "playing" || Boolean(room.winner || room.draw) || room.flipped.length >= 2 || faceUp}>{faceUp ? symbol : "✦"}</button>; })}</div> : gameType === "snake" ? <><div className="snake-duel-board" role="img" aria-label="Snake duel board">{Array.from({ length: 320 }, (_, index) => { const x = index % 20; const y = Math.floor(index / 20); const playerOne = room.snakes?.[0]?.body.findIndex(([sx, sy]) => sx === x && sy === y) ?? -1; const playerTwo = room.snakes?.[1]?.body.findIndex(([sx, sy]) => sx === x && sy === y) ?? -1; const food = room.food?.[0] === x && room.food?.[1] === y; const segment = playerOne >= 0 ? `snake-p1 ${playerOne === 0 ? "snake-head" : ""}` : playerTwo >= 0 ? `snake-p2 ${playerTwo === 0 ? "snake-head" : ""}` : food ? "snake-food" : ""; return <span key={index} className={`snake-board-cell ${segment}`}>{food ? "●" : ""}</span>; })}</div><div className="snake-touch-controls"><button onClick={() => steer("up")} aria-label="Move up">▲</button><div><button onClick={() => steer("left")} aria-label="Move left">◀</button><button onClick={() => steer("down")} aria-label="Move down">▼</button><button onClick={() => steer("right")} aria-label="Move right">▶</button></div></div></> : <div className="tic-tac-toe-board" role="grid" aria-label="Online Tic-tac-toe board">{room.board.map((mark, index) => <button key={index} role="gridcell" aria-label={`Square ${index + 1}${mark ? `, ${mark}` : ""}`} className={`tic-tac-toe-cell ${mark === "X" ? "mark-x" : "mark-o"}`} disabled={Boolean(mark || !isMyTurn || room.status !== "playing" || room.winner || room.draw)} onClick={() => play(index)}>{mark}</button>)}</div>}<div className="online-game-actions">{winnerText && <button className="feature-primary" onClick={() => socketAPI.emit("game:reset", { code: room.code })}>Play again</button>}<button className="game-leave" onClick={leave}>Leave game</button></div></>}
    <small className="game-note">Only you and your connected friend can join this private game.</small>
  </section>;
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
