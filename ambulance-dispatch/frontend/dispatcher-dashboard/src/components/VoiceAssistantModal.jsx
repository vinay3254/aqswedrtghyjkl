import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, IconButton, Chip, TextField,
  LinearProgress, Alert, Tooltip
} from '@mui/material';
import {
  Mic, MicOff, VolumeUp, VolumeOff, Close, FlashOn,
  AutoAwesome, CheckCircle, Warning, Send, RecordVoiceOver
} from '@mui/icons-material';

const G = '#2563EB';
const RED = '#EF4444';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const TEXT = '#0F172A';
const DIM = '#475569';
const BRD = '#E2E8F0';

export default function VoiceAssistantModal({
  open,
  onClose,
  onAutoDispatch,
  onAcknowledge,
  onActivateGreenCorridor,
  onFilterChange,
  incidents = [],
  ambulances = []
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Click microphone or speak a dispatch command');
  const [statusType, setStatusType] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'success'
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [manualCommand, setManualCommand] = useState('');
  const [history, setHistory] = useState([
    { role: 'assistant', text: 'Voice Assistant online. You can say: "Dispatch nearest ambulance", "Activate green corridor", "Show available units", or "Acknowledge all calls".', time: 'Ready' }
  ]);

  // Persistent Refs to prevent re-instantiation and InvalidStateError
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis || null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef('');
  const callbacksRef = useRef({ onAutoDispatch, onAcknowledge, onActivateGreenCorridor, onFilterChange, incidents, ambulances });

  // Keep callbacks fresh in ref without triggering useEffect re-instantiations
  useEffect(() => {
    callbacksRef.current = { onAutoDispatch, onAcknowledge, onActivateGreenCorridor, onFilterChange, incidents, ambulances };
  }, [onAutoDispatch, onAcknowledge, onActivateGreenCorridor, onFilterChange, incidents, ambulances]);

  // Execute recognized command
  const executeCommand = useCallback((cmdText) => {
    if (!cmdText || !cmdText.trim()) return;
    const cleanCmd = cmdText.trim();
    console.log('[VoiceAssistant] Executing command:', cleanCmd);
    setStatusType('processing');
    const cmd = cleanCmd.toLowerCase();

    setHistory(prev => [...prev, { role: 'user', text: cleanCmd, time: new Date().toLocaleTimeString() }]);

    let reply = '';
    const { onAutoDispatch, onAcknowledge, onActivateGreenCorridor, onFilterChange, ambulances } = callbacksRef.current;

    if (cmd.includes('dispatch') || cmd.includes('assign') || cmd.includes('send ambulance')) {
      onAutoDispatch?.();
      reply = 'Initiating intelligent AI auto-dispatch for highest priority emergency incident.';
      setStatusType('success');
    } else if (cmd.includes('green corridor') || cmd.includes('traffic') || cmd.includes('preempt')) {
      onActivateGreenCorridor?.();
      reply = 'Activating automated Green Corridor traffic signal preemption sequence.';
      setStatusType('success');
    } else if (cmd.includes('acknowledge') || cmd.includes('ack') || cmd.includes('accept all')) {
      onAcknowledge?.();
      reply = 'All pending emergency calls have been acknowledged.';
      setStatusType('success');
    } else if (cmd.includes('available') || cmd.includes('units') || cmd.includes('fleet status')) {
      const availCount = (ambulances || []).filter(a => a.status === 'AVAILABLE').length;
      reply = `There are currently ${availCount} ambulances in available standby status across Bengaluru hubs.`;
      setStatusType('success');
    } else if (cmd.includes('critical') || cmd.includes('high priority')) {
      onFilterChange?.('active');
      reply = 'Filtered view to display active critical emergency incidents.';
      setStatusType('success');
    } else if (cmd.includes('caller portal') || cmd.includes('intake')) {
      window.open('/#/caller', '_blank');
      reply = 'Opening Caller Voice Intake portal.';
      setStatusType('success');
    } else if (cmd.includes('driver view') || cmd.includes('driver terminal')) {
      window.open('/#/driver', '_blank');
      reply = 'Opening Driver Navigation Terminal.';
      setStatusType('success');
    } else {
      reply = `Recognized command: "${cleanCmd}". Available commands: "Dispatch nearest ambulance", "Activate green corridor", "Show available units".`;
      setStatusType('idle');
    }

    setStatusMessage(reply);
    setHistory(prev => [...prev, { role: 'assistant', text: reply, time: new Date().toLocaleTimeString() }]);

    // Speak confirmation TTS
    if (voiceEnabled && synthRef.current) {
      try {
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.onstart = () => setStatusType('speaking');
        utterance.onend = () => setStatusType('idle');
        utterance.onerror = (e) => console.warn('[VoiceAssistant TTS Error]:', e);
        synthRef.current.speak(utterance);
      } catch (e) {
        console.warn('[VoiceAssistant] SpeechSynthesis error:', e);
      }
    }
  }, [voiceEnabled]);

  // Initialize Speech Recognition ONCE on mount with empty dependency array []
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] Web Speech API not supported in this browser.');
      setStatusType('error');
      setStatusMessage('Speech recognition is not supported in this browser. Please use Chrome/Edge or type commands.');
      return;
    }

    console.log('[SpeechRecognition] Initializing stable SpeechRecognition instance...');
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    // Language fallback cascade
    try {
      recognition.lang = 'en-IN';
    } catch {
      recognition.lang = navigator.language || 'en-US';
    }
    console.log('[SpeechRecognition] Language set to:', recognition.lang);

    recognition.onstart = () => {
      console.log('[SpeechRecognition] onstart: Mic listening actively.');
      isListeningRef.current = true;
      setIsListening(true);
      setStatusType('listening');
      setStatusMessage('Listening to your voice command...');
    };

    recognition.onresult = (event) => {
      let currentText = '';
      for (let i = 0; i < event.results.length; i++) {
        currentText += event.results[i][0].transcript;
      }
      console.log('[SpeechRecognition] onresult:', currentText);
      transcriptRef.current = currentText;
      setTranscript(currentText);
    };

    recognition.onerror = (event) => {
      console.error('[SpeechRecognition] onerror event:', event.error, event);
      isListeningRef.current = false;
      setIsListening(false);
      setStatusType('error');

      if (event.error === 'not-allowed') {
        setStatusMessage('Microphone permission blocked. Please allow mic access in your browser address bar.');
      } else if (event.error === 'no-speech') {
        setStatusMessage('No speech detected. Tap mic to try again.');
      } else if (event.error === 'network') {
        setStatusMessage('Speech service network timeout. Tap mic to retry or type below.');
      } else if (event.error === 'language-not-supported') {
        console.warn('[SpeechRecognition] en-IN language not supported, falling back to en-US');
        recognition.lang = 'en-US';
        setStatusMessage('Language switched to en-US. Tap mic to speak.');
      } else {
        setStatusMessage(`Voice error (${event.error}). Tap mic to speak or type command.`);
      }
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] onend fired. Final transcript:', transcriptRef.current);
      isListeningRef.current = false;
      setIsListening(false);

      const finalSpeech = transcriptRef.current;
      if (finalSpeech && finalSpeech.trim()) {
        executeCommand(finalSpeech.trim());
      } else {
        setStatusType('idle');
        setStatusMessage('Tap mic to speak a dispatch command.');
      }
    };

    recognitionRef.current = recognition;

    // Check mic permission proactively
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
        console.log('[SpeechRecognition] Initial microphone permission state:', result.state);
        result.onchange = () => console.log('[SpeechRecognition] Mic permission changed to:', result.state);
      }).catch(err => console.log('[SpeechRecognition] Permissions query skipped:', err));
    }

    return () => {
      console.log('[SpeechRecognition] Component cleanup: stopping active recognition.');
      try {
        recognition.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, [executeCommand]); // Empty of dynamic values, executeCommand is stable callback

  const startListening = () => {
    if (!recognitionRef.current) {
      setStatusType('error');
      setStatusMessage('Speech recognition not available. Please use Chrome/Edge or type below.');
      return;
    }

    transcriptRef.current = '';
    setTranscript('');

    if (isListeningRef.current) {
      console.log('[SpeechRecognition] Already listening, restarting...');
      try { recognitionRef.current.stop(); } catch {}
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          console.warn('[SpeechRecognition] Restart error:', err);
        }
      }, 150);
      return;
    }

    try {
      console.log('[SpeechRecognition] Calling recognition.start()...');
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[SpeechRecognition] start() threw exception:', err);
      if (err.name === 'InvalidStateError') {
        // Stop first, then restart cleanly
        try { recognitionRef.current.stop(); } catch {}
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch (e) { console.error('[SpeechRecognition] Second start attempt failed:', e); }
        }, 200);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        console.log('[SpeechRecognition] Calling recognition.stop()...');
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('[SpeechRecognition] stop() threw exception:', err);
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (!manualCommand.trim()) return;
    executeCommand(manualCommand.trim());
    setManualCommand('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AutoAwesome sx={{ color: G, fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: TEXT }}>
              AI Dispatch Voice Assistant
            </Typography>
            <Typography sx={{ fontSize: 12, color: DIM }}>
              Hands-free speech commands & voice dispatch automation
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={voiceEnabled ? 'Mute Voice Feedback' : 'Enable Voice Feedback'}>
            <IconButton size="small" onClick={() => setVoiceEnabled(!voiceEnabled)}>
              {voiceEnabled ? <VolumeUp sx={{ fontSize: 18, color: G }} /> : <VolumeOff sx={{ fontSize: 18, color: DIM }} />}
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small"><Close sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: BRD }}>
        {/* Main Microphone Interaction Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
          <IconButton
            onClick={isListening ? stopListening : startListening}
            sx={{
              width: 80, height: 80,
              bgcolor: isListening ? RED : G,
              color: '#fff',
              boxShadow: isListening ? '0 0 25px rgba(239,68,68,0.5)' : '0 4px 18px rgba(37,99,235,0.3)',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: isListening ? '#dc2626' : '#1d4ed8' }
            }}
          >
            {isListening ? <MicOff sx={{ fontSize: 36 }} /> : <Mic sx={{ fontSize: 36 }} />}
          </IconButton>

          <Typography sx={{ fontWeight: 800, fontSize: 14, color: isListening ? RED : TEXT, mt: 1.5 }}>
            {isListening ? 'LISTENING... SPEAK NOW' : 'TAP MIC TO SPEAK COMMAND'}
          </Typography>

          <Chip
            label={statusType === 'listening' ? 'MIC ACTIVE' : statusType === 'speaking' ? 'SPEAKING REPLY' : statusType === 'error' ? 'MIC ERROR' : 'VOICE READY'}
            size="small"
            sx={{
              mt: 0.8, fontWeight: 800, fontSize: 9.5,
              bgcolor: statusType === 'listening' ? 'rgba(239,68,68,0.15)' : statusType === 'speaking' ? 'rgba(37,99,235,0.15)' : statusType === 'error' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
              color: statusType === 'listening' ? RED : statusType === 'speaking' ? G : statusType === 'error' ? AMBER : GREEN
            }}
          />

          {transcript && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: '10px', bgcolor: '#F8FAFC', border: `1px solid ${BRD}`, width: '100%', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: G }}>
                "{transcript}"
              </Typography>
            </Box>
          )}
        </Box>

        {/* Status / Reply Banner */}
        <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: statusType === 'error' ? 'rgba(239,68,68,0.08)' : '#F8FAFC', border: `1px solid ${statusType === 'error' ? 'rgba(239,68,68,0.2)' : BRD}`, mb: 2 }}>
          <Typography sx={{ fontSize: 12, color: statusType === 'error' ? RED : TEXT, fontWeight: 600 }}>
            {statusMessage}
          </Typography>
        </Box>

        {/* Quick Voice Command Chips */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', mb: 1 }}>
          Suggested Voice Commands
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 2.5 }}>
          {[
            'Dispatch nearest ambulance',
            'Activate green corridor',
            'Show available units',
            'Acknowledge all calls',
            'Filter critical incidents'
          ].map((text, idx) => (
            <Chip
              key={idx}
              label={`"${text}"`}
              size="small"
              onClick={() => executeCommand(text)}
              sx={{ cursor: 'pointer', bgcolor: '#F1F5F9', fontWeight: 600, fontSize: 10.5, '&:hover': { bgcolor: '#E2E8F0' } }}
            />
          ))}
        </Box>

        {/* Command Input Fallback */}
        <Box component="form" onSubmit={handleManualSubmit} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Or type a voice dispatch command..."
            value={manualCommand}
            onChange={(e) => setManualCommand(e.target.value)}
            sx={{ '& input': { fontSize: 12 } }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!manualCommand.trim()}
            sx={{ bgcolor: G, color: '#fff', px: 2, borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 12 }}
          >
            Run
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: DIM, fontWeight: 600 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
