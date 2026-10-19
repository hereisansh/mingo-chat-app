import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiSearch, FiPlus, FiSend, FiPaperclip, FiSmile, FiMoreVertical, FiPhone, FiVideo, FiMessageCircle, FiLogOut, FiPhoneOff, FiMic, FiMicOff, FiVideoOff, FiBookOpen, FiHeart, FiMusic, FiBookmark, FiCopy, FiX, FiUserPlus, FiUserCheck, FiGrid, FiUsers } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import api, { backendUrl, assetUrl } from "../config/api";
import socketAPI from "../config/webSocket";
import toast from "react-hot-toast";
import useCalls from "../hooks/useCalls";
import FeatureHub from "../components/FeatureHub";
import ThemePicker from "../components/ThemePicker";
import NotificationCenter from "../components/NotificationCenter";

const initials = (name = "?") => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const palette = ["#e9b4a8", "#a9c4b8", "#c5b3d8", "#e7cf9d", "#9eb9d0"];
const stamp = (date) => date ? new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const relativeTime = (date) => {
  if (!date) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(date).toLocaleDateString();
};
const presenceText = (person) => person.online ? "online" : person.lastSeen ? `last seen ${relativeTime(person.lastSeen)}` : "offline";

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, setIsLogin } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [savedMemories, setSavedMemories] = useState(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [mobileList, setMobileList] = useState(!location.state?.conversation && !location.state?.featureTab);
  const [activeTab, setActiveTab] = useState(location.state?.featureTab || "chats");
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const { call, incomingCall, localStream, remoteStream, muted, cameraOff, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera } = useCalls(contacts);

  useEffect(() => {
    const handleBrowserBack = () => {
      const routeState = window.history.state?.usr;
      if (window.location.pathname === "/chat" && !routeState?.conversation) setMobileList(true);
    };
    window.addEventListener("popstate", handleBrowserBack);
    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, []);

  useEffect(() => {
    if (!inviteOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setInviteOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [inviteOpen]);

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return undefined; }
    api.get("/memory/settings").then(({ data }) => setMemoryEnabled(Boolean(data.data?.enabled))).catch(() => {});
    api.get("/memory/items").then(({ data }) => {
      const savedIds = (data.data || []).filter((item) => item.sourceType === "message").map((item) => String(item.sourceId));
      setSavedMemories(new Set(savedIds));
    }).catch(() => {});
    api.get("/user/allusers").then(({ data }) => {
      const people = data.data || [];
      setContacts(people);
      if (people.length) setSelected((current) => current || people[0]);
    }).catch((error) => toast.error(error.response?.data?.message || "Couldn't reach the server. Check your connection and try again."))
      .finally(() => setLoading(false));
    api.get("/groups").then(({ data }) => { const found = data.data || []; setGroups(found); found.forEach((group) => socketAPI.emit("group:join", { groupId: group._id })); }).catch(() => {});
    const onGroupCreated = (group) => {
      setGroups((current) => current.some((item) => String(item._id) === String(group._id)) ? current : [group, ...current]);
      socketAPI.emit("group:join", { groupId: group._id });
    };
    const onGroupMessage = (message) => setGroups((current) => current.map((group) => String(group._id) === String(message.groupId) ? { ...group, lastMessage: message } : group));
    socketAPI.on("group:created", onGroupCreated);
    socketAPI.on("group:message", onGroupMessage);
    const refreshPeople = () => api.get("/user/allusers").then(({ data }) => {
      const people = data.data || []; const friendIds = new Set(people.map((person) => String(person._id)));
      setContacts(people); setSearchResults((results) => results.filter((person) => !friendIds.has(String(person._id))));
    }).catch(() => {});
    window.addEventListener("mingo:people-changed", refreshPeople);
    const joinRoom = () => socketAPI.emit("OmBhramyaNamah", user._id);
    const updatePresence = ({ userId, online, lastSeen }) => {
      const presence = { online, lastSeen: lastSeen || null };
      setContacts((people) => people.map((person) => String(person._id) === String(userId) ? { ...person, ...presence } : person));
      setSelected((person) => person && String(person._id) === String(userId) ? { ...person, ...presence } : person);
    };
    socketAPI.on("connect", joinRoom);
    socketAPI.on("presence:update", updatePresence);
    if (socketAPI.connected) joinRoom();
    return () => { window.removeEventListener("mingo:people-changed", refreshPeople); socketAPI.off("connect", joinRoom); socketAPI.off("presence:update", updatePresence); socketAPI.off("group:created", onGroupCreated); socketAPI.off("group:message", onGroupMessage); socketAPI.emit("OmNamahShivay", user._id); };
  }, [user, navigate]);

  useEffect(() => {
    if (!selected?._id) return undefined;
    let active = true;
    if (selected.isGroup) {
      const joinGroup = () => socketAPI.emit("group:join", { groupId: selected._id });
      joinGroup(); socketAPI.on("connect", joinGroup);
      api.get(`/groups/${selected._id}/messages`).then(({ data }) => { if (active) setMessages(data.data || []); }).catch(() => toast.error("Couldn't load this group chat."));
      const receiveGroup = (message) => { if (String(message.groupId) === String(selected._id)) setMessages((current) => current.some((item) => String(item._id) === String(message._id)) ? current : [...current, message]); };
      socketAPI.on("group:message", receiveGroup);
      return () => { active = false; socketAPI.off("connect", joinGroup); socketAPI.off("group:message", receiveGroup); };
    }
    api.get(`/user/get-messages/${selected._id}`).then(({ data }) => { if (active) { setMessages(data.data || []); if (socketAPI.connected) socketAPI.emit("messages:read", { peerId: selected._id }); } })
      .catch(() => toast.error("Couldn't load this conversation."));
    const receive = (message) => {
      if ([String(message.senderId), String(message.receiverId)].includes(String(selected._id)) &&
          [String(message.senderId), String(message.receiverId)].includes(String(user?._id))) {
        setMessages((current) => current.some((item) => String(item._id) === String(message._id)) ? current : [...current, message]);
        if (String(message.senderId) === String(selected._id) && socketAPI.connected) socketAPI.emit("messages:read", { peerId: selected._id });
      }
      setContacts((people) => [...people].sort((a, b) => (String(a._id) === String(message.senderId) ? -1 : 0) - (String(b._id) === String(message.senderId) ? -1 : 0)));
    };
    const markRead = ({ readerId, messageIds, readAt }) => {
      if (String(readerId) !== String(selected._id)) return;
      const readIds = new Set((messageIds || []).map(String));
      setMessages((current) => current.map((item) => readIds.has(String(item._id)) ? { ...item, readAt } : item));
    };
    socketAPI.on("receive", receive);
    socketAPI.on("messages:read", markRead);
    return () => { active = false; socketAPI.off("receive", receive); socketAPI.off("messages:read", markRead); };
  }, [selected, user?._id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [remoteStream, localStream, call?.type]);
  const visibleContacts = useMemo(() => contacts.filter((person) => person.fullName?.toLowerCase().includes(query.toLowerCase()) || person.email?.toLowerCase().includes(query.toLowerCase())), [contacts, query]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchingPeople(true);
      api.get("/user/search", { params: { q: term } }).then(({ data }) => { if (active) setSearchResults(data.data || []); })
        .catch(() => { if (active) setSearchResults([]); })
        .finally(() => { if (active) setSearchingPeople(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const sendMessage = async (event) => {
    event?.preventDefault();
    if (!draft.trim() || !selected || sending) return;
    setSending(true);
    try {
      const { data } = selected.isGroup
        ? await api.post(`/groups/${selected._id}/messages`, { message: draft.trim() })
        : await api.post("/user/send-message", { receiverID: selected._id, message: draft.trim() });
      const saved = data.data;
      setMessages((current) => [...current, saved]);
      if (socketAPI.connected) socketAPI.emit(selected.isGroup ? "group:send" : "send", selected.isGroup ? { messageId: saved._id } : saved);
      setDraft("");
    } catch (error) { toast.error(error.response?.data?.message || "Message couldn't be sent."); }
    finally { setSending(false); }
  };

  const sendMedia = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected || selected.isGroup) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return toast.error("Choose an image or video.");
    const form = new FormData(); form.append("media", file); form.append("receiverID", selected._id);
    try {
      const { data } = await api.post("/user/send-media", form);
      setMessages((current) => [...current, data.data]);
      if (socketAPI.connected) socketAPI.emit("send", data.data);
    } catch (error) { toast.error(error.response?.data?.message || "Media couldn't be sent."); }
  };
  const rememberMessage = async (message) => {
    try {
      await api.post("/memory/items", { sourceId: message._id, text: message.message, title: `Chat with ${selected?.fullName || "your person"}` });
      setSavedMemories((current) => new Set(current).add(String(message._id)));
      toast.success("Saved to your private Mingo Memory.");
    } catch (error) { toast.error(error.response?.data?.message || "Couldn't save that memory."); }
  };

  const logout = () => { sessionStorage.removeItem("AppUser"); setUser(null); setIsLogin(false); navigate("/login", { replace: true }); };
  const openContact = (person) => {
    navigate("/chat", { state: { conversation: String(person._id) }, replace: Boolean(location.state?.conversation) });
    setSelected(person);
    setActiveTab("chats");
    setMobileList(false);
  };
  const openGroup = (group) => { const conversation = { ...group, isGroup: true }; setSelected(conversation); navigate("/chat", { state: { conversation: String(group._id) }, replace: Boolean(location.state?.conversation) }); setActiveTab("chats"); setMobileList(false); };
  const createGroup = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || groupMembers.length < 2) return toast.error("Add a name and choose at least two friends.");
    try { const { data } = await api.post("/groups", { name: groupName.trim(), memberIds: groupMembers }); setGroups((current) => [data.data, ...current]); setGroupName(""); setGroupMembers([]); setGroupOpen(false); openGroup(data.data); toast.success("Your group chat is ready."); }
    catch (error) { toast.error(error.response?.data?.message || "Could not create that group."); }
  };
  const backToPeople = () => {
    setMobileList(true);
    if (location.state?.conversation) navigate("/chat", { replace: true, state: null });
  };
  const toggleFollow = async (person) => {
    const wasFollowing = Boolean(person.following); const wasRequested = Boolean(person.followRequested);
    try {
      let following = wasFollowing; let followRequested = false;
      if (wasFollowing || wasRequested) await api.delete(`/user/follow/${person._id}`);
      else { const { data } = await api.post(`/user/follow/${person._id}`); following = Boolean(data.data?.following); followRequested = Boolean(data.data?.requested); }
      const update = (item) => String(item._id) === String(person._id) ? { ...item, following, followRequested, followersCount: Math.max(0, (item.followersCount || 0) + (following !== wasFollowing ? (following ? 1 : -1) : 0)) } : item;
      setContacts((people) => people.map(update)); setSelected((current) => current ? update(current) : current);
      setSearchResults((people) => people.map((item) => String(item._id) === String(person._id) ? { ...item, followRequested } : item));
      toast.success(followRequested ? `Follow request sent to ${person.fullName}` : following ? `Following ${person.fullName}` : wasRequested ? "Follow request cancelled." : "Unfollowed.");
    } catch (error) { toast.error(error.response?.data?.message || "Couldn't update your circle."); }
  };

  return <main className="messenger-shell">
    <aside className={`people-panel ${!mobileList ? "mobile-hidden" : ""}`}>
      <div className="brand-row"><div className="brand-mark">m<span>✦</span></div><div><div className="brand-name">mingo</div><div className="brand-tagline">a little closer, always</div></div><ThemePicker compact/><NotificationCenter contacts={contacts} onOpenPerson={openContact}/><button className="icon-button logout-button" onClick={logout} title="Sign out"><FiLogOut /></button></div>
      <nav className="feature-nav" aria-label="Mingo features">{[["chats", <FiMessageCircle/>, "Chats"], ["reels", <span className="nav-reels-icon">▶</span>, "Reels"], ["study", <FiBookOpen/>, "Study"], ["stories", <FiHeart/>, "Stories"], ["music", <FiMusic/>, "Music"], ["games", <FiGrid/>, "Games"]].map(([tab, icon, label]) => <button key={tab} className={activeTab === tab ? "feature-nav-active" : ""} onClick={() => { setActiveTab(tab); setMobileList(false); }} title={label}>{icon}<span>{label}</span></button>)}</nav>
      <button className="profile-strip" onClick={() => navigate("/dashboard")}><div className="avatar avatar-self">{user?.avatar ? <img src={assetUrl(user.avatar)} alt=""/> : initials(user?.fullName)}</div><div className="profile-copy"><strong>{user?.fullName || "Your profile"}</strong><span><i className="online-dot" /> Your space, your people</span></div><span className="profile-open-hint">Profile ↗</span></button>
      <div className="list-heading"><div><span className="eyebrow">YOUR CIRCLE</span><h1>Messages <span>{contacts.length + groups.length}</span></h1></div><div className="new-chat-actions"><button className="new-chat" onClick={() => setGroupOpen(true)} title="Create a group chat"><FiUsers /></button><button className="new-chat" onClick={() => setInviteOpen(true)} title="Invite your person"><FiPlus /></button></div></div>
      <label className="search-box"><FiSearch /><input className="search-input" placeholder="Search friends or find someone new…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
      <div className="chat-list">{loading ? <div className="list-empty">Finding your people…</div> : <>{groups.map((group) => <button key={group._id} className={`person-row ${selected?.isGroup && String(selected._id) === String(group._id) ? "person-active" : ""}`} onClick={() => openGroup(group)}><div className="avatar person-avatar group-avatar"><FiUsers/></div><div className="person-copy"><div className="person-name-line"><strong>{group.name}</strong><time>{stamp(group.lastMessage?.createdAt)}</time></div><div className="person-preview">{group.lastMessage?.message || `${group.members?.length || 0} members · start chatting`}</div></div><span className="group-member-count">{group.members?.length || 0}</span></button>)}{visibleContacts.length ? visibleContacts.map((person, index) => {
        const active = String(selected?._id) === String(person._id);
        const last = person.lastMessage;
        return <div className="person-row-wrap" key={person._id}><button className={`person-row ${active ? "person-active" : ""}`} onClick={() => openContact(person)}>
          <div className="avatar person-avatar" style={{ "--avatar-color": palette[index % palette.length] }}>{person.avatar ? <img src={assetUrl(person.avatar)} alt="" /> : initials(person.fullName)}</div>
          <div className="person-copy"><div className="person-name-line"><strong>{person.fullName}</strong><time>{stamp(last?.createdAt)}</time></div><div className="person-preview">{last?.message || "Say hello and start a conversation ✨"}</div></div>
          <span className={`person-last-seen ${person.online ? "presence-online" : ""}`}>{presenceText(person)}</span>
          {person.online && <i className="person-online" />}
        </button><button type="button" className={`person-follow ${person.connected || person.following || person.followRequested ? "is-following" : ""}`} disabled={person.connected} title={person.connected ? "Connected — you can chat" : person.following ? "Unfollow" : person.followRequested ? "Cancel follow request" : "Send follow request"} aria-label={`${person.connected ? "Connected to" : person.following ? "Unfollow" : person.followRequested ? "Cancel request to" : "Request to follow"} ${person.fullName}`} onClick={() => toggleFollow(person)}>{person.connected || person.following || person.followRequested ? <FiUserCheck/> : <FiUserPlus/>}<span>{person.connected ? "Friends" : person.following ? "Following" : person.followRequested ? "Requested" : "Follow"}</span></button></div>;
      }) : !groups.length && <div className="list-empty">{contacts.length ? "No connected friends match yet." : "Your chats are private. Search for your person above, send a follow request, and chat after they accept."}</div>}</>}</div>
      {query.trim().length >= 2 && <section className="people-search-results"><div className="search-results-heading"><strong>Find people</strong><span>{searchingPeople ? "Searching…" : `${searchResults.length} results`}</span></div>{searchResults.length ? searchResults.map((person) => <article className="directory-person" key={person._id}><div className="avatar directory-avatar">{person.avatar ? <img src={assetUrl(person.avatar)} alt=""/> : initials(person.fullName)}</div><div className="directory-copy"><strong>{person.fullName}</strong><small>{person.requestReceived ? "Sent you a request · check your bell" : person.followRequested ? "Request sent · waiting for them" : "Not in your circle yet"}</small></div><button type="button" disabled={person.followRequested || person.requestReceived} onClick={() => toggleFollow({ ...person, following: false })}>{person.requestReceived ? "Check bell" : person.followRequested ? "Requested" : <><FiUserPlus/> Add</>}</button></article>) : !searchingPeople && <p className="search-results-empty">No new people found. Try another name.</p>}</section>}
      <div className="sidebar-note"><div className="note-icon">♡</div><div><strong>Your favorite people</strong><span>All the little moments, in one place.</span></div></div>
      <div className="sidebar-footer"><span>MADE FOR YOUR EVERYDAY</span><span>♡ &nbsp; mingo</span></div>
    </aside>

    <section className={`conversation-panel ${mobileList ? "mobile-hidden" : ""}`}>
      {activeTab !== "chats" ? <><button className="feature-mobile-back" onClick={backToPeople}>‹ <span>Back to Mingo</span></button><FeatureHub tab={activeTab} user={user} contacts={contacts} selected={selected}/></> : selected ? <>
        <header className="conversation-header"><button className="back-button" onClick={backToPeople}>‹</button><div className="avatar header-avatar" style={{ "--avatar-color": palette[Math.max(0, contacts.indexOf(selected)) % palette.length] }}>{selected.isGroup ? <FiUsers/> : selected.avatar ? <img src={assetUrl(selected.avatar)} alt=""/> : initials(selected.fullName)}</div><div className="header-person"><strong>{selected.isGroup ? selected.name : selected.fullName}</strong><span>{selected.isGroup ? `${selected.members?.length || 0} members` : selected.online ? <><i className="online-dot" /> online</> : presenceText(selected)}</span></div><div className="header-actions">{!selected.isGroup && <><button className="icon-button" title="Voice call" disabled={!!call} onClick={() => startCall(selected, "audio")}><FiPhone /></button><button className="icon-button" title="Video call" disabled={!!call} onClick={() => startCall(selected, "video")}><FiVideo /></button></>}<span className="header-divider" /><button className="icon-button" title="Conversation options"><FiMoreVertical /></button></div></header>
        <div className="conversation-scroll" ref={scrollRef}>
          <div className="chat-date"><span /> <small>YOUR LITTLE CORNER OF THE INTERNET</small> <span /></div>
          <div className="welcome-card"><div className="welcome-sparkle">✳</div><div className="welcome-title">A good day to say hi.</div><p>{selected.isGroup ? `This is the beginning of ${selected.name}.` : `This is the beginning of your story with ${selected.fullName.split(" ")[0]}.`}</p><div className="welcome-reaction">♡ &nbsp; make it a lovely one</div></div>
          {messages.map((message, index) => {
            const own = String(message.senderId?._id || message.senderId) === String(user?._id);
            const mediaUrl = message.mediaUrl ? `${backendUrl}${message.mediaUrl}` : "";
            return <div className={`message-line ${own ? "message-own" : "message-theirs"}`} key={message._id || `${message.createdAt}-${index}`}><div className={`message-bubble ${own ? "bubble-own" : "bubble-theirs"}`}>
              {selected.isGroup && !own && <small className="group-sender-name">{selected.members?.find((member) => String(member._id) === String(message.senderId))?.fullName || "Group member"}</small>}
              {message.mediaType?.startsWith("image") && <a href={mediaUrl} target="_blank" rel="noreferrer"><img className="message-image" src={mediaUrl} alt={message.fileName || "Shared photo"} /></a>}
              {message.mediaType?.startsWith("video") && <video className="message-video" src={mediaUrl} controls />}
              {message.message && <div>{message.message}</div>}
              {own && message.message && memoryEnabled && <button type="button" className={`remember-message ${savedMemories.has(String(message._id)) ? "remembered" : ""}`} onClick={() => !savedMemories.has(String(message._id)) && rememberMessage(message)} title={savedMemories.has(String(message._id)) ? "Saved to your private memory" : "Save this message to your private Mingo Memory"}><FiBookmark/>{savedMemories.has(String(message._id)) ? "Saved" : "Remember"}</button>}
              <time>{stamp(message.createdAt || message.updatedAt)} {own && <span className={`read-ticks ${message.readAt ? "is-read" : ""}`} aria-label={message.readAt ? "Read" : "Sent"}>{message.readAt ? "✓✓" : "✓"}</span>}</time>
            </div></div>;
          })}
        </div>
        <div className="composer-wrap"><div className="composer-hint"><span>♡</span> {selected.isGroup ? `Say something to ${selected.name}.` : "Tell them something nice today."}</div><form className="composer" onSubmit={sendMessage}>{!selected.isGroup && <><button className="composer-tool" type="button" onClick={() => fileRef.current?.click()} title="Share photo or video"><FiPaperclip /></button><input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={sendMedia} /></>}<input className="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selected.isGroup ? selected.name : selected.fullName.split(" ")[0]}...`} /><button className="composer-tool emoji-button" type="button" title="A little joy" onClick={() => setDraft((text) => `${text}♡`)}><FiSmile /></button><button className="send-button" disabled={!draft.trim() || sending} type="submit"><FiSend /><span>Send</span></button></form><div className="composer-footnote">Press <kbd>Enter</kbd> to send <span>·</span> {selected.isGroup ? "Group messages are shared with members" : "Messages are just between you two"}</div></div>
      </> : <div className="empty-conversation"><div className="empty-heart">♡</div><h2>Your people, your place.</h2><p>Pick a conversation on the left and let the good chats begin.</p><div className="empty-badge"><FiMessageCircle /> a little closer, always</div></div>}
    </section>
    {incomingCall && <div className="call-backdrop"><section className="call-dialog" role="dialog" aria-modal="true" aria-label="Incoming call"><div className="call-dialog-mark">{incomingCall.callType === "video" ? <FiVideo /> : <FiPhone />}</div><span className="call-kicker">INCOMING {incomingCall.callType === "video" ? "VIDEO" : "VOICE"} CALL</span><h2>{incomingCall.peerName}</h2><p>is calling you</p><div className="call-dialog-actions"><button className="call-end-button" onClick={declineCall} aria-label="Decline call"><FiPhoneOff /></button><button className="call-answer-button" onClick={acceptCall} aria-label="Answer call"><FiPhone /></button></div><small>Make sure your microphone or camera permission is allowed.</small></section></div>}
    {call && <div className="call-backdrop"><section className={`call-window ${call.type === "video" ? "call-window-video" : ""}`} aria-label={`${call.type} call`}>
      {call.type === "video" ? <div className="call-video-stage"><video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline /><video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />{!remoteStream && <div className="call-video-waiting"><div className="call-dialog-mark"><FiVideo /></div><strong>{call.peerName}</strong><span>{call.status === "calling" ? "Calling…" : "Connecting video…"}</span></div>}</div> : <div className="call-audio-stage"><div className="call-dialog-mark"><FiPhone /></div><h2>{call.peerName}</h2><p>{call.status === "calling" ? "Calling…" : call.status === "connected" ? "Voice call connected" : "Connecting…"}</p><audio ref={remoteAudioRef} autoPlay /></div>}
      <div className="call-controls"><button className={`call-control-button ${muted ? "call-control-muted" : ""}`} onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <FiMicOff /> : <FiMic />}</button>{call.type === "video" && <button className={`call-control-button ${cameraOff ? "call-control-muted" : ""}`} onClick={toggleCamera} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? <FiVideoOff /> : <FiVideo />}</button>}<button className="call-end-button" onClick={endCall} aria-label="End call"><FiPhoneOff /></button></div>
      <div className="call-status-line">{call.status === "calling" ? `Calling ${call.peerName}…` : call.status === "connected" ? `Connected with ${call.peerName}` : `Connecting to ${call.peerName}…`}</div>
    </section></div>}
    {groupOpen && <div className="invite-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGroupOpen(false); }}><form className="invite-modal group-create-modal" onSubmit={createGroup} role="dialog" aria-modal="true" aria-labelledby="group-title"><button type="button" className="invite-close" onClick={() => setGroupOpen(false)} aria-label="Close group form"><FiX/></button><span className="invite-modal-icon"><FiUsers/></span><span className="eyebrow">MAKE A LITTLE GROUP</span><h2 id="group-title">Start a group chat</h2><label className="group-name-field">Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} placeholder="Weekend plans, book club…" /></label><div className="group-member-picker"><strong>Add at least two friends</strong>{contacts.map((person) => <label key={person._id}><input type="checkbox" checked={groupMembers.includes(String(person._id))} onChange={(event) => setGroupMembers((current) => event.target.checked ? [...current, String(person._id)] : current.filter((id) => id !== String(person._id)))} /><span>{person.fullName}</span></label>)}{!contacts.length && <small>Accept follow requests first to add friends to a group.</small>}</div><button className="feature-primary" type="submit" disabled={groupMembers.length < 2 || !groupName.trim()}>Create group</button></form></div>}
    {inviteOpen && <div className="invite-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><section className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title"><button className="invite-close" onClick={() => setInviteOpen(false)} aria-label="Close invite"><FiX/></button><span className="invite-modal-icon">♡</span><span className="eyebrow">MAKE IT A LITTLE CLOSER</span><h2 id="invite-title">Invite your person</h2><p>Share your Mingo link. They can create an account, then you’ll both see each other in your circle.</p><div className="invite-link-preview"><span>{window.location.origin}/register</span><button onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/register`); toast.success("Invite link copied!"); } catch { toast.error("Copy didn’t work. You can copy the link from your address bar."); } }}><FiCopy/> Copy link</button></div><div className="invite-modal-foot"><i/> Your chats stay between your accounts</div></section></div>}
    <div className="mobile-backdrop" onClick={() => setMobileList(false)} />
  </main>;
}
