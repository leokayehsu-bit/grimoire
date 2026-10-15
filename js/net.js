// Rooms. Online uses PeerJS (free WebRTC; the free PeerJS cloud server only introduces players,
// then data flows directly between browsers). The host is the hub: every message reaches everyone.
// Add ?local to the URL to use a BroadcastChannel instead — several tabs in one browser, no internet.
(function (G) {
  'use strict';

  const PREFIX = 'grimoire-seance-';
  const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
  const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  const rid = () => Math.random().toString(36).slice(2, 10);

  class Net {
    // handlers: onMessage(msg), onPeerLeft(id) [host], onClosed() [guest], onError(err)
    constructor(handlers, { local = false } = {}) {
      this.h = handlers;
      this.local = local;
      this.isHost = false;
      this.id = null;
      this.code = null;
      this.conns = new Map();
      this.conn = null;
      this.peer = null;
      this.ch = null;
      this.dead = false;
      this._unload = () => this.leave();
    }

    host() { return this.local ? this._hostLocal() : this._hostPeer(); }
    join(code) { return this.local ? this._joinLocal(code) : this._joinPeer(code); }

    send(msg) {
      if (this.dead) return;
      msg.from = this.id;
      if (this.local) { this.ch.postMessage(msg); return; }
      if (this.isHost) this._fanout(msg, null);
      else if (this.conn && this.conn.open) this.conn.send(msg);
    }

    leave() {
      if (this.dead) return;
      try { this.send({ t: this.isHost ? 'closed' : 'leave' }); } catch (e) { /* ignore */ }
      this.dead = true;
      removeEventListener('pagehide', this._unload);
      setTimeout(() => {
        try { if (this.ch) this.ch.close(); } catch (e) { /* ignore */ }
        try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
      }, 200);
    }

    // ---- local (BroadcastChannel) ----
    _hostLocal() {
      this.code = makeCode();
      this.id = 'H' + rid();
      this.isHost = true;
      this._openChannel();
      return Promise.resolve(this.code);
    }

    _joinLocal(code) {
      this.code = code;
      this.id = 'P' + rid();
      this._openChannel();
      return Promise.resolve();
    }

    _openChannel() {
      this.ch = new BroadcastChannel(PREFIX + this.code);
      this.ch.onmessage = (e) => {
        const m = e.data;
        if (this.dead || !m || m.from === this.id) return;
        this.h.onMessage(m);
      };
      addEventListener('pagehide', this._unload);
    }

    // ---- online (PeerJS) ----
    _hostPeer() {
      return new Promise((resolve, reject) => {
        if (typeof Peer === 'undefined') { reject(new Error('Could not load the online room service. Check your internet connection.')); return; }
        let tries = 0;
        const attempt = () => {
          const code = makeCode();
          const peer = new Peer(PREFIX + code);
          let opened = false;
          peer.on('open', (id) => {
            opened = true;
            Object.assign(this, { peer, id, code, isHost: true });
            addEventListener('pagehide', this._unload);
            resolve(code);
          });
          peer.on('connection', (c) => this._accept(c));
          peer.on('disconnected', () => {
            // Lost the introduction server only; existing players stay connected. Reconnect for new joiners.
            if (!this.dead) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* ignore */ } }, 1500);
          });
          peer.on('error', (err) => {
            if (!opened) {
              peer.destroy();
              if (err.type === 'unavailable-id' && ++tries < 6) attempt();
              else reject(err);
            } else if (this.h.onError) this.h.onError(err);
          });
        };
        attempt();
      });
    }

    _accept(c) {
      c.on('open', () => this.conns.set(c.peer, c));
      c.on('data', (m) => {
        if (this.dead || !m || typeof m !== 'object') return;
        m.from = c.peer; // the host vouches for who sent it
        this._fanout(m, c.peer);
        if (!m.to || m.to === this.id) this.h.onMessage(m);
      });
      const gone = () => {
        if (this.conns.get(c.peer) !== c) return;
        this.conns.delete(c.peer);
        if (!this.dead) this.h.onPeerLeft(c.peer);
      };
      c.on('close', gone);
      c.on('error', gone);
    }

    _fanout(msg, except) {
      for (const [id, c] of this.conns) {
        if (id === except || !c.open || (msg.to && msg.to !== id)) continue;
        try { c.send(msg); } catch (e) { /* dropped player */ }
      }
    }

    _joinPeer(code) {
      return new Promise((resolve, reject) => {
        if (typeof Peer === 'undefined') { reject(new Error('Could not load the online room service. Check your internet connection.')); return; }
        const peer = new Peer();
        this.peer = peer;
        let done = false;
        const fail = (e) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { peer.destroy(); } catch (_) { /* ignore */ }
          reject(e);
        };
        const timer = setTimeout(() => fail(new Error('No answer from that room.')), 12000);
        peer.on('open', (id) => {
          this.id = id;
          const conn = peer.connect(PREFIX + code, { reliable: true });
          conn.on('open', () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            this.conn = conn;
            this.code = code;
            addEventListener('pagehide', this._unload);
            resolve();
          });
          conn.on('data', (m) => { if (!this.dead && m && typeof m === 'object') this.h.onMessage(m); });
          conn.on('close', () => { if (!this.dead && done) this.h.onClosed(); });
        });
        peer.on('error', (err) => {
          if (!done) fail(err.type === 'peer-unavailable' ? new Error('There is no room with that code.') : err);
          else if (this.h.onError) this.h.onError(err);
        });
      });
    }
  }

  G.Net = Net;
})(globalThis.GR = globalThis.GR || {});
