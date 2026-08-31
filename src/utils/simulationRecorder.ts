// Simulation screen-recording — no dependency needed, the browser can do
// this itself via canvas.captureStream() + the built-in MediaRecorder API.

const chunksByRecorder = new WeakMap<MediaRecorder, Blob[]>();

export function startRecording(canvas: HTMLCanvasElement, fps = 30): MediaRecorder {
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks: Blob[] = [];
  chunksByRecorder.set(recorder, chunks);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  return recorder;
}

export function stopRecording(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const chunks = chunksByRecorder.get(recorder) ?? [];
      chunksByRecorder.delete(recorder);
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.stop();
  });
}
