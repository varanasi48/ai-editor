import React, { useState, useEffect, useRef } from 'react';

const MedicalTranscriber = ({ user, onSaveTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState('Patient');
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [segments, setSegments] = useState([]);
  
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimText += transcript;
          }
        }
        
        if (finalTranscript) {
          const timestamp = new Date().toLocaleTimeString();
          const newSegment = {
            id: Date.now(),
            speaker: currentSpeaker,
            text: finalTranscript,
            timestamp: timestamp,
            duration: recordingTime
          };
          
          setSegments(prev => [...prev, newSegment]);
          setTranscript(prev => prev + `[${timestamp}] ${currentSpeaker}: ${finalTranscript}\n\n`);
          setInterimTranscript('');
        } else {
          setInterimTranscript(interimText);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        }
      };
      
      recognitionRef.current.onend = () => {
        if (isRecording) {
          // Restart if we're still supposed to be recording
          recognitionRef.current.start();
        }
      };
    } else {
      alert('Speech recognition not supported in this browser. Please use Chrome or Edge.');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSpeaker, isRecording, recordingTime]);

  const startRecording = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setIsRecording(true);
      setSessionStartTime(new Date());
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      // Add session header to transcript
      const startTime = new Date().toLocaleString();
      const header = `=== MEDICAL CONSULTATION TRANSCRIPT ===\nDate: ${startTime}\nPatient: ${user}\nSession Started\n\n`;
      setTranscript(header);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Add session footer
    const endTime = new Date().toLocaleString();
    const footer = `\n=== SESSION ENDED ===\nEnd Time: ${endTime}\nTotal Duration: ${formatTime(recordingTime)}\n`;
    setTranscript(prev => prev + footer);
  };

  const switchSpeaker = (speaker) => {
    setCurrentSpeaker(speaker);
    if (isRecording) {
      // Add speaker change marker
      const timestamp = new Date().toLocaleTimeString();
      setTranscript(prev => prev + `[${timestamp}] --- Speaker changed to ${speaker} ---\n\n`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveTranscript = () => {
    if (onSaveTranscript) {
      const transcriptData = {
        transcript,
        segments,
        sessionInfo: {
          startTime: sessionStartTime,
          duration: recordingTime,
          patient: user,
          totalSegments: segments.length
        }
      };
      onSaveTranscript(transcriptData);
    }
    
    // Also download as file
    const element = document.createElement('a');
    const file = new Blob([transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    const fileName = `medical_transcript_${new Date().toISOString().split('T')[0]}_${user.replace(/\s+/g, '_')}.txt`;
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const clearTranscript = () => {
    if (window.confirm('Are you sure you want to clear the transcript? This action cannot be undone.')) {
      setTranscript('');
      setSegments([]);
      setInterimTranscript('');
      setRecordingTime(0);
      setSessionStartTime(null);
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
          🏥 Medical Consultation Transcriber
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Patient:</strong> {user} | 
            <strong> Current Speaker:</strong> 
            <span style={{ 
              color: currentSpeaker === 'Patient' ? '#28a745' : '#007bff',
              fontWeight: 'bold',
              marginLeft: '5px'
            }}>
              {currentSpeaker}
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: isRecording ? '#dc3545' : '#6c757d' }}>
            {isRecording ? '🔴 RECORDING' : '⏸️ STOPPED'} - {formatTime(recordingTime)}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Recording Controls */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: isRecording ? '#dc3545' : '#28a745',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
        </button>

        {/* Speaker Selection */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => switchSpeaker('Patient')}
            disabled={!isRecording}
            style={{
              padding: '8px 16px',
              border: currentSpeaker === 'Patient' ? '2px solid #28a745' : '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: currentSpeaker === 'Patient' ? '#28a745' : 'white',
              color: currentSpeaker === 'Patient' ? 'white' : '#495057',
              cursor: isRecording ? 'pointer' : 'not-allowed',
              opacity: isRecording ? 1 : 0.6
            }}
          >
            👤 Patient
          </button>
          <button
            onClick={() => switchSpeaker('Doctor')}
            disabled={!isRecording}
            style={{
              padding: '8px 16px',
              border: currentSpeaker === 'Doctor' ? '2px solid #007bff' : '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: currentSpeaker === 'Doctor' ? '#007bff' : 'white',
              color: currentSpeaker === 'Doctor' ? 'white' : '#495057',
              cursor: isRecording ? 'pointer' : 'not-allowed',
              opacity: isRecording ? 1 : 0.6
            }}
          >
            👨‍⚕️ Doctor
          </button>
          <button
            onClick={() => switchSpeaker('Nurse')}
            disabled={!isRecording}
            style={{
              padding: '8px 16px',
              border: currentSpeaker === 'Nurse' ? '2px solid #17a2b8' : '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: currentSpeaker === 'Nurse' ? '#17a2b8' : 'white',
              color: currentSpeaker === 'Nurse' ? 'white' : '#495057',
              cursor: isRecording ? 'pointer' : 'not-allowed',
              opacity: isRecording ? 1 : 0.6
            }}
          >
            👩‍⚕️ Nurse
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={saveTranscript}
            disabled={!transcript.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: transcript.trim() ? '#17a2b8' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: transcript.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            💾 Save
          </button>
          <button
            onClick={clearTranscript}
            disabled={!transcript.trim() || isRecording}
            style={{
              padding: '8px 16px',
              backgroundColor: (!transcript.trim() || isRecording) ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!transcript.trim() || isRecording) ? 'not-allowed' : 'pointer'
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Live Transcript Display */}
      <div style={{
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        backgroundColor: 'white',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          fontWeight: 'bold',
          color: '#495057'
        }}>
          📝 Live Transcript
        </div>
        
        <div style={{
          flex: 1,
          padding: '16px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap'
        }}>
          {transcript}
          {interimTranscript && (
            <span style={{ 
              color: '#6c757d', 
              backgroundColor: '#f8f9fa',
              padding: '2px 4px',
              borderRadius: '2px'
            }}>
              [{new Date().toLocaleTimeString()}] {currentSpeaker}: {interimTranscript}
            </span>
          )}
          {isRecording && !interimTranscript && (
            <span style={{ color: '#28a745', animation: 'blink 1s infinite' }}>
              Listening...
            </span>
          )}
        </div>
      </div>

      {/* Session Stats */}
      {segments.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#e9ecef',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>📊 Session Statistics</h4>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div><strong>Total Segments:</strong> {segments.length}</div>
            <div><strong>Session Duration:</strong> {formatTime(recordingTime)}</div>
            <div><strong>Patient Segments:</strong> {segments.filter(s => s.speaker === 'Patient').length}</div>
            <div><strong>Doctor Segments:</strong> {segments.filter(s => s.speaker === 'Doctor').length}</div>
            <div><strong>Nurse Segments:</strong> {segments.filter(s => s.speaker === 'Nurse').length}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default MedicalTranscriber;
