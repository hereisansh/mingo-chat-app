import { FiHeart, FiMessageCircle, FiShield, FiArrowUpRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const helpItems = [
  ["How do I start chatting?", "Create an account for each person, sign in, then choose their name from Messages. Both accounts need to be registered first."],
  ["Can we use Mingo from different places?", "Yes. Once the app is deployed online, you can both sign in from your own devices and networks."],
  ["Where do my study notes go?", "Notes are saved to your signed-in account. Mingo Memory is optional and starts turned off."],
];

const ContactUs = () => {
  const navigate = useNavigate();
  return <main className="help-page"><section className="help-hero"><div className="help-hero-copy"><span className="home-kicker">A LITTLE HELP, RIGHT HERE</span><h1>Good chats start<br/>with feeling <em>at home.</em></h1><p>Need a hand finding your person or getting started? Here are the quick answers for your Mingo space.</p><button className="home-cta" onClick={() => navigate("/chat")}>Back to my chats <FiArrowUpRight/></button></div><div className="help-hero-art"><div className="help-orbit"/><div className="help-note-card"><span><FiHeart/></span><strong>Here for the little things.</strong><small>Your people, your place.</small><div className="help-bubbles"><i/><i/><i/></div></div></div></section><section className="help-content"><div className="help-section-heading"><span className="home-kicker">THE QUICK ANSWERS</span><h2>Let’s make this easy.</h2></div><div className="help-faq">{helpItems.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div><div className="help-bottom"><div className="help-bottom-icon"><FiShield/></div><div><strong>Your space stays yours.</strong><span>Keep your password private, and only turn on AI Memory when you want it.</span></div><button onClick={() => navigate("/register")}>Create your space <FiArrowUpRight/></button></div><div className="help-feature-cards"><article><FiMessageCircle/><strong>Talk it out</strong><span>Text, photos, video, and calls.</span></article><article><FiHeart/><strong>Keep the moments</strong><span>Stories and songs for two.</span></article><article><FiShield/><strong>In your control</strong><span>Choose what your account remembers.</span></article></div></section></main>;
};

export default ContactUs;
