import React, { useState } from 'react';

export default function WhisperUploader({ onTranscript }) {
  const [audio, setAudio] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!audio) return;
    const formData = new FormData();
    formData.append('audio', audio);

    setLoading(true);
    const res = await fetch('http://localhost:3000/api/transcribe', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    setTranscript(data.transcript);
    onTranscript(data.transcript); // send result back to parent
    setLoading(false);
  };

  return (
    <div className="bg-white/10 p-4 rounded-xl text-white">
      <input
        type="file"
        accept="audio/*"
        onChange={e => setAudio(e.target.files[0])}
        className="mb-2"
      />
      <button onClick={handleUpload} className="px-4 py-2 bg-teal-500 rounded-lg">
        {loading ? 'Transcribing...' : 'Transcribe'}
      </button>
      {transcript && <p className="mt-2 text-sm text-slate-300">{transcript}</p>}
    </div>
  );
}
