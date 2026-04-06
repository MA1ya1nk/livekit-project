import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { receptionistTurn } from '../../api/livekit';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { UserCard, UserPageHeader, UserSectionTitle } from '../../components/user/UserPageLayout';

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

function MicIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3a3 3 0 00-3 3v6a3 3 0 106 0V6a3 3 0 00-3-3zm-7 9a7 7 0 0014 0M12 19v3m-4 0h8" />
    </svg>
  );
}

export default function VoiceAssistant() {
  const { user } = useAuth();
  const tenantKey = String(user?.tenant_id ?? '');
  const historyStorageKey = user?.id ? `voice_agent_history_v1_${user.id}` : null;
  const [history, setHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const historyStorageKeyRef = useRef(null);
  useEffect(() => {
    historyStorageKeyRef.current = historyStorageKey;
  }, [historyStorageKey]);

  const speechSupported = !!SpeechRecognitionImpl;
  const canSend = !loading && !!tenantKey;

  const messages = useMemo(() => {
    return history.map((m, idx) => ({ ...m, id: `${m.role}-${idx}` }));
  }, [history]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Fresh conversation each time this page loads (drop any stale localStorage from older builds).
  useEffect(() => {
    if (!historyStorageKey) return;
    try {
      localStorage.removeItem(historyStorageKey);
    } catch {
      // ignore
    }
    setHistory([]);
    setTranscript('');
    setAssistantReply('');
    setError('');
  }, [historyStorageKey]);

  // Clear persisted chat only on real logout.
  useEffect(() => {
    const onLogout = () => {
      const key = historyStorageKeyRef.current;
      if (key) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
      setHistory([]);
      setTranscript('');
      setAssistantReply('');
      setError('');
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const speak = (text) => {
    if (!text || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const sendTurn = async (text) => {
    if (!text.trim() || !canSend) return;
    setLoading(true);
    setError('');
    setAssistantReply('');
    const nextHistory = [...history, { role: 'user', content: text.trim() }];
    setHistory(nextHistory);
    setTranscript(text.trim());

    try {
      const data = await receptionistTurn({
        tenant_key: tenantKey,
        user_text: text.trim(),
        history: nextHistory,
      });
      const reply = data?.reply || 'I did not get that. Please try again.';
      const withAssistant = [...nextHistory, { role: 'assistant', content: reply }];
      setHistory(withAssistant);
      setAssistantReply(reply);
      speak(reply);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reach voice assistant.'));
    } finally {
      setLoading(false);
    }
  };

  const startMic = () => {
    if (!speechSupported || isListening || loading) return;
    setError('');
    // Stop any ongoing assistant TTS immediately when user starts a new turn.
    window.speechSynthesis?.cancel();
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setError('Could not capture voice. Check microphone permission.');
    };
    recognition.onresult = async (event) => {
      const spoken = event?.results?.[0]?.[0]?.transcript || '';
      if (spoken) await sendTurn(spoken);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="min-h-full flex flex-col gap-6">
      <UserPageHeader
        eyebrow="Voice Assistant"
        title="Talk to Doctor Receptionist Agent"
        subtitle="Speak naturally to book appointments or ask clinic queries."
      />

      {error && (
        <div className="py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
          {error}
        </div>
      )}

      <UserCard>
        <UserSectionTitle title="Conversation" description="Use microphone to ask booking or general questions." />
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
          <div className="rounded-xl border border-[#e5e7eb] bg-[#fafaf8] p-3 h-80 overflow-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No conversation yet. Press Talk and ask a question.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#e8f1ff] text-[#1e3a8a]' : 'bg-[#ecfdf5] text-[#166534]'}`}>
                    <p className="text-[11px] uppercase font-semibold tracking-wide mb-1">
                      {m.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={startMic}
              disabled={!speechSupported || !canSend || isListening || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803d] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MicIcon className="w-4 h-4" />
              {isListening ? 'Listening...' : loading ? 'Processing...' : 'Talk'}
            </button>
          </div>

          {!speechSupported && (
            <p className="text-xs text-[#9ca3af]">
              Browser speech recognition is not supported in this browser. Use latest Chrome/Edge.
            </p>
          )}
          {transcript && (
            <p className="text-xs text-[#6b7280]">
              Last transcript: <span className="font-medium text-[#1f2937]">{transcript}</span>
            </p>
          )}
          {assistantReply && (
            <p className="text-xs text-[#6b7280]">
              Last reply spoken: <span className="font-medium text-[#1f2937]">{assistantReply}</span>
            </p>
          )}
        </div>
      </UserCard>
    </div>
  );
}
