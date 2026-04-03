import { useEffect, useMemo, useRef, useState } from 'react';
import { Room } from 'livekit-client';
import { useAuth } from '../../contexts/AuthContext';
import { createLivekitToken, receptionistTurn } from '../../api/livekit';
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

function PhoneWaveIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5.5a7 7 0 010 13m-3-10a4 4 0 010 7M4 8.5l4-1 3 3-2 2a12.4 12.4 0 005.5 5.5l2-2 3 3-1 4a2 2 0 01-2.2 1.5C8.2 22.9 1.1 15.8 3 8.7A2 2 0 014 8.5z" />
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
  const [livekitStatus, setLivekitStatus] = useState('not_connected');
  const [livekitInfo, setLivekitInfo] = useState('');
  const roomRef = useRef(null);
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
      if (roomRef.current) roomRef.current.disconnect();
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

  const connectLivekit = async () => {
    if (!tenantKey || livekitStatus === 'connecting' || livekitStatus === 'connected') return;
    setLivekitStatus('connecting');
    setLivekitInfo('');
    setError('');
    try {
      const room = new Room();
      const participantIdentity = `user-${user?.id || 'anon'}-${Date.now()}`;
      const tokenRes = await createLivekitToken({
        tenant_key: tenantKey,
        participant_name: user?.name || user?.email || 'Web User',
        participant_identity: participantIdentity,
        room_name: `tenant-${tenantKey}-reception`,
      });
      if (!tokenRes?.token || !tokenRes?.url) {
        throw new Error('LiveKit token or URL is missing.');
      }

      await room.connect(tokenRes.url, tokenRes.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      room.on('disconnected', () => setLivekitStatus('not_connected'));
      roomRef.current = room;
      setLivekitStatus('connected');
      setLivekitInfo('Connected to LiveKit room. You can now use real-time audio when a LiveKit worker/agent is attached.');
    } catch (err) {
      setLivekitStatus('not_connected');
      setError(getApiErrorMessage(err, 'Failed to connect to LiveKit room.'));
    }
  };

  const disconnectLivekit = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setLivekitStatus('not_connected');
    setLivekitInfo('');
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
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

        <div className="lg:col-span-4">
          <UserCard className="h-full">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#15803d] shrink-0">
                  <PhoneWaveIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1a1d21]">LiveKit Room</h3>
                  <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
                    Connect this user session to LiveKit transport.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#6b7280]">
                Status: <span className="font-semibold text-[#1f2937]">{livekitStatus}</span>
              </p>
              {livekitInfo && <p className="text-xs text-[#166534]">{livekitInfo}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={connectLivekit}
                  disabled={!tenantKey || livekitStatus === 'connecting' || livekitStatus === 'connected'}
                  className="px-3 py-2 rounded-lg bg-[#15803d] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {livekitStatus === 'connecting' ? 'Connecting...' : 'Connect LiveKit'}
                </button>
                <button
                  type="button"
                  onClick={disconnectLivekit}
                  disabled={livekitStatus !== 'connected'}
                  className="px-3 py-2 rounded-lg border border-[#e5e2dd] text-sm font-medium bg-white disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>

              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Voice chat works immediately via browser mic + backend receptionist turn endpoint. For full real-time multi-party LiveKit agent audio, attach a LiveKit worker to the room.
              </p>
            </div>
          </UserCard>
        </div>
      </div>
    </div>
  );
}
