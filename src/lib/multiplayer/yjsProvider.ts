// Y.js provider with internal Edge Config signaling for WebRTC connections

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import {
  GameAction,
  GameActionInput,
  Player,
  AwarenessState,
  generatePlayerId,
  generatePlayerColor,
} from './types';

// Signaling message types
interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to?: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}

// Data channel message types
interface DataChannelMessage {
  type: 'sync' | 'update' | 'awareness' | 'state-sync' | 'state-request';
  data?: unknown;
}

export interface MultiplayerProviderOptions {
  roomCode: string;
  cityName: string;
  playerName: string;
  isHost: boolean;
  initialGameState?: unknown; // Host provides initial state to share with guests
  onConnectionChange?: (connected: boolean, peerCount: number) => void;
  onPlayersChange?: (players: Player[]) => void;
  onAction?: (action: GameAction) => void;
  onStateReceived?: (state: unknown) => void; // Guest receives state from host
}

export class MultiplayerProvider {
  public readonly doc: Y.Doc;
  public readonly awareness: Awareness;
  public readonly roomCode: string;
  public readonly peerId: string;
  public readonly isHost: boolean;

  private player: Player;
  private options: MultiplayerProviderOptions;
  private operationsArray: Y.Array<GameAction>;
  private metaMap: Y.Map<unknown>;
  private lastAppliedIndex = 0;
  private destroyed = false;

  // WebRTC connections
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  // Polling-based signaling
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeenSignals = '';
  private connectedPeers: Set<string> = new Set();
  
  // Initial game state for P2P sync (host stores this to send to guests)
  private initialGameState: unknown = null;
  
  // Buffer ICE candidates that arrive before the offer
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  
  // Buffer outgoing ICE candidates (bundled with offer/answer)
  private outgoingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  
  // BroadcastChannel for localhost fallback (when WebRTC fails due to mDNS)
  private broadcastChannel: BroadcastChannel | null = null;
  private useLocalFallback = false;

  constructor(options: MultiplayerProviderOptions) {
    this.options = options;
    this.roomCode = options.roomCode;
    this.isHost = options.isHost;
    this.peerId = generatePlayerId();

    // Create Y.js document
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);

    // Get shared types
    this.operationsArray = this.doc.getArray<GameAction>('operations');
    this.metaMap = this.doc.getMap('meta');

    // Create player info
    this.player = {
      id: this.peerId,
      name: options.playerName,
      color: generatePlayerColor(),
      joinedAt: Date.now(),
      isHost: options.isHost,
    };

    // Set up awareness
    this.awareness.setLocalState({
      player: this.player,
    } as AwarenessState);

    // If host, initialize meta and store game state for sharing
    if (options.isHost) {
      this.metaMap.set('hostId', this.peerId);
      this.metaMap.set('createdAt', Date.now());
      this.metaMap.set('cityName', options.cityName);
      this.metaMap.set('roomCode', options.roomCode);
      this.initialGameState = options.initialGameState;
    }

    // Listen for operations
    this.operationsArray.observe((event) => {
      if (event.changes.added.size > 0) {
        const newOps = this.operationsArray.slice(this.lastAppliedIndex);
        for (const op of newOps) {
          if (op.playerId !== this.peerId && this.options.onAction) {
            this.options.onAction(op);
          }
        }
        this.lastAppliedIndex = this.operationsArray.length;
      }
    });

    // Listen for awareness changes
    this.awareness.on('change', () => {
      this.notifyPlayersChange();
    });
    
    // Set up BroadcastChannel for localhost fallback
    // This allows multiple tabs to communicate when WebRTC fails (mDNS issues)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.setupLocalFallback();
    }
  }
  
  private setupLocalFallback(): void {
    console.log('[Multiplayer] Setting up localhost BroadcastChannel fallback...');
    this.broadcastChannel = new BroadcastChannel(`coop-${this.roomCode}`);
    
    this.broadcastChannel.onmessage = (event) => {
      const msg = event.data as DataChannelMessage & { from?: string; peerId?: string };
      
      // Ignore our own messages
      if (msg.from === this.peerId || msg.peerId === this.peerId) return;
      
      console.log(`[Multiplayer] BC: Received message type: ${msg.type} from: ${msg.from || msg.peerId}`);
      
      // Handle peer announcement via broadcast channel
      if (msg.type === 'awareness') {
        const remotePeerId = msg.from || msg.peerId;
        if (remotePeerId && !this.connectedPeers.has(remotePeerId)) {
          console.log(`[Multiplayer] BC: Peer connected: ${remotePeerId}`);
          this.connectedPeers.add(remotePeerId);
          this.updateConnectionStatus();
          
          // Send acknowledgement so they know we're here too
          if (this.useLocalFallback) {
            this.broadcastChannel?.postMessage({
              type: 'awareness',
              from: this.peerId,
              data: { player: this.player },
            });
          }
        }
      }
      
      // Always process state-sync (critical for guests to receive initial state)
      // Also process when useLocalFallback is enabled
      if (msg.type === 'state-sync' || msg.type === 'state-request' || this.useLocalFallback) {
        this.handleBroadcastMessage(msg);
      }
    };
  }
  
  private handleBroadcastMessage(msg: DataChannelMessage & { from?: string; peerId?: string }): void {
    switch (msg.type) {
      case 'state-request':
        // Guest is requesting state
        console.log(`[Multiplayer] BC: State request received. isHost=${this.isHost}, hasState=${!!this.initialGameState}`);
        if (this.isHost && this.initialGameState) {
          const state = this.initialGameState as { grid?: unknown[][]; waterBodies?: unknown[]; cityName?: string };
          console.log('[Multiplayer] BC: Sending state to guest...', {
            cityName: state.cityName,
            gridSize: state.grid?.length,
            waterBodiesCount: state.waterBodies?.length,
            firstTileZone: state.grid?.[0]?.[0],
          });
          this.broadcastChannel?.postMessage({
            type: 'state-sync',
            data: this.initialGameState,
            from: this.peerId,
          });
        } else if (this.isHost && !this.initialGameState) {
          console.error('[Multiplayer] BC: Host has no initial game state to send!');
        }
        break;
        
      case 'state-sync':
        // Received state from host
        const receivedState = msg.data as { grid?: unknown[][]; waterBodies?: unknown[]; cityName?: string };
        console.log('[Multiplayer] BC: Received game state from host!', { 
          hasData: !!msg.data,
          hasCallback: !!this.options.onStateReceived,
          cityName: receivedState?.cityName,
          gridSize: receivedState?.grid?.length,
          waterBodiesCount: receivedState?.waterBodies?.length,
          firstTileZone: receivedState?.grid?.[0]?.[0],
        });
        if (this.options.onStateReceived) {
          this.options.onStateReceived(msg.data);
        } else {
          console.error('[Multiplayer] BC: No onStateReceived callback set!');
        }
        break;
        
      case 'sync':
      case 'update':
        // Y.js document update
        if (msg.data) {
          console.log('[Multiplayer] BC: Applying Y.js update...');
          const update = new Uint8Array(msg.data as ArrayBuffer | number[]);
          Y.applyUpdate(this.doc, update, 'remote');
        }
        break;
    }
  }
  
  private enableLocalFallback(): void {
    if (this.useLocalFallback) return;
    if (!this.broadcastChannel) return;
    
    console.log('[Multiplayer] Enabling BroadcastChannel fallback for localhost...');
    this.useLocalFallback = true;
    
    // Announce ourselves via broadcast channel
    this.broadcastChannel.postMessage({
      type: 'awareness',
      from: this.peerId,
      data: { player: this.player },
    });
    
    // If guest, request state from host (with slight delay to ensure host is ready)
    if (!this.isHost) {
      setTimeout(() => {
        console.log('[Multiplayer] BC: Requesting state from host...');
        this.broadcastChannel?.postMessage({
          type: 'state-request',
          from: this.peerId,
        });
      }, 100);
    }
    
    // Set up Y.js document sync via broadcast channel
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return; // Don't echo remote updates
      if (!this.useLocalFallback) return;
      
      this.broadcastChannel?.postMessage({
        type: 'update',
        data: Array.from(update),
        from: this.peerId,
      });
    });
    
    // Update connection status
    this.updateConnectionStatus();
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    console.log(`[Multiplayer] Connecting to room: ${this.roomCode}`);

    // Notify initial connection
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, 1);
    }

    // Notify initial players list
    this.notifyPlayersChange();

    // On localhost, use BroadcastChannel directly (WebRTC mDNS doesn't work between tabs)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('[Multiplayer] Localhost detected, using BroadcastChannel mode');
      this.enableLocalFallback();
      return;
    }

    // Start polling for signaling messages (production WebRTC mode)
    this.startSignalPolling();

    // If not host, send an announcement so host knows we joined
    if (!this.isHost) {
      await this.announcePresence();
    }

    console.log('[Multiplayer] Provider created, polling for peers...');
  }

  private async announcePresence(): Promise<void> {
    // Send a "hello" signal to announce our presence
    // The host will respond with an offer
    try {
      console.log('[Multiplayer] Announcing presence to room...');
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          type: 'offer',
          from: this.peerId,
          payload: { type: 'announce', peerId: this.peerId, playerName: this.player.name },
        }),
      });
      if (response.ok) {
        console.log('[Multiplayer] Announcement sent successfully');
      } else {
        console.error('[Multiplayer] Announcement failed:', await response.text());
      }
    } catch (error) {
      console.error('[Multiplayer] Failed to announce presence:', error);
    }
  }

  private startSignalPolling(): void {
    if (this.pollingInterval) return;

    let pollCount = 0;
    let roomReady = !this.isHost; // Guests know room exists (they just fetched it)
    
    const pollSignals = async () => {
      if (this.destroyed) return;
      pollCount++;

      try {
        const response = await fetch(
          `/api/signal?roomCode=${this.roomCode}&peerId=${this.peerId}&lastSeen=${encodeURIComponent(this.lastSeenSignals)}`
        );

        if (response.ok) {
          roomReady = true;
          const { signals, lastSeen, allSignalsCount } = await response.json();
          this.lastSeenSignals = lastSeen || '';

          if (signals.length > 0) {
            console.log(`[Multiplayer] Poll returned ${signals.length} signals (${allSignalsCount || '?'} total in room)`);
          }
          
          for (const signal of signals) {
            console.log(`[Multiplayer] Processing signal: ${signal.type} from ${signal.from}`);
            await this.handleSignal(signal);
          }
        } else if (response.status === 404) {
          // Room not propagated yet - only log occasionally
          if (pollCount % 5 === 1) {
            console.log('[Multiplayer] Waiting for Edge Config propagation...');
          }
        }
      } catch (error) {
        console.error('[Multiplayer] Signal polling error:', error);
      }
    };

    // Host waits for Edge Config propagation before starting
    const startPolling = async () => {
      if (this.isHost) {
        // Wait for our room to be readable (up to 3 seconds)
        for (let i = 0; i < 6; i++) {
          const check = await fetch(`/api/room?code=${this.roomCode}`);
          if (check.ok) {
            console.log('[Multiplayer] Room confirmed in Edge Config, starting signal polling');
            break;
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      // Poll every 2s - only needed until WebRTC connects
      this.pollingInterval = setInterval(pollSignals, 2000);
      pollSignals(); // Initial poll
    };
    
    startPolling();
  }

  private async handleSignal(signal: SignalMessage): Promise<void> {
    console.log(`[Multiplayer] Received signal: ${signal.type} from ${signal.from}`, signal.payload);

    // Handle announcement (peer joined) - has a special 'announce' type in payload
    const payloadType = (signal.payload as { type?: string })?.type;
    if (signal.type === 'offer' && payloadType === 'announce') {
      console.log(`[Multiplayer] Guest announced: ${signal.from}`);
      if (this.isHost) {
        console.log('[Multiplayer] I am host, creating offer for guest');
        await this.createPeerConnection(signal.from, true);
      }
      return;
    }

    // Handle real WebRTC offer (bundled format with sdp+candidates, or legacy format)
    const hasSdpPayload = (signal.payload as { sdp?: unknown })?.sdp;
    if (signal.type === 'offer' && (payloadType === 'offer' || hasSdpPayload)) {
      console.log('[Multiplayer] Handling WebRTC offer');
      await this.handleOffer(signal);
    } else if (signal.type === 'answer') {
      console.log('[Multiplayer] Handling WebRTC answer');
      await this.handleAnswer(signal);
    } else if (signal.type === 'ice-candidate') {
      // Legacy ICE candidate handling (candidates are now bundled with offer/answer)
      console.log('[Multiplayer] Handling legacy ICE candidate');
      await this.handleLegacyIceCandidate(signal);
    }
  }

  private async createPeerConnection(remotePeerId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    // Check if connection already exists
    let pc = this.peerConnections.get(remotePeerId);
    if (pc) return pc;

    console.log(`[Multiplayer] Creating peer connection to ${remotePeerId}`);

    // Use STUN servers for connectivity
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    });
    
    // Debug ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`[Multiplayer] ICE connection state: ${pc!.iceConnectionState}`);
      // ICE connected means we can communicate
      if (pc!.iceConnectionState === 'connected' || pc!.iceConnectionState === 'completed') {
        console.log('[Multiplayer] ICE connected successfully!');
      }
    };
    
    pc.onicegatheringstatechange = () => {
      console.log(`[Multiplayer] ICE gathering state: ${pc!.iceGatheringState}`);
    };
    
    pc.onicecandidateerror = (event) => {
      console.error('[Multiplayer] ICE candidate error:', event);
    };

    this.peerConnections.set(remotePeerId, pc);

    // Collect ICE candidates - we'll bundle them with offer/answer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const pending = this.outgoingIceCandidates.get(remotePeerId) || [];
        pending.push(event.candidate.toJSON());
        this.outgoingIceCandidates.set(remotePeerId, pending);
        console.log(`[Multiplayer] Gathered ICE candidate: ${event.candidate.type} ${event.candidate.address}`);
      } else {
        console.log('[Multiplayer] ICE gathering complete');
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`[Multiplayer] Connection state: ${pc!.connectionState}`);
      if (pc!.connectionState === 'connected') {
        this.connectedPeers.add(remotePeerId);
        this.updateConnectionStatus();
        // Stop polling once we have a peer connection - all future communication is P2P
        this.stopPollingIfConnected();
      } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        this.connectedPeers.delete(remotePeerId);
        this.peerConnections.delete(remotePeerId);
        this.dataChannels.delete(remotePeerId);
        this.updateConnectionStatus();
        
        // On localhost, fallback to BroadcastChannel when WebRTC fails
        if (this.broadcastChannel && !this.useLocalFallback) {
          console.log('[Multiplayer] WebRTC failed, enabling BroadcastChannel fallback...');
          this.enableLocalFallback();
        }
      }
    };

    // Handle data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, remotePeerId);
    };

    // Create data channel if we're the initiator
    if (createOffer) {
      console.log('[Multiplayer] Creating data channel...');
      const channel = pc.createDataChannel('yjs');
      this.setupDataChannel(channel, remotePeerId);

      // Create offer and wait for ICE gathering
      console.log('[Multiplayer] Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete (or timeout after 3 seconds)
      console.log('[Multiplayer] Waiting for ICE gathering...');
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkComplete = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          pc.addEventListener('icegatheringstatechange', checkComplete);
          setTimeout(resolve, 3000); // Timeout after 3 seconds
        }
      });
      
      // Bundle ICE candidates WITH the offer to avoid race conditions
      const candidates = this.outgoingIceCandidates.get(remotePeerId) || [];
      console.log(`[Multiplayer] Sending offer with ${candidates.length} ICE candidates bundled`);
      await this.sendSignal('offer', {
        sdp: pc.localDescription!.toJSON(),
        candidates: candidates,
      }, remotePeerId);
      this.outgoingIceCandidates.delete(remotePeerId);
      console.log('[Multiplayer] WebRTC offer sent!');
    }

    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel, remotePeerId: string): void {
    this.dataChannels.set(remotePeerId, channel);

    channel.onopen = () => {
      console.log(`[Multiplayer] Data channel open with ${remotePeerId}`);
      // Sync Y.js document
      this.syncDocument(remotePeerId);
      
      // If we're a guest, request the game state from host
      if (!this.isHost) {
        console.log('[Multiplayer] Guest requesting game state from host...');
        channel.send(JSON.stringify({ type: 'state-request' } as DataChannelMessage));
      }
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, remotePeerId);
    };

    channel.onclose = () => {
      console.log(`[Multiplayer] Data channel closed with ${remotePeerId}`);
      this.dataChannels.delete(remotePeerId);
    };
  }

  private syncDocument(remotePeerId: string): void {
    // Send full Y.js state
    const state = Y.encodeStateAsUpdate(this.doc);
    const channel = this.dataChannels.get(remotePeerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'sync', data: Array.from(state) }));
    }

    // Send awareness state
    const awarenessState = this.awareness.getLocalState();
    if (awarenessState && channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'awareness', data: awarenessState }));
    }
  }

  private handleDataChannelMessage(data: string, remotePeerId: string): void {
    try {
      const message = JSON.parse(data) as DataChannelMessage;

      if (message.type === 'sync') {
        // Apply Y.js update
        const update = new Uint8Array(message.data as number[]);
        Y.applyUpdate(this.doc, update);
      } else if (message.type === 'update') {
        // Apply incremental Y.js update
        const update = new Uint8Array(message.data as number[]);
        Y.applyUpdate(this.doc, update);
      } else if (message.type === 'awareness') {
        // Update remote awareness
        // Note: This is simplified - full awareness protocol is more complex
        this.notifyPlayersChange();
      } else if (message.type === 'state-request') {
        // Guest is requesting game state - send it if we're host
        if (this.isHost && this.initialGameState) {
          console.log('[Multiplayer] Host sending game state to guest...');
          const channel = this.dataChannels.get(remotePeerId);
          if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify({ 
              type: 'state-sync', 
              data: this.initialGameState 
            } as DataChannelMessage));
          }
        }
      } else if (message.type === 'state-sync') {
        // Received game state from host
        console.log('[Multiplayer] Guest received game state from host!');
        if (this.options.onStateReceived && message.data) {
          this.options.onStateReceived(message.data);
        }
      }
    } catch (error) {
      console.error('[Multiplayer] Failed to handle data channel message:', error);
    }
  }

  private async handleOffer(signal: SignalMessage): Promise<void> {
    try {
      // Parse bundled offer (SDP + ICE candidates)
      const payload = signal.payload as { sdp: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] };
      const offerSdp = payload.sdp || signal.payload as RTCSessionDescriptionInit;
      const offerCandidates = payload.candidates || [];
      
      console.log('[Multiplayer] Creating peer connection for offer...');
      const pc = await this.createPeerConnection(signal.from, false);
      
      console.log('[Multiplayer] Setting remote description from offer...');
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      
      // Apply ICE candidates from the bundled offer
      if (offerCandidates.length > 0) {
        console.log(`[Multiplayer] Applying ${offerCandidates.length} ICE candidates from offer`);
        for (const candidate of offerCandidates) {
          try {
            const candidateStr = candidate.candidate || '';
            const parts = candidateStr.split(' ');
            console.log(`[Multiplayer] Adding candidate: ${parts[7] || 'unknown'} ${parts[4] || 'unknown'}`);
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[Multiplayer] Error adding ICE candidate:', e, candidate);
          }
        }
      }
      
      // Apply any buffered ICE candidates that arrived before the offer
      const bufferedCandidates = this.pendingIceCandidates.get(signal.from) || [];
      if (bufferedCandidates.length > 0) {
        console.log(`[Multiplayer] Applying ${bufferedCandidates.length} buffered ICE candidates`);
        for (const candidate of bufferedCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[Multiplayer] Error adding buffered ICE candidate:', e);
          }
        }
        this.pendingIceCandidates.delete(signal.from);
      }
      
      console.log('[Multiplayer] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering (or timeout after 3 seconds)
      console.log('[Multiplayer] Waiting for ICE gathering...');
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkComplete = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          pc.addEventListener('icegatheringstatechange', checkComplete);
          setTimeout(resolve, 3000);
        }
      });
      
      // Bundle ICE candidates WITH the answer
      const candidates = this.outgoingIceCandidates.get(signal.from) || [];
      console.log(`[Multiplayer] Sending answer with ${candidates.length} ICE candidates bundled`);
      await this.sendSignal('answer', {
        sdp: pc.localDescription!.toJSON(),
        candidates: candidates,
      }, signal.from);
      this.outgoingIceCandidates.delete(signal.from);
      console.log('[Multiplayer] Answer sent!');
    } catch (error) {
      console.error('[Multiplayer] Error handling offer:', error);
    }
  }

  private async handleAnswer(signal: SignalMessage): Promise<void> {
    const pc = this.peerConnections.get(signal.from);
    if (pc) {
      // Parse bundled answer (SDP + ICE candidates)
      const payload = signal.payload as { sdp: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] };
      const answerSdp = payload.sdp || signal.payload as RTCSessionDescriptionInit;
      const answerCandidates = payload.candidates || [];
      
      console.log('[Multiplayer] Received answer, setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      
      // Apply ICE candidates from the bundled answer
      if (answerCandidates.length > 0) {
        console.log(`[Multiplayer] Applying ${answerCandidates.length} ICE candidates from answer`);
        for (const candidate of answerCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[Multiplayer] Error adding ICE candidate:', e);
          }
        }
      }
      
      console.log('[Multiplayer] Answer set! Connection should establish...');
    } else {
      console.warn('[Multiplayer] Received answer but no peer connection exists for:', signal.from);
    }
  }

  // ICE candidates are now bundled with offer/answer, this handles legacy separate ice-candidate signals
  private async handleLegacyIceCandidate(signal: SignalMessage): Promise<void> {
    const payload = signal.payload as RTCIceCandidateInit | { candidates: RTCIceCandidateInit[] };
    const candidates = 'candidates' in payload ? payload.candidates : [payload];
    
    const pc = this.peerConnections.get(signal.from);
    if (pc) {
      console.log(`[Multiplayer] Adding ${candidates.length} legacy ICE candidate(s) from:`, signal.from);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('[Multiplayer] Error adding ICE candidate:', error);
        }
      }
    } else {
      console.log(`[Multiplayer] Buffering ${candidates.length} ICE candidate(s) from:`, signal.from);
      const pending = this.pendingIceCandidates.get(signal.from) || [];
      pending.push(...candidates);
      this.pendingIceCandidates.set(signal.from, pending);
    }
  }

  private async sendSignal(type: SignalMessage['type'], payload: unknown, to?: string): Promise<void> {
    try {
      console.log(`[Multiplayer] POST signal: ${type} to ${to || 'broadcast'}`);
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          type,
          from: this.peerId,
          to,
          payload,
        }),
      });
      if (!response.ok) {
        console.error('[Multiplayer] Signal POST failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[Multiplayer] Failed to send signal:', error);
    }
  }

  private stopPollingIfConnected(): void {
    // Once we have at least one peer connected, stop polling Edge Config
    // All future signaling happens over WebRTC data channels
    if (this.connectedPeers.size > 0 && this.pollingInterval) {
      console.log('[Multiplayer] Peer connected! Stopping Edge Config polling - all P2P now');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private updateConnectionStatus(): void {
    const peerCount = this.connectedPeers.size + 1; // +1 for self
    console.log(`[Multiplayer] Connected peers: ${peerCount}`);
    if (this.options.onConnectionChange) {
      this.options.onConnectionChange(true, peerCount);
    }
    this.notifyPlayersChange();
  }

  private notifyPlayersChange(): void {
    if (!this.options.onPlayersChange) return;

    const players: Player[] = [this.player]; // Always include self

    // Add connected peers (in a full implementation, we'd track their player info)
    // For now, we create placeholder players for connected peers
    this.connectedPeers.forEach((peerId) => {
      players.push({
        id: peerId,
        name: `Player ${peerId.slice(-4)}`,
        color: generatePlayerColor(),
        joinedAt: Date.now(),
        isHost: false,
      });
    });

    console.log(`[Multiplayer] Players: ${players.length}`, players.map(p => p.name));
    this.options.onPlayersChange(players);
  }

  // Dispatch an action to all peers
  dispatchAction(action: GameActionInput): void {
    if (this.destroyed) return;

    const fullAction = {
      ...action,
      timestamp: Date.now(),
      playerId: this.peerId,
    } as GameAction;

    // Add to Y.js array
    this.operationsArray.push([fullAction]);

    // Broadcast to all peers via data channels
    const update = Y.encodeStateAsUpdate(this.doc);
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify({ type: 'update', data: Array.from(update) }));
      }
    });
    
    // Also broadcast via BroadcastChannel if using local fallback
    if (this.useLocalFallback && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'update',
        data: Array.from(update),
        from: this.peerId,
      });
    }
  }

  // Update local awareness state
  updateAwareness(update: Partial<AwarenessState>): void {
    if (this.destroyed) return;

    const currentState = this.awareness.getLocalState() as AwarenessState || {};
    this.awareness.setLocalState({
      ...currentState,
      ...update,
      player: this.player,
    });
  }

  // Get all connected players
  getPlayers(): Player[] {
    const players: Player[] = [this.player];
    this.connectedPeers.forEach((peerId) => {
      players.push({
        id: peerId,
        name: `Player ${peerId.slice(-4)}`,
        color: generatePlayerColor(),
        joinedAt: Date.now(),
        isHost: false,
      });
    });
    return players;
  }

  getHost(): Player | undefined {
    return this.getPlayers().find((p) => p.isHost);
  }

  amIHost(): boolean {
    return this.isHost;
  }

  getOperationsSince(index: number): GameAction[] {
    return this.operationsArray.slice(index);
  }

  getAllOperations(): GameAction[] {
    return this.operationsArray.toArray();
  }

  getMeta<T>(key: string): T | undefined {
    return this.metaMap.get(key) as T | undefined;
  }

  setMeta(key: string, value: unknown): void {
    this.metaMap.set(key, value);
  }
  
  // Update the game state that will be sent to new peers
  updateGameState(state: unknown): void {
    this.initialGameState = state;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();
    
    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.awareness.destroy();
    this.doc.destroy();
  }
}

// Create and connect a multiplayer provider
export async function createMultiplayerProvider(
  options: MultiplayerProviderOptions
): Promise<MultiplayerProvider> {
  const provider = new MultiplayerProvider(options);
  await provider.connect();
  return provider;
}
