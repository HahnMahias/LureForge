import { useEffect, useState } from 'react';
import type { PlaybackControl, SimMode } from './SimulateView';

/**
 * Fase C's scrub bar: play/pause, a seekable range over the precomputed
 * recording, elapsed/total time, and a fullscreen toggle. Polls the
 * playback refs on a plain interval (not a 60fps loop) for its own small
 * bit of display state — cheap enough for a text readout + range input,
 * and keeps this decoupled from the Canvas's own render loop, which never
 * needs to know this component re-rendered.
 *
 * The recording preview (Play) is opt-in — most of the time the rig is
 * actually being driven by live physics instead (idle drifting, dragging,
 * or "Reel in"), during which this bar's own 0:00/0:20 readout has nothing
 * real to show and used to just sit there looking frozen/broken. It now
 * shows an explicit "Live" state instead whenever that's the case, so a
 * static time never gets mistaken for a stuck recording.
 */
export default function PlaybackTimeline({
  playback,
  speed,
  viewportRef,
}: {
  playback: PlaybackControl;
  speed: number;
  viewportRef: React.RefObject<HTMLElement | null>;
}) {
  const [displayTime, setDisplayTime] = useState(0);
  const [displayPlaying, setDisplayPlaying] = useState(false);
  const [mode, setMode] = useState<SimMode>('live');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayTime(playback.playbackTimeRef.current ?? 0);
      setDisplayPlaying(!!playback.isPlayingRef.current && playback.modeRef.current === 'playback');
      setMode(playback.modeRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [playback]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const togglePlay = () => {
    playback.modeRef.current = 'playback';
    if (!playback.isPlayingRef.current) {
      // Restart from the top if pressing Play again after reaching the end
      // — otherwise it would just sit there looking unresponsive.
      if ((playback.playbackTimeRef.current ?? 0) >= playback.durationS - 1e-3) {
        playback.playbackTimeRef.current = 0;
      }
      playback.isPlayingRef.current = true;
    } else {
      playback.isPlayingRef.current = false;
    }
    setDisplayPlaying(playback.isPlayingRef.current);
  };

  const scrubTo = (t: number) => {
    playback.modeRef.current = 'playback';
    playback.playbackTimeRef.current = t;
    setDisplayTime(t);
  };

  const toggleFullscreen = () => {
    const el = viewportRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = Math.floor(s % 60);
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={togglePlay}
        title={displayPlaying ? 'Pause' : 'Play'}
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-panel-raised)',
          color: 'var(--text-primary)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {displayPlaying ? '⏸' : '▶'}
      </button>

      {mode === 'live' ? (
        <span
          title="The rig is driven by live physics right now (idle drift, dragging, or Reel in) — press Play to preview the recorded passive drop instead."
          style={{
            fontSize: 11,
            color: 'var(--accent)',
            fontWeight: 600,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          Live
        </span>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {formatTime(displayTime)} / {formatTime(playback.durationS)}
        </span>
      )}

      <input
        type="range"
        min={0}
        max={playback.durationS}
        step={0.05}
        value={mode === 'live' ? 0 : displayTime}
        disabled={mode === 'live'}
        onChange={(e) => scrubTo(parseFloat(e.target.value))}
        style={{ flex: 1, opacity: mode === 'live' ? 0.35 : 1 }}
      />

      <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{speed}&times;</span>

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-panel-raised)',
          color: 'var(--text-primary)',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isFullscreen ? '⤡' : '⛶'}
      </button>
    </div>
  );
}
