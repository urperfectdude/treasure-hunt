import { useRef, useState } from "react";

// Minimal record/stop/preview flow for the "describe this location by
// voice" input mode. Requires a secure context (https, or localhost) for
// getUserMedia — true for both local dev and the GitHub Pages deploy.
export default function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (file: File | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        onRecorded(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone — check your browser permissions.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function clear() {
    setPreviewUrl(null);
    onRecorded(null);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {!previewUrl && (
        <button
          type="button"
          onClick={recording ? stop : start}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white shadow-sm transition ${
            recording ? "animate-pulse bg-red-500" : "bg-amber-500"
          }`}
        >
          🎙️
        </button>
      )}
      <p className="text-xs text-stone-500">
        {previewUrl ? "Recorded" : recording ? "Recording… tap to stop" : "Tap to record"}
      </p>
      {previewUrl && (
        <div className="flex items-center gap-2">
          <audio src={previewUrl} controls className="h-8" />
          <button type="button" onClick={clear} className="text-xs font-semibold text-red-600">
            Redo
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
