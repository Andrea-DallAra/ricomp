import React, { useEffect, useRef, useState } from 'react';

declare const BarcodeDetector: any;

export function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const loop = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await det.detect(video.current);
            if (codes.length) { navigator.vibrate?.(80); onCode(codes[0].rawValue); return; }
          } catch {}
          setTimeout(loop, 250);
        };
        loop();
      } catch (e: any) {
        setErr('Fotocamera non disponibile: consenti l\'accesso o inserisci il codice a mano.');
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="stack">
      {supported && !err && <video ref={video} className="video" playsInline muted />}
      {supported && !err && <p className="muted small" style={{ margin: 0 }}>Inquadra il codice a barre sull'etichetta.</p>}
      {(err || !supported) && <div className="callout">{err || 'Questo browser non legge i codici a barre: inserisci le cifre a mano.'}</div>}
      <div className="row">
        <input inputMode="numeric" placeholder="Codice a barre (es. 8480000…)" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
        <button className="btn" disabled={manual.length < 8} onClick={() => onCode(manual)}>Cerca</button>
      </div>
    </div>
  );
}
