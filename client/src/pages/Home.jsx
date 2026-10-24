import { FiArrowUpRight, FiBookOpen, FiHeart, FiImage, FiMessageCircle, FiMusic, FiPlay, FiVideo } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./home.css";

const reelPreviews = [
  { id: "M7lc1UVf-VE", title: "A tiny pause in your day", label: "LITTLE JOYS", color: "mint" },
  { id: "dQw4w9WgXcQ", title: "Send this to your favorite person", label: "JUST BECAUSE", color: "rose" },
  { id: "9bZkp7q19f0", title: "One more song, together", label: "ON REPEAT", color: "lilac" },
];

export default function Home() {
  const navigate = useNavigate();
  const { isLogin } = useAuth();
  const openMingo = () => navigate(isLogin ? "/chat" : "/login");
  const openFeature = (tab) => navigate(isLogin ? "/chat" : "/login", { state: { featureTab: tab } });

  return <main className="home-page">
    <section className="home-hero">
      <div className="hero-copy">
        <div className="home-kicker"><span/> A COZY SPACE FOR YOUR FAVORITE PEOPLE</div>
        <h1>Your everyday,<br/>a little <em>closer.</em></h1>
        <p>Keep the little moments close. Send a voice note, share a silly clip, or just ask how their day went.</p>
        <div className="home-hero-actions"><button className="home-cta" onClick={() => navigate(isLogin ? "/chat" : "/register")}>{isLogin ? "Open your chats" : "Make your space"}<FiArrowUpRight/></button><button className="home-text-cta" onClick={() => navigate(isLogin ? "/chat" : "/login")}>{isLogin ? "Go to Mingo" : "I already have an account"}</button></div>
        <div className="home-hero-caption"><span className="hero-mini-hearts">♡ ♡ ♡</span> Made for your everyday kind of love</div>
      </div>
      <div className="hero-art" aria-label="Mingo chat preview">
        <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
        <article className="hero-chat-card"><header><div className="hero-avatar">A</div><div><strong>Your person</strong><small><i/> around, always</small></div><span className="hero-card-menu">•••</span></header><div className="hero-chat-date">TODAY, THE GOOD PART</div><div className="hero-bubble bubble-left">Look what I found for us ✨</div><div className="hero-reel-preview"><img src="https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg" alt="A YouTube clip preview"/><span><FiPlay/></span><small>our next little rabbit hole</small></div><div className="hero-bubble bubble-right">saving it for our next call ♡</div><footer><FiHeart/> your favorite little corner</footer></article>
        <div className="hero-sticker sticker-photo"><FiImage/></div><div className="hero-sticker sticker-music"><FiMusic/></div><div className="hero-note">somewhere between<br/>hello & home <span>✳</span></div>
      </div>
    </section>

    <section className="home-stories-section" aria-labelledby="home-stories-title">
      <div className="section-heading"><div><span className="home-kicker">A LITTLE WINDOW INTO THEIR DAY</span><h2 id="home-stories-title">Stories worth <em>keeping close.</em></h2><p>Drop a tiny update, add a song, and let your person feel part of the moment.</p></div><button className="section-link" onClick={() => openFeature("stories")}>Share a story <FiArrowUpRight/></button></div>
      <div className="story-preview-row">
        <button className="story-preview story-add" onClick={() => openFeature("stories")}><span className="story-ring"><span>＋</span></span><b>Your moment</b><small>Start a story</small></button>
        <button className="story-preview" onClick={() => openFeature("stories")}><span className="story-ring ring-peach"><span>☀</span></span><b>Slow morning</b><small>with a song</small></button>
        <button className="story-preview" onClick={() => openFeature("stories")}><span className="story-ring ring-lilac"><span>♡</span></span><b>Thinking of you</b><small>just because</small></button>
        <button className="story-preview" onClick={() => openFeature("stories")}><span className="story-ring ring-mint"><span>✿</span></span><b>Little wins</b><small>the good stuff</small></button>
        <button className="story-preview" onClick={() => openFeature("music")}><span className="story-ring ring-sunset"><span>♫</span></span><b>On repeat</b><small>listen together</small></button>
      </div>
    </section>

    <section className="home-reels-section" aria-labelledby="home-reels-title">
      <div className="section-heading"><div><span className="home-kicker">YOUR NEXT SCROLL BREAK</span><h2 id="home-reels-title">A reel, a laugh, <em>another hello.</em></h2><p>Collect the clips that made you think of each other. Scroll them together whenever.</p></div><button className="section-link" onClick={() => openFeature("reels")}>Explore reels <FiArrowUpRight/></button></div>
      <div className="home-reel-grid">{reelPreviews.map((item) => <button key={item.id} className={`home-reel-card reel-${item.color}`} onClick={() => openFeature("reels")}><img src={`https://img.youtube.com/vi/${item.id}/hqdefault.jpg`} alt=""/><span className="home-reel-play"><FiPlay/></span><span className="home-reel-label">{item.label}</span><strong>{item.title}</strong><span className="reel-open"><FiVideo/> Watch in Mingo</span></button>)}</div>
    </section>

    <section className="home-tools-row"><article><span className="tool-icon tool-chat"><FiMessageCircle/></span><div><b>Chat like you’re next door</b><small>Messages, photos, videos and calls in one cozy place.</small></div></article><article><span className="tool-icon tool-study"><FiBookOpen/></span><div><b>A little help with the hard bits</b><small>Ask your Study Buddy, keep notes, and learn at your pace.</small></div></article><article><span className="tool-icon tool-song"><FiMusic/></span><div><b>Press play at the same time</b><small>Search YouTube songs or free MP3s and listen together.</small></div></article></section>
    <footer className="home-footer"><span>mingo <i>✳</i></span><small>A little closer, always.</small><button onClick={openMingo}>Come on in <FiArrowUpRight/></button></footer>
  </main>;
}
