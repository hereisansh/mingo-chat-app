import { useCallback, useEffect, useRef, useState } from "react";
import { FiBookOpen, FiExternalLink, FiHeadphones, FiHeart, FiMessageCircle, FiMusic, FiPlus, FiSend, FiYoutube, FiTrash2, FiSearch, FiPlay, FiShuffle, FiArrowUpRight } from "react-icons/fi";
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
const reelCollections = {
  ForYou: { query: "trending viral shorts India", ids: ["dQw4w9WgXcQ", "9bZkp7q19f0", "jNQXAC9IVRw", "kJQP7kiw5Fk"] },
  Music: { query: "music viral shorts", ids: ["kJQP7kiw5Fk", "YQHsXMglC9A", "OPf0YbXqDm0"] },
  Laughs: { query: "funny comedy shorts", ids: ["9bZkp7q19f0", "L_jWHffIx5E", "jNQXAC9IVRw"] },
  Learn: { query: "interesting science facts shorts", ids: ["M7lc1UVf-VE", "jNQXAC9IVRw"] },
};

function Reels() {
  const [category, setCategory] = useState("ForYou");
  const [items, setItems] = useState(() => reelCollections.ForYou.ids.map((id) => ({ id, title: "A little something for you", channel: "YouTube" })));
  const [pageToken, setPageToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [likes, setLikes] = useState(() => { try { return JSON.parse(localStorage.getItem("mingo-reel-likes") || "[]"); } catch { return []; } });
  const [query, setQuery] = useState("");
  const fetchReels = useCallback(async (term, append = false, token = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/youtube/search", { params: { q: `${term} shorts`, kind: "reels", pageToken: token || undefined } });
      setItems((current) => append ? [...current, ...(data.data || [])] : (data.data || []));
      setPageToken(data.nextPageToken || ""); setSourceReady(true);
    } catch (error) {
      const isSetup = error.response?.status === 503;
      if (isSetup) { if (!append) setItems(reelCollections[category].ids.map((id) => ({ id, title: `${category} pick`, channel: "YouTube" }))); toast("The starter reel picks are ready. Add a YouTube API key to unlock live search and endless fresh picks.", { icon: "✨" }); }
      else toast.error(error.response?.data?.message || "Couldn’t load more reels.");
      setSourceReady(false);
    } finally { setLoading(false); }
  }, [category]);
  const toggleLike = (id) => setLikes((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem("mingo-reel-likes", JSON.stringify(next)); return next; });
  useEffect(() => { const timer = window.setTimeout(() => fetchReels(reelCollections[category].query), 0); return () => window.clearTimeout(timer); }, [category, fetchReels]);
  const changeCategory = (next) => { setCategory(next); setItems(reelCollections[next].ids.map((id) => ({ id, title: `${next} pick`, channel: "YouTube" }))); setPageToken(""); setQuery(""); };
  const loadMore = () => { if (sourceReady && pageToken) fetchReels(reelCollections[category].query, true, pageToken); else toast("Add a YouTube API key to keep discovering fresh clips.", { icon: "✨" }); };
  const discover = (event) => { event.preventDefault(); if (query.trim()) { setItems([]); setPageToken(""); fetchReels(query.trim()); } };
  return <div className="feature-page reels-page"><div className="feature-heading"><span className="feature-icon"><FiPlay /></span><div><span className="eyebrow">A LITTLE SCROLL BREAK</span><h2>Reels <span className="feature-live-pill">FOR YOU</span></h2><p>A ready-to-scroll mix of YouTube favorites. No link needed to start.</p></div><button className="reel-explore-button" onClick={() => window.open("https://www.youtube.com/shorts", "_blank", "noopener,noreferrer")}><FiArrowUpRight/> Explore Shorts</button></div>
    <div className="reel-discover-bar"><div className="reel-categories">{[["ForYou","For you"],["Music","Music"],["Laughs","Laughs"],["Learn","Learn"]].map(([id,label])=><button type="button" className={category===id?"selected":""} key={id} onClick={()=>changeCategory(id)}>{label}</button>)}</div><form onSubmit={discover}><FiSearch/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search clips and topics"/><button disabled={!query.trim() || loading}>Search</button></form></div>
    {!sourceReady && <div className="feature-alert reel-api-hint"><FiYoutube/> Starter clips play below. Add <code>YOUTUBE_API_KEY</code> to Render to turn on live Shorts discovery and endless scrolling.</div>}{loading && <div className="music-loading">Finding a fresh mix…</div>}<div className="reel-feed">{items.map((item, index) => <article className="reel-card" key={`${category}-${item.id}-${index}`}><iframe src={`https://www.youtube-nocookie.com/embed/${item.id}?playsinline=1&rel=0`} title={item.title || `YouTube clip ${index + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><div className="reel-side-actions"><button type="button" className={likes.includes(item.id)?"liked":""} onClick={()=>toggleLike(item.id)} aria-label="Like clip"><FiHeart/><span>{likes.includes(item.id)?"Liked":"Like"}</span></button><button type="button" onClick={()=>navigator.clipboard?.writeText(`https://youtu.be/${item.id}`).then(()=>toast.success("Clip link copied")).catch(()=>toast.error("Could not copy link."))} aria-label="Copy clip link"><FiExternalLink/><span>Share</span></button></div><div className="reel-caption"><strong>{item.title}</strong><span>{item.channel || "YouTube"} · scroll for the next clip</span></div></article>)}</div><button className="reel-more-button" onClick={loadMore} disabled={loading || !pageToken && sourceReady}><FiShuffle/> {loading ? "Loading…" : "Load more reels"}</button><div className="reel-feed-end">Scroll vertically or use the wheel to move between clips. Videos play inside Mingo when YouTube allows embedding.</div><p className="feature-footnote">Mingo embeds YouTube’s video player so playback remains on this site. YouTube controls content availability and may show ads.</p></div>;
}

function Study({ user }) {
  const key = `mingo-notes-${user?._id || "guest"}`;
  const [notes, setNotes] = useState([]);
  const [chat, setChat] = useState([{ role: "assistant", content: "Hi! I can explain a topic, make revision notes, or quiz you. What are you studying?" }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [aiAvailable, setAiAvailable] = useState(null);
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
      setMemoryEnabled(Boolean(settingsResult.data.data?.enabled)); setMemoryAiAvailable(Boolean(settingsResult.data.data?.aiAvailable));
      setMemoryItems(itemsResult.data.data || []); setMemoryReady(true);
    }).catch(() => { if (active) { setMemoryReady(true); toast.error("Couldn't load your private notes and memory."); } });
    return () => { active = false; };
  }, [key]);
  useEffect(() => { api.get("/study/status").then(({ data }) => setAiAvailable(Boolean(data.data?.enabled))).catch(() => setAiAvailable(null)); }, []);
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
      {memoryEnabled && !memoryAiAvailable && <div className="memory-privacy-note">Semantic search needs the server’s OpenAI key. Until it is configured, Mingo uses a simple keyword search and shows the matching saved details.</div>}{memoryEnabled && memoryAiAvailable && <div className="memory-privacy-note">With AI search on, your question and matching saved text are sent to the AI service configured for this app. API usage may incur charges.</div>}
      {memoryAnswer && <article className="memory-answer"><div className="memory-answer-label">{memoryAnswer.answeredBy === "ai" ? "MINGO MEMORY · AI ANSWER" : `MINGO MEMORY · ${memoryAnswer.method === "semantic" ? "SEMANTIC SEARCH" : "MATCHING DETAILS"}`}</div><p>{memoryAnswer.answer}</p>{memoryAnswer.sources?.length > 0 && <div className="memory-citations">{memoryAnswer.sources.map((source) => <div key={`${source.sourceType}-${source.sourceId}`}><strong>{source.title}</strong><span>{source.sourceType === "note" ? "Study note" : "Saved chat message"} · {new Date(source.createdAt).toLocaleDateString()}</span><p>{source.snippet}</p></div>)}</div>}</article>}
      {memoryEnabled && <div className="memory-tools"><button type="button" className="memory-compare-button" onClick={compareSearch} disabled={!memoryQuestion.trim()}>Compare keyword vs semantic results</button>{comparison && <div className="memory-comparison"><div><strong>Semantic</strong>{comparison.semantic?.length ? comparison.semantic.map((item, index) => <span key={`${item.title}-${index}`}>{index + 1}. {item.title}</span>) : <span>{comparison.semanticAvailable ? "No matching result" : "Add OPENAI_API_KEY to enable embeddings"}</span>}</div><div><strong>Keyword</strong>{comparison.keyword.map((item, index) => <span key={`${item.title}-${index}`}>{index + 1}. {item.title}</span>)}</div></div>}</div>}
      {memoryEnabled && memoryItems.length > 0 && <div className="memory-saved-list"><strong>Your saved chat memories</strong>{memoryItems.map((item) => <article key={item._id}><div><span>{item.text}</span><small>{new Date(item.createdAt).toLocaleDateString()}</small></div><button type="button" onClick={() => removeMemory(item)} title="Remove memory"><FiTrash2/></button></article>)}</div>}
    </section>
    {aiAvailable === false && <div className="ai-setup-banner"><div><strong>One quick setup step to turn on Study Buddy</strong><span>Add your OpenAI API key to the server’s Render environment. Keep the key private; don’t paste it into chat or the app.</span></div><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Get API key ↗</a></div>}{aiAvailable === true && <div className="ai-ready-banner">Study Buddy is connected. Ask away ✨</div>}
    <div className="study-layout"><section className="study-chat"><div className="study-chat-title"><FiMessageCircle/> Study Buddy <span>{aiAvailable === true ? "AI ready" : aiAvailable === false ? "Needs API" : "…"}</span></div><div className="study-suggestions"><span>Try:</span>{["Explain my notes simply", "Make revision notes from my notes", "Quiz me from my notes"].map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div><div className="study-messages">{chat.map((item, index) => <div key={index} className={`study-message ${item.role}`}>{item.content}</div>)}{busy && <div className="study-message assistant study-thinking"><i/><i/><i/> Thinking through it…</div>}</div><form className="study-compose" onSubmit={ask}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a topic or your saved notes…" maxLength={4000}/><button disabled={busy || !draft.trim()} aria-label="Send question"><FiSend/></button></form></section><section className="notes-panel"><div className="study-chat-title"><FiBookOpen/> My notes <span>{notes.length}</span></div><p className="notes-ai-hint">Study Buddy can use your saved notes when you ask it a question.</p><input className="memory-note-title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title, e.g. Biology revision" maxLength={120}/><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write or paste a note to keep…" maxLength={5000}/><button className="feature-primary" onClick={saveNote}><FiPlus/> Save private note</button><div className="saved-notes">{notes.map((note) => <article key={note._id}><time>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</time><strong>{note.title}</strong><p>{note.text}</p><button onClick={() => removeNote(note)}>Delete</button></article>)}</div></section></div><p className="feature-footnote">Your study notes are private to your account and are sent only when you ask Study Buddy for help. AI responses can be wrong; check important facts.</p></div>;
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

let youtubeApiPromise;
const loadYoutubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) { const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(script); }
  });
  return youtubeApiPromise;
};

function YoutubeMusicPlayer({ videoId, playerRef, onPlayerState, onPlayerReady }) {
  const hostRef = useRef(null);
  const stateCallback = useRef(onPlayerState); const readyCallback = useRef(onPlayerReady);
  useEffect(() => { stateCallback.current = onPlayerState; readyCallback.current = onPlayerReady; }, [onPlayerState, onPlayerReady]);
  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;
    let alive = true; let player;
    loadYoutubeApi().then((YT) => {
      if (!alive || !hostRef.current) return;
      player = new YT.Player(hostRef.current, { width: "100%", height: "100%", videoId, playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin }, events: {
        onReady: (event) => { playerRef.current = event.target; readyCallback.current(event.target); },
        onStateChange: (event) => stateCallback.current(event.data, event.target),
      } });
    }).catch(() => {});
    return () => { alive = false; playerRef.current = null; player?.destroy(); };
  }, [videoId, playerRef]);
  return <div className="youtube-music-player"><div ref={hostRef} /></div>;
}

function MusicRoom({ contacts, user, selected }) {
  const peer = selected || contacts[0];
  const categories = ["top hits", "bollywood full songs", "punjabi songs", "pop hits", "hip hop", "rock classics", "lofi beats", "classical music", "jazz", "latin pop"];
  const storageKey = `mingo-music-room-${user?._id || "guest"}`; const trackStorageKey = `${storageKey}-track`;
  const [term, setTerm] = useState("top hits"); const [tracks, setTracks] = useState([]); const [track, setTrack] = useState(() => { try { return JSON.parse(localStorage.getItem(trackStorageKey) || "null"); } catch { return null; } }); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("Search YouTube Music videos and play the full video inside Mingo.");
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem(storageKey) || ""); const [joinCode, setJoinCode] = useState(""); const [roomCount, setRoomCount] = useState(0);
  const playerRef = useRef(null); const roomRef = useRef(roomCode); const joinCodeRef = useRef(""); const suppressSyncRef = useRef(false); const pendingPlaybackRef = useRef(null);
  useEffect(() => { roomRef.current = roomCode; }, [roomCode]);
  const search = useCallback(async (query) => {
    setBusy(true);
    try {
      const { data } = await api.get("/youtube/search", { params: { q: `${query} full song` } });
      const found = (data.data || []).map((item) => ({ id: item.id, videoId: item.id, title: item.title, artist: item.channel, artwork: item.artwork, genre: "YouTube", link: `https://www.youtube.com/watch?v=${item.id}` }));
      setTracks(found); setStatus(found.length ? `Found ${found.length} full videos for “${query}”.` : `No videos found for “${query}”. Try another search.`);
    } catch (error) { setTracks([]); setStatus(error.response?.data?.message || "Music search is unavailable. Try again."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => search("top hits"), 0); return () => window.clearTimeout(timer); }, [search]);
  const applyRoomEvent = useCallback((event) => {
    suppressSyncRef.current = true; window.setTimeout(() => { suppressSyncRef.current = false; }, 1200);
    if (event.action === "load" && event.track) {
      setTrack(event.track); localStorage.setItem(trackStorageKey, JSON.stringify(event.track)); pendingPlaybackRef.current = event;
      if (playerRef.current && event.track.videoId) { playerRef.current.cueVideoById(event.track.videoId); pendingPlaybackRef.current = null; }
      setStatus("Your listening partner picked a song. Press play when you’re ready."); return;
    }
    const player = playerRef.current;
    if (!player) { pendingPlaybackRef.current = event; return; }
    if (Number.isFinite(event.time)) player.seekTo(event.time, true);
    if (event.action === "play") player.playVideo();
    if (event.action === "pause") player.pauseVideo();
    if (event.action === "seek") player.seekTo(event.time || 0, true);
  }, [trackStorageKey]);
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
  const chooseTrack = (item) => { setTrack(item); localStorage.setItem(trackStorageKey, JSON.stringify(item)); setStatus(`Ready to play ${item.title} in Mingo.`); if (playerRef.current) playerRef.current.loadVideoById(item.videoId); sendRoomEvent({ action: "load", track: item }); };
  const joinRoom = (event) => { event.preventDefault(); const code = joinCode.replace(/\D/g, "").slice(0, 6); if (code.length !== 6) return toast.error("Enter the 6-digit room code."); joinWithCode(code); };
  const createRoom = () => { if (!socketAPI.connected) return toast.error("Mingo is reconnecting. Please wait a moment and try again."); socketAPI.emit("music-room:create", (result) => {
    if (!result?.success) return toast.error("Couldn’t create a listening room. Check your connection and retry.");
    roomRef.current = result.code; setRoomCode(result.code); localStorage.setItem(storageKey, result.code); setRoomCount(result.count); setStatus("Room created and saved on this device. Share the code with your friend.");
    if (track) socketAPI.emit("music-room:sync", { code: result.code, action: "load", track });
    toast.success("Your room code is ready and saved.");
  }); };
  const copyCode = async () => { try { await navigator.clipboard.writeText(roomCode); toast.success("Room code copied. You can switch to chat and come back later."); } catch { toast.error("Copy didn’t work. Select and copy the code."); } };
  const leaveRoom = () => { socketAPI.emit("music-room:leave", { code: roomCode }); roomRef.current = ""; setRoomCode(""); setRoomCount(0); localStorage.removeItem(storageKey); toast("You left the listening room.", { icon: "🌙" }); };
  const playerReady = (player) => { const pending = pendingPlaybackRef.current; if (!pending) return; pendingPlaybackRef.current = null; if (pending.action === "load" && pending.track?.videoId) player.cueVideoById(pending.track.videoId); else applyRoomEvent(pending); };
  const playerState = (state, player) => {
    if (suppressSyncRef.current || !roomRef.current) return;
    if (state === window.YT?.PlayerState?.PLAYING) sendRoomEvent({ action: "play", time: player.getCurrentTime() });
    if (state === window.YT?.PlayerState?.PAUSED) sendRoomEvent({ action: "pause", time: player.getCurrentTime() });
  };
  return <div className="feature-page music-page"><div className="feature-heading"><span className="feature-icon"><FiHeadphones /></span><div><span className="eyebrow">SAME SONG, DIFFERENT PLACES</span><h2>Music room <span className="feature-live-pill">TOGETHER</span></h2><p>Search and play full YouTube videos inside Mingo{peer ? ` · listening with ${peer.fullName}` : ""}.</p></div></div>
    <section className="listening-room-card"><div><span className="eyebrow">PRIVATE LISTENING ROOM</span><strong>{roomCode ? `Room ${roomCode}` : "Make a room for two"}</strong><small>{roomCode ? `${roomCount || 1} listener${roomCount === 1 ? "" : "s"} connected · code is saved if you switch tabs` : "Create a 6-digit code or enter a friend’s code to join."}</small></div>{roomCode ? <div className="listening-room-code"><code>{roomCode}</code><button type="button" onClick={copyCode}>Copy code</button><button type="button" onClick={leaveRoom}>Leave</button></div> : <div className="listening-room-actions"><button type="button" className="feature-primary" onClick={createRoom}>Create a room code</button><form onSubmit={joinRoom}><input aria-label="Listening room code" inputMode="numeric" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code"/><button type="submit">Join room</button></form></div>}</section>
    <div className="music-search-controls"><form onSubmit={(event) => { event.preventDefault(); search(term.trim()); }}><FiSearch/><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search songs, artists, or moods"/><button disabled={busy || !term.trim()}>{busy ? "Searching…" : "Search music"}</button></form><div className="music-genre-chips">{categories.map((genre) => <button type="button" key={genre} className={term.toLowerCase() === genre ? "active" : ""} onClick={() => { setTerm(genre); search(genre); }}>{genre}</button>)}</div></div>
    <div className="music-library-heading"><div><span className="eyebrow">MUSIC BROWSER · FULL-LENGTH VIDEOS</span><h3>{term || "Explore music"}</h3></div><span>{tracks.length} videos</span></div>
    <div className="music-track-grid">{tracks.map((item) => <article className={`music-track-card ${track?.id === item.id ? "active" : ""}`} key={item.id}><button type="button" className="music-track-pick" onClick={() => chooseTrack(item)}><img src={item.artwork} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small><em>Play inside Mingo</em></span><FiPlay/></button></article>)}</div>{busy && <div className="music-loading">Searching YouTube…</div>}{!busy && !tracks.length && <div className="music-empty-results">{status}</div>}
    <section className="shared-audio-card"><div className="shared-audio-heading"><img src={track?.artwork || ""} alt=""/><div><span className="eyebrow">NOW PLAYING IN YOUR ROOM</span><strong>{track?.title || "Choose a full song to play"}</strong><small>{track?.artist || status}</small></div></div>{track?.videoId ? <YoutubeMusicPlayer key={track.videoId} videoId={track.videoId} playerRef={playerRef} onPlayerState={playerState} onPlayerReady={playerReady}/> : <div className="music-player-placeholder"><span>✦</span><strong>Your next song is waiting</strong><small>Search above to browse full-length music videos.</small></div>}<p>Full playback runs in YouTube’s embedded player here. Playback availability and ads are controlled by YouTube.</p></section>
    <p className="feature-footnote">YouTube search needs a private <code>YOUTUBE_API_KEY</code> server setting. Room codes and the selected song are saved on this device, so changing tabs or refreshing won’t erase them. Your partner can join from their own device with the same code.</p></div>;
}

export default function FeatureHub({ tab, user, contacts, selected }) {
  if (tab === "reels") return <Reels/>;
  if (tab === "study") return <Study user={user}/>;
  if (tab === "stories") return <Stories user={user} selected={selected}/>;
  return <MusicRoom contacts={contacts} user={user} selected={selected}/>;
}
