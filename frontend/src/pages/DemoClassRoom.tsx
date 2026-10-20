import { useState } from 'react';
import { goHome } from '../lib/nav.js';

/**
 * The page the class link opens. The link is a dummy (per the brief), so this is
 * an honest "class room": it gives the booking context, tells the parent how to
 * join, and has a working Join action that explains the live class would open
 * here in a real trial.
 */
export function DemoClassRoom() {
  const params = new URLSearchParams(window.location.search);
  const mentor = params.get('with') ?? 'your mentor';
  const when = params.get('at');
  const [joined, setJoined] = useState(false);

  return (
    <div className="app">
      <header className="site-header">
        <a href="/" className="brand" onClick={goHome} aria-label="Codeyoung home">
          <span className="brand-mark">cy</span>
          <span className="brand-name">Codeyoung</span>
        </a>
        <span className="brand-tag">Class Room</span>
      </header>

      <main className="container">
        <div className="card room-card">
          <div className="room-icon">🎥</div>
          <h2>Your trial class with {mentor}</h2>
          {when && <p className="muted">🗓️ {when}</p>}

          {joined ? (
            <div className="room-live">
              <span className="room-live-badge">● Live (demo)</span>
              <p className="room-live-text">
                You’re in! In a real Codeyoung trial, your live 1-on-1 video class with{' '}
                <strong>{mentor}</strong> would be running right here.
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => setJoined(false)}>
                Leave demo class
              </button>
            </div>
          ) : (
            <>
              <div className="join-tips">
                <span className="join-tips-title">Before you join</span>
                <ul>
                  <li>💻 Use a laptop or desktop for the best experience</li>
                  <li>🎧 Check your camera and microphone</li>
                  <li>⏰ Join a couple of minutes before your class time</li>
                </ul>
              </div>

              <button type="button" className="btn btn-primary btn-block" onClick={() => setJoined(true)}>
                Join the class
              </button>
              <p className="room-note">
                This is a <strong>demo</strong> class room. We’ve also emailed you this link — just
                come back at your class time to join.
              </p>
            </>
          )}

          <a className="btn btn-ghost btn-block" href="/">
            ← Back to booking
          </a>
        </div>
      </main>
    </div>
  );
}
