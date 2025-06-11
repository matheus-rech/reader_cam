import React, { useState, useRef, useEffect, useCallback } from 'react';
import { identifyTextInImage } from './services/geminiService';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { CameraIcon, CameraOffIcon, SpeakerWaveIcon, NoSymbolIcon, ScreenShareIcon, ScreenShareOffIcon, SettingsIcon, RecordIcon, StopCircleIcon, DownloadIcon, XMarkIcon, ClipboardIcon } from './components/Icons';

type ActiveInputType = 'camera' | 'screen' | 'none';

const App: React.FC = () => {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isScreenSharingOn, setIsScreenSharingOn] = useState<boolean>(false);
  const [activeInputType, setActiveInputType] = useState<ActiveInputType>('none');
  
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [currentSpokenText, setCurrentSpokenText] = useState<string>('');
  const [lastDetectedTextByAI, setLastDetectedTextByAI] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Advanced Settings State
  const [isAdvancedPanelOpen, setIsAdvancedPanelOpen] = useState<boolean>(false);
  const [customPromptText, setCustomPromptText] = useState<string>('');

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [videoRecordUrl, setVideoRecordUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Speech Customization State
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

  // Text Copy State
  const [copiedConfirmation, setCopiedConfirmation] = useState<boolean>(false);

  const PROCESSING_INTERVAL = 1500;

  // Populate voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      // Optionally set a default voice if none selected and voices are available
      if (!selectedVoiceURI && voices.length > 0) {
        // You might want to pick a default based on language or just the first one
        // setSelectedVoiceURI(voices.find(voice => voice.lang.startsWith('en'))?.voiceURI || voices[0].voiceURI);
      }
    };

    loadVoices(); // Initial attempt
    window.speechSynthesis.onvoiceschanged = loadVoices; // When voices are loaded/changed

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI]);


  const speakText = useCallback((text: string) => {
    if (!text.trim()) return;
    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      if (selectedVoiceURI) {
        const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis error:", e);
      setError("Could not read text aloud. Speech synthesis might not be supported or failed.");
    }
  }, [speechRate, selectedVoiceURI, availableVoices]);

  useEffect(() => {
    if (currentSpokenText) {
      speakText(currentSpokenText);
    }
  }, [currentSpokenText, speakText]);

  const captureFrameAndProcess = useCallback(async () => {
    if (isProcessingAI || !videoRef.current || !canvasRef.current || videoRef.current.readyState < videoRef.current.HAVE_METADATA || activeInputType === 'none') {
      return;
    }

    setIsProcessingAI(true);
    setError(null); // Clear previous errors on new attempt

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64ImageDataWithPrefix = canvas.toDataURL('image/jpeg');
      const base64ImageData = base64ImageDataWithPrefix.split(',')[1];

      try {
        const identifiedText = await identifyTextInImage(base64ImageData, customPromptText);
        if (identifiedText && identifiedText.trim() !== '') {
            setLastDetectedTextByAI(identifiedText.trim()); // Always update last detected text
            // Only speak if it's different from the previously spoken text to avoid repetition
            if (identifiedText.trim() !== currentSpokenText.trim()) { 
                 setCurrentSpokenText(identifiedText.trim());
            }
        } else if (!identifiedText || identifiedText.trim() === '') {
          // No new text detected, currentSpokenText remains, lastDetectedTextByAI might be cleared or kept
          // For now, let's keep lastDetectedTextByAI as is, or set it to empty if desired
          // setLastDetectedTextByAI(""); // If you want to clear display when no text
        }
      } catch (err) {
        console.error("Error identifying text:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to identify text from image.";
        setError(errorMessage);
        setLastDetectedTextByAI(''); // Clear displayed text on error
      }
    }
    setIsProcessingAI(false);
  }, [isProcessingAI, currentSpokenText, activeInputType, customPromptText]); // Removed lastDetectedTextByAI dependency to avoid re-triggering based on display

  const handleStopRecordingInternal = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const stopAllStreamsAndProcessing = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsCameraOn(false);
    setIsScreenSharingOn(false);
    setActiveInputType('none');

    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    window.speechSynthesis.cancel();
    setCurrentSpokenText('');
    setLastDetectedTextByAI(''); // Clear detected text when stopping
    setIsProcessingAI(false);
    handleStopRecordingInternal(); 
  }, [stream, handleStopRecordingInternal]);


  const startCamera = useCallback(async () => {
    if (isScreenSharingOn) {
      stopAllStreamsAndProcessing(); 
    }
    setError(null);
    setRecordingError(null);
    setVideoRecordUrl(null);
    recordedChunksRef.current = [];
    setCurrentSpokenText('');
    setLastDetectedTextByAI('');

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
             if (videoRef.current) videoRef.current.play().catch(console.error);
        };
      }
      setIsCameraOn(true);
      setIsScreenSharingOn(false);
      setActiveInputType('camera');
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = setInterval(captureFrameAndProcess, PROCESSING_INTERVAL); 
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
      stopAllStreamsAndProcessing();
    }
  }, [isScreenSharingOn, stopAllStreamsAndProcessing, captureFrameAndProcess, PROCESSING_INTERVAL]);

  const startScreenShare = useCallback(async () => {
    if (isCameraOn) {
      stopAllStreamsAndProcessing(); 
    }
    setError(null);
    setRecordingError(null);
    setVideoRecordUrl(null);
    recordedChunksRef.current = [];
    setCurrentSpokenText('');
    setLastDetectedTextByAI('');

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
         videoRef.current.onloadedmetadata = () => {
             if (videoRef.current) videoRef.current.play().catch(console.error);
        };
      }
      mediaStream.getVideoTracks()[0].onended = () => {
        stopAllStreamsAndProcessing();
        setError("Screen sharing ended or permission was revoked.");
      };

      setIsScreenSharingOn(true);
      setIsCameraOn(false);
      setActiveInputType('screen');
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = setInterval(captureFrameAndProcess, PROCESSING_INTERVAL);
    } catch (err) {
      console.error("Error starting screen share:", err);
      setError("Could not start screen sharing. Please ensure permissions are granted.");
      stopAllStreamsAndProcessing();
    }
  }, [isCameraOn, stopAllStreamsAndProcessing, captureFrameAndProcess, PROCESSING_INTERVAL]);


  const handleToggleCamera = () => {
    if (isCameraOn) {
      stopAllStreamsAndProcessing();
    } else {
      startCamera();
    }
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharingOn) {
      stopAllStreamsAndProcessing();
    } else {
      startScreenShare();
    }
  };

  const handleStartRecording = useCallback(() => {
    if (!stream || activeInputType === 'none') {
      setRecordingError("No active stream to record. Start camera or screen share first.");
      return;
    }
    if (isRecording) return;

    setRecordingError(null);
    setVideoRecordUrl(null);
    recordedChunksRef.current = [];

    try {
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      let supportedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          supportedMimeType = mimeType;
          break;
        }
      }
      if (!supportedMimeType) {
        setRecordingError("No supported MIME type found for recording (e.g., video/webm).");
        return;
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
        const url = URL.createObjectURL(blob);
        setVideoRecordUrl(url);
        recordedChunksRef.current = []; 
      };
      mediaRecorderRef.current.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event);
        setRecordingError(`Recording failed: ${(event as any)?.error?.name || 'Unknown error'}`);
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Error starting MediaRecorder:", e);
      setRecordingError("Failed to start recording. MediaRecorder might not be supported or stream is invalid.");
      setIsRecording(false);
    }
  }, [stream, activeInputType, isRecording]);

  const handleStopRecording = useCallback(() => {
    handleStopRecordingInternal();
  }, [handleStopRecordingInternal]);

  const handleCopyText = useCallback(() => {
    if (!lastDetectedTextByAI) return;
    navigator.clipboard.writeText(lastDetectedTextByAI)
      .then(() => {
        setCopiedConfirmation(true);
        setTimeout(() => setCopiedConfirmation(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy text: ", err);
        setError("Failed to copy text to clipboard.");
      });
  }, [lastDetectedTextByAI]);


  useEffect(() => {
    return () => {
      stopAllStreamsAndProcessing();
      if (videoRecordUrl) {
        URL.revokeObjectURL(videoRecordUrl);
      }
    };
  }, [stopAllStreamsAndProcessing, videoRecordUrl]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-slate-100 selection:bg-sky-500 selection:text-white relative">
      <button
        onClick={() => setIsAdvancedPanelOpen(prev => !prev)}
        className="fixed bottom-4 left-4 z-50 p-3 bg-slate-700 hover:bg-slate-600 rounded-full shadow-lg transition-colors"
        aria-label="Open advanced settings"
      >
        <SettingsIcon className="w-6 h-6 text-sky-400" />
      </button>

      <div
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 bg-slate-800 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out p-6 space-y-6 overflow-y-auto
                    ${isAdvancedPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-settings-title"
      >
        <div className="flex justify-between items-center">
          <h2 id="advanced-settings-title" className="text-2xl font-semibold text-sky-400">Advanced Settings</h2>
          <Button variant="ghost" onClick={() => setIsAdvancedPanelOpen(false)} aria-label="Close advanced settings">
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        <div>
          <label htmlFor="customPrompt" className="block text-sm font-medium text-slate-300 mb-1">
            Custom AI Prompt Instructions
          </label>
          <textarea
            id="customPrompt"
            rows={3}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400"
            placeholder="e.g., 'Extract only numbers'"
            value={customPromptText}
            onChange={(e) => setCustomPromptText(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">This text will be added to the default AI instructions.</p>
        </div>

        <div className="border-t border-slate-700 pt-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-300 mb-2">Speech Settings</h3>
            <div>
                <label htmlFor="speechRate" className="block text-sm font-medium text-slate-300 mb-1">
                    Speech Rate ({speechRate.toFixed(1)}x)
                </label>
                <input
                    type="range"
                    id="speechRate"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
            </div>
            <div>
                <label htmlFor="speechVoice" className="block text-sm font-medium text-slate-300 mb-1">
                    Speech Voice
                </label>
                <select
                    id="speechVoice"
                    value={selectedVoiceURI || ''}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100"
                    disabled={availableVoices.length === 0}
                >
                    {availableVoices.length === 0 && <option value="">Loading voices...</option>}
                    {availableVoices.map(voice => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                        </option>
                    ))}
                </select>
            </div>
        </div>


        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-lg font-medium text-slate-300 mb-2">Session Recording (Video)</h3>
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              className="w-full flex items-center justify-center py-2.5"
              variant="primary"
              disabled={activeInputType === 'none' || !stream}
            >
              <RecordIcon className="w-5 h-5 mr-2" /> Start Recording
            </Button>
          ) : (
            <Button
              onClick={handleStopRecording}
              className="w-full flex items-center justify-center py-2.5"
              variant="danger"
            >
              <StopCircleIcon className="w-5 h-5 mr-2" /> Stop Recording
            </Button>
          )}
          {recordingError && <p className="text-red-400 mt-2 text-sm">{recordingError}</p>}
          {videoRecordUrl && (
            <div className="mt-4">
              <p className="text-sm text-emerald-400 mb-2">Recording complete!</p>
              <a
                href={videoRecordUrl}
                download={`session-recording-${new Date().toISOString()}.webm`}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500"
              >
                <DownloadIcon className="w-5 h-5 mr-2" /> Download Recording
              </a>
            </div>
          )}
           {activeInputType === 'none' && !isRecording && <p className="mt-2 text-xs text-slate-400">Start camera or screen share to enable recording.</p>}
        </div>
      </div>


      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-sky-400">Universal Text Reader</h1>
        <p className="text-slate-400 mt-2">Use your camera or share your screen. I'll identify text and read it aloud!</p>
      </header>

      <div className="w-full max-w-2xl bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="relative aspect-video bg-slate-700">
          <video
            ref={videoRef}
            className={`w-full h-full object-contain ${activeInputType !== 'none' ? '' : 'hidden'}`}
            playsInline
            muted
            onCanPlay={() => videoRef.current?.play().catch(e => console.warn("Video play interrupted:", e))}
          />
          {activeInputType === 'none' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4">
              {isCameraOn ? <CameraOffIcon className="w-24 h-24 mb-4" /> : isScreenSharingOn ? <ScreenShareOffIcon className="w-24 h-24 mb-4" /> : <NoSymbolIcon className="w-24 h-24 mb-4" /> }
              <p className="text-center">
                { error && error.includes("permission") ? "Input permission denied." : "No active input. Start camera or screen share."}
              </p>
            </div>
          )}
           <canvas ref={canvasRef} className="hidden"></canvas>
        </div>

        <div className="p-6 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={handleToggleCamera}
              className="w-full text-lg py-3 flex items-center justify-center"
              variant={isCameraOn ? 'danger' : 'primary'}
              disabled={isScreenSharingOn || isRecording} 
              aria-label={isCameraOn ? 'Stop camera' : 'Start camera'}
            >
              {isCameraOn ? <CameraOffIcon className="w-6 h-6 mr-2" /> : <CameraIcon className="w-6 h-6 mr-2" />}
              {isCameraOn ? 'Stop Camera' : 'Start Camera'}
            </Button>
            <Button
              onClick={handleToggleScreenShare}
              className="w-full text-lg py-3 flex items-center justify-center"
              variant={isScreenSharingOn ? 'danger' : 'primary'}
              disabled={isCameraOn || isRecording}
              aria-label={isScreenSharingOn ? 'Stop screen share' : 'Start screen share'}
            >
              {isScreenSharingOn ? <ScreenShareOffIcon className="w-6 h-6 mr-2" /> : <ScreenShareIcon className="w-6 h-6 mr-2" />}
              {isScreenSharingOn ? 'Stop Screen Share' : 'Start Screen Share'}
            </Button>
          </div>
           {isRecording && <p className="text-sm text-yellow-400 mt-3 text-center">Recording in progress. Stop recording to change input source.</p>}

            {/* Detected Text Display Area */}
            <div className="mt-6">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-md font-semibold text-slate-300">Detected Text:</h3>
                    <Button
                        variant="ghost"
                        onClick={handleCopyText}
                        disabled={!lastDetectedTextByAI || copiedConfirmation}
                        className="py-1 px-2 text-sm"
                        aria-label="Copy detected text"
                    >
                        <ClipboardIcon className="w-4 h-4 mr-1.5" />
                        {copiedConfirmation ? 'Copied!' : 'Copy'}
                    </Button>
                </div>
                <div 
                    aria-live="polite"
                    className="w-full h-24 p-2 bg-slate-700 border border-slate-600 rounded-md overflow-y-auto text-sm text-slate-200 whitespace-pre-wrap"
                >
                    {lastDetectedTextByAI || (activeInputType !== 'none' && !error ? "Point at text to identify..." : "No text identified yet.")}
                </div>
            </div>

          <div className="mt-4 text-center h-12 flex flex-col justify-center">
            {isProcessingAI && (
              <div className="flex items-center justify-center text-sky-400">
                <Spinner className="w-5 h-5 mr-2" />
                <span>Identifying text from {activeInputType}...</span>
              </div>
            )}
            {!isProcessingAI && currentSpokenText && activeInputType !== 'none' && (
              <div className="flex items-center justify-center text-emerald-400">
                 <SpeakerWaveIcon className="w-5 h-5 mr-2" />
                <p className="truncate italic">Speaking: "{currentSpokenText}"</p>
              </div>
            )}
             {/* Removed the "No new text detected" specific message as it's covered by the text area */}
            {error && (
              <p className="text-red-400 mt-1 text-xs sm:text-sm break-words px-2">Error: {error}</p>
            )}
             {activeInputType === 'none' && !error && !isProcessingAI && (
                 <div className="flex items-center justify-center text-slate-500 text-sm">
                    <span>Select an input source above.</span>
                </div>
            )}
          </div>
        </div>
      </div>
      <footer className="mt-8 text-center text-sm text-slate-500">
        <p>Using Gemini API for text recognition.</p>
        <p>Ensure your API Key for Gemini is set in your environment variables.</p>
      </footer>
    </div>
  );
};

export default App;