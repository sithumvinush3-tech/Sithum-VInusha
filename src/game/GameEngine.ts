/**
 * High-performance 60FPS Canvas Physics & Render Engine for Zero-Gravity Trash Sorter.
 */

import { DEBRIS_CATALOG, DebrisItem, Particle, FloatingText, BinZone, GameStats, DebrisCategory } from '../types/game';
import { soundManager } from '../audio/soundManager';

export interface GameEngineCallbacks {
  onScoreUpdate: (score: number, combo: number, maxCombo: number) => void;
  onLivesUpdate: (lives: number) => void;
  onGameOver: (finalScore: number, stats: GameStats) => void;
  onPowerupActivated: (type: string, message: string) => void;
  onSectorChange: (sector: number) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 480;
  private height: number = 720;
  private dpr: number = 1;

  // Game Loop
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  // Game State
  public score: number = 0;
  public lives: number = 3;
  public maxLives: number = 3;
  public combo: number = 0;
  public maxCombo: number = 0;
  public sector: number = 1;

  // Stasis & Magnet Buffs
  public stasisTimer: number = 0; // In seconds
  public magnetTimer: number = 0;

  // Stats
  public stats: GameStats = {
    totalSorted: 0,
    organicSorted: 0,
    metalSorted: 0,
    hazardSorted: 0,
    powerupsUsed: 0,
    maxCombo: 0,
  };

  // Entities
  private debrisList: DebrisItem[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private bins: BinZone[] = [];
  private stars: { x: number; y: number; size: number; speed: number; alpha: number; phase: number }[] = [];

  // Spawning
  private spawnCooldown: number = 0;
  private baseSpawnInterval: number = 1.35; // seconds

  // Camera Shake & Hitstop
  private screenShake: number = 0;
  private hitstopTimer: number = 0;
  private breachDangerFlash: number = 0;

  // Callbacks
  private callbacks: GameEngineCallbacks;

  // Dragging reference
  private activeDraggedItem: DebrisItem | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    this.callbacks = callbacks;

    this.initBins();
    this.initStars();
    this.handleResize();
    this.attachEvents();
  }

  private initBins() {
    this.bins = [
      {
        type: 'organic',
        name: 'Organic',
        label: 'ORGANIC',
        icon: '🌱',
        color: '#22c55e',
        glowColor: 'rgba(34, 197, 94, 0.5)',
        bgRgba: 'rgba(20, 83, 45, 0.45)',
        borderHex: '#4ade80',
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        isHovered: false,
        pulseTimer: 0,
        totalSorted: 0,
      },
      {
        type: 'metal',
        name: 'Metal',
        label: 'METAL',
        icon: '🔩',
        color: '#38bdf8',
        glowColor: 'rgba(56, 189, 248, 0.5)',
        bgRgba: 'rgba(12, 74, 110, 0.45)',
        borderHex: '#7dd3fc',
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        isHovered: false,
        pulseTimer: 0,
        totalSorted: 0,
      },
      {
        type: 'hazard',
        name: 'Hazard',
        label: 'HAZARD',
        icon: '☢️',
        color: '#ef4444',
        glowColor: 'rgba(239, 68, 68, 0.5)',
        bgRgba: 'rgba(127, 29, 29, 0.45)',
        borderHex: '#f87171',
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        isHovered: false,
        pulseTimer: 0,
        totalSorted: 0,
      },
    ];
  }

  private initStars() {
    this.stars = [];
    const count = 65;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.8,
        speed: Math.random() * 0.15 + 0.05,
        alpha: Math.random() * 0.7 + 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public handleResize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || this.canvas.getBoundingClientRect();
    this.width = Math.max(rect.width, 320);
    this.height = Math.max(rect.height, 480);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Recalculate bins layout at bottom
    const binCount = this.bins.length;
    const gap = 10;
    const padding = 12;
    const availableWidth = this.width - padding * 2 - gap * (binCount - 1);
    const binWidth = availableWidth / binCount;
    const binHeight = Math.min(Math.max(this.height * 0.15, 86), 115);
    const binY = this.height - binHeight - 12;

    this.bins.forEach((bin, idx) => {
      bin.width = binWidth;
      bin.height = binHeight;
      bin.x = padding + idx * (binWidth + gap);
      bin.y = binY;
    });
  }

  // Starts or restarts a game session
  public start() {
    this.score = 0;
    this.lives = this.maxLives;
    this.combo = 0;
    this.maxCombo = 0;
    this.sector = 1;
    this.stasisTimer = 0;
    this.magnetTimer = 0;
    this.debrisList = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnCooldown = 0.5; // Quick initial spawn
    this.screenShake = 0;
    this.breachDangerFlash = 0;

    this.stats = {
      totalSorted: 0,
      organicSorted: 0,
      metalSorted: 0,
      hazardSorted: 0,
      powerupsUsed: 0,
      maxCombo: 0,
    };

    this.bins.forEach((b) => {
      b.totalSorted = 0;
      b.isHovered = false;
      b.pulseTimer = 0;
    });

    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();

    this.callbacks.onScoreUpdate(this.score, this.combo, this.maxCombo);
    this.callbacks.onLivesUpdate(this.lives);
    this.callbacks.onSectorChange(this.sector);

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  // Interactive demo mode for Title Screen
  public startTitlePreview() {
    this.debrisList = [];
    this.particles = [];
    this.floatingTexts = [];
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();

    // Spawn 5 gentle floating items for users to drag/play with on Title Screen!
    for (let i = 0; i < 5; i++) {
      this.spawnItem(true);
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (!paused) {
      this.lastTime = performance.now();
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (time: number) => {
    if (!this.isRunning) return;

    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent tunneling on lag

    if (!this.isPaused) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.update(dt);
      }
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private spawnItem(isTitleDemo: boolean = false) {
    // Pick random item from catalog
    // Slightly favor standard items over powerups
    let template = DEBRIS_CATALOG[Math.floor(Math.random() * DEBRIS_CATALOG.length)];
    if (template.category === 'powerup' && Math.random() > 0.35 && !isTitleDemo) {
      // Re-roll to keep powerups rewarding and rare
      const standardItems = DEBRIS_CATALOG.filter((d) => d.category !== 'powerup');
      template = standardItems[Math.floor(Math.random() * standardItems.length)];
    }

    const radius = 28;
    const margin = radius + 15;
    const x = margin + Math.random() * (this.width - margin * 2);
    const y = isTitleDemo ? 100 + Math.random() * (this.height - 280) : -radius - 10;

    // Zero-G drift speed increases gradually with score/sector
    const speedMult = this.stasisTimer > 0 ? 0.4 : 1.0;
    const baseVy = (0.75 + Math.min(this.score / 280, 2.2) + (this.sector - 1) * 0.25) * 60;
    const vy = isTitleDemo ? (Math.random() - 0.5) * 20 : (baseVy + Math.random() * 25) * speedMult;
    const vx = (Math.random() - 0.5) * (isTitleDemo ? 35 : 45);

    const item: DebrisItem = {
      id: Math.random().toString(36).substring(2, 9),
      emoji: template.emoji,
      category: template.category,
      name: template.name,
      glowColor: template.glowColor,
      borderColor: template.borderColor,
      bgColor: template.bgColor,
      points: template.points,
      powerupType: template.powerupType,
      x,
      y,
      vx,
      vy,
      radius,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 1.8,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      lastPositions: [],
      scale: 1,
      pulsePhase: Math.random() * Math.PI * 2,
      isAbsorbed: false,
    };

    this.debrisList.push(item);
  }

  private update(dt: number) {
    // Buff timers
    if (this.stasisTimer > 0) {
      this.stasisTimer -= dt;
      if (this.stasisTimer <= 0) {
        this.stasisTimer = 0;
      }
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) {
        this.magnetTimer = 0;
      }
    }

    // Danger flash decay
    if (this.breachDangerFlash > 0) {
      this.breachDangerFlash = Math.max(0, this.breachDangerFlash - dt * 2);
    }

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Bin pulse timer update
    this.bins.forEach((b) => {
      if (b.pulseTimer > 0) b.pulseTimer = Math.max(0, b.pulseTimer - dt * 3);
    });

    // Sector calculation (every 120 points advance sector)
    const newSector = Math.floor(this.score / 150) + 1;
    if (newSector !== this.sector) {
      this.sector = newSector;
      this.callbacks.onSectorChange(this.sector);
      this.addFloatingText(`SECTOR ${this.sector} REACHED!`, this.width / 2, this.height * 0.35, '#38bdf8', 1.4);
      soundManager.playSuccess(4);
    }

    // Spawning logic (only when game is playing, not in title menu preview)
    const spawnRate = Math.max(0.65, this.baseSpawnInterval - Math.min(this.score / 600, 0.7));
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.lives > 0) {
      this.spawnItem();
      this.spawnCooldown = spawnRate;
    }

    // Update debris items
    const bottomBreachY = this.height - 30;

    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const item = this.debrisList[i];

      // Absorption animation (suction into recycling pod)
      if (item.isAbsorbed) {
        if (!item.absorbedProgress) item.absorbedProgress = 0;
        item.absorbedProgress += dt * 5;
        if (item.absorbTarget) {
          item.x += (item.absorbTarget.x - item.x) * 0.3;
          item.y += (item.absorbTarget.y - item.y) * 0.3;
        }
        item.scale = Math.max(0, 1 - item.absorbedProgress);
        item.rotation += item.vRot * 6 * dt;

        if (item.absorbedProgress >= 1) {
          this.debrisList.splice(i, 1);
        }
        continue;
      }

      // Dragging logic
      if (item.isDragging) {
        // Track positions for throw velocity calculation
        const now = performance.now();
        item.lastPositions.push({ x: item.x, y: item.y, time: now });
        if (item.lastPositions.length > 6) {
          item.lastPositions.shift();
        }

        // Slight scale up while dragging
        item.scale = 1.15;
        item.rotation += item.vRot * 0.5 * dt;

        // Check hover over bins
        this.bins.forEach((bin) => {
          const hovered =
            item.x >= bin.x && item.x <= bin.x + bin.width && item.y >= bin.y && item.y <= bin.y + bin.height + 20;
          bin.isHovered = hovered;
        });

        continue;
      }

      // Magnetic attractor buff
      if (this.magnetTimer > 0 && !item.isDragging) {
        const targetBin = this.bins.find((b) => b.type === item.category);
        if (targetBin) {
          const centerX = targetBin.x + targetBin.width / 2;
          const centerY = targetBin.y + targetBin.height / 2;
          const dx = centerX - item.x;
          const dy = centerY - item.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 10 && dist < 320) {
            item.vx += (dx / dist) * 120 * dt;
            item.vy += (dy / dist) * 120 * dt;
          }
        }
      }

      // Physics drift in zero-g
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.rotation += item.vRot * dt;
      item.pulsePhase += dt * 3;
      item.scale = 1.0;

      // Wall bounce
      if (item.x - item.radius < 4) {
        item.x = item.radius + 4;
        item.vx = Math.abs(item.vx) * 0.85;
      } else if (item.x + item.radius > this.width - 4) {
        item.x = this.width - item.radius - 4;
        item.vx = -Math.abs(item.vx) * 0.85;
      }

      // Ceiling bounce if flicked upward
      if (item.y - item.radius < 4) {
        item.y = item.radius + 4;
        item.vy = Math.abs(item.vy) * 0.7;
      }

      // In-flight bin detection (if flicked/thrown into a bin zone)
      let caughtInBin = false;
      for (const bin of this.bins) {
        if (
          item.x >= bin.x - 5 &&
          item.x <= bin.x + bin.width + 5 &&
          item.y >= bin.y + 10 &&
          item.y <= bin.y + bin.height
        ) {
          // Process sort
          this.processBinDeposit(item, bin);
          caughtInBin = true;
          break;
        }
      }
      if (caughtInBin) continue;

      // Missed debris - drifted past the bottom threshold!
      if (item.y > bottomBreachY) {
        this.debrisList.splice(i, 1);
        this.handleMissedDebris(item);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      p.scale = Math.max(0, p.scale - dt * 0.5);
      if (p.alpha <= 0 || p.scale <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.9;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Stars
    for (const star of this.stars) {
      star.y += star.speed * dt * 0.2;
      if (star.y > 1) star.y = 0;
      star.phase += dt * 2;
    }
  }

  // Handle successful or wrong deposit
  private processBinDeposit(item: DebrisItem, bin: BinZone) {
    const isCorrect = item.category === bin.type || item.category === 'powerup';

    if (item.category === 'powerup') {
      // Powerup effect!
      this.stats.powerupsUsed++;
      this.stats.totalSorted++;
      soundManager.playPowerup();

      if (item.powerupType === 'repair') {
        if (this.lives < this.maxLives) {
          this.lives++;
          this.callbacks.onLivesUpdate(this.lives);
          this.callbacks.onPowerupActivated('repair', 'HULL REPAIRED! +1 INTEGRITY');
          this.addFloatingText('HULL REPAIRED! +1 ❤️', item.x, item.y - 20, '#4ade80', 1.3);
        } else {
          this.score += 75;
          this.callbacks.onScoreUpdate(this.score, this.combo, this.maxCombo);
          this.addFloatingText('MAX HULL BONUS +75', item.x, item.y - 20, '#facc15', 1.2);
        }
      } else if (item.powerupType === 'stasis') {
        this.stasisTimer = 6.0;
        this.callbacks.onPowerupActivated('stasis', 'TIME STASIS ACTIVE (6s)');
        this.addFloatingText('⏳ CHRONO STASIS!', item.x, item.y - 20, '#c084fc', 1.3);
      } else if (item.powerupType === 'magnet') {
        this.magnetTimer = 5.0;
        this.callbacks.onPowerupActivated('magnet', 'MAGNETIC PULSE ACTIVE (5s)');
        this.addFloatingText('🧲 GRAV-PULSE!', item.x, item.y - 20, '#38bdf8', 1.3);
      }

      this.score += item.points;
      this.callbacks.onScoreUpdate(this.score, this.combo, this.maxCombo);
      this.createSuctionEffect(item, bin);
      return;
    }

    if (isCorrect) {
      // Correct Bin!
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
        this.stats.maxCombo = this.maxCombo;
      }

      // Multiplier bonus: 1x, 1.5x, 2x, etc.
      const comboMult = 1 + Math.min(Math.floor(this.combo / 3) * 0.5, 2.5);
      const earnedPoints = Math.round(item.points * comboMult);
      this.score += earnedPoints;

      // Stats
      this.stats.totalSorted++;
      if (bin.type === 'organic') this.stats.organicSorted++;
      if (bin.type === 'metal') this.stats.metalSorted++;
      if (bin.type === 'hazard') this.stats.hazardSorted++;

      bin.totalSorted++;
      bin.pulseTimer = 1.0;

      // Audio feedback
      soundManager.playSuccess(this.combo);

      // Visual feedback
      const comboLabel = this.combo >= 3 ? ` (${comboMult}x STREAK!)` : '';
      this.addFloatingText(`+${earnedPoints}${comboLabel}`, item.x, item.y - 25, bin.color, 1.15);

      this.createSuctionEffect(item, bin);
      this.createBurstParticles(bin.x + bin.width / 2, bin.y + 20, bin.color, 24);

      this.callbacks.onScoreUpdate(this.score, this.combo, this.maxCombo);
    } else {
      // Wrong Bin! Costs 1 life
      this.handleMistake(`WRONG BIN! (${item.category.toUpperCase()} ≠ ${bin.name.toUpperCase()})`);
      this.createDisintegrationParticles(item.x, item.y, '#ef4444', 30);
      item.isAbsorbed = true;
      item.absorbedProgress = 1; // Instant removal
    }
  }

  private handleMissedDebris(item: DebrisItem) {
    if (item.category === 'powerup') {
      // Powerup missed doesn't hurt hull integrity
      this.addFloatingText('POWERUP LOST', item.x, this.height - 60, '#94a3b8', 1.0);
      return;
    }

    this.handleMistake(`DRIFTED OFF SCREEN! (${item.name})`);
    this.createDisintegrationParticles(item.x, this.height - 40, '#ef4444', 24);
  }

  private handleMistake(reason: string) {
    this.lives--;
    this.combo = 0;
    this.screenShake = 16;
    this.hitstopTimer = 0.06;
    this.breachDangerFlash = 1.0;

    soundManager.playError();
    this.addFloatingText(`-1 HULL INTEGRITY!`, this.width / 2, this.height * 0.45, '#ef4444', 1.4);
    this.callbacks.onLivesUpdate(this.lives);
    this.callbacks.onScoreUpdate(this.score, this.combo, this.maxCombo);

    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver() {
    this.isRunning = false;
    soundManager.playGameOver();
    this.callbacks.onGameOver(this.score, this.stats);
  }

  private createSuctionEffect(item: DebrisItem, bin: BinZone) {
    item.isAbsorbed = true;
    item.absorbTarget = {
      x: bin.x + bin.width / 2,
      y: bin.y + bin.height / 2,
    };
  }

  private createBurstParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1.5,
        color,
        alpha: 1,
        decay: Math.random() * 1.5 + 1.2,
        scale: 1,
      });
    }
  }

  private createDisintegrationParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        radius: Math.random() * 4 + 2,
        color,
        alpha: 1,
        decay: Math.random() * 2 + 1.5,
        scale: 1.2,
      });
    }
  }

  public addFloatingText(text: string, x: number, y: number, color: string, scale: number = 1.0) {
    this.floatingTexts.push({
      id: Math.random().toString(36),
      text,
      x: Math.max(80, Math.min(this.width - 80, x)),
      y: Math.max(60, y),
      color,
      alpha: 1,
      vy: -55,
      scale,
    });
  }

  // Pointer Event Handling
  private attachEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  public destroy() {
    this.stop();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private getCanvasCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    const coords = this.getCanvasCoords(e);

    // Look for hit on topmost debris item
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const item = this.debrisList[i];
      if (item.isAbsorbed) continue;

      const dx = coords.x - item.x;
      const dy = coords.y - item.y;
      const hitRadius = item.radius * 1.35; // Generous touch target
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        this.activeDraggedItem = item;
        item.isDragging = true;
        item.pointerId = e.pointerId;
        item.dragStartX = dx;
        item.dragStartY = dy;
        item.vx = 0;
        item.vy = 0;
        item.lastPositions = [{ x: item.x, y: item.y, time: performance.now() }];

        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }

        soundManager.playGrab();
        // Bring to front
        this.debrisList.splice(i, 1);
        this.debrisList.push(item);
        break;
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activeDraggedItem || this.activeDraggedItem.pointerId !== e.pointerId) return;

    const coords = this.getCanvasCoords(e);
    const item = this.activeDraggedItem;

    item.x = coords.x - item.dragStartX;
    item.y = coords.y - item.dragStartY;

    // Boundaries
    const minX = item.radius;
    const maxX = this.width - item.radius;
    const minY = item.radius + 10;
    const maxY = this.height - 20;

    item.x = Math.max(minX, Math.min(maxX, item.x));
    item.y = Math.max(minY, Math.min(maxY, item.y));
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.activeDraggedItem || this.activeDraggedItem.pointerId !== e.pointerId) return;

    const item = this.activeDraggedItem;
    item.isDragging = false;
    this.activeDraggedItem = null;

    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Reset bin hovers
    this.bins.forEach((b) => (b.isHovered = false));

    // Calculate throw velocity from pointer history
    let throwVx = 0;
    let throwVy = 0;
    if (item.lastPositions.length >= 2) {
      const now = performance.now();
      const recent = item.lastPositions.filter((p) => now - p.time <= 140);
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.01) {
          throwVx = (last.x - first.x) / dt;
          throwVy = (last.y - first.y) / dt;
        }
      }
    }

    // Cap velocity
    const maxSpeed = 800;
    const speed = Math.sqrt(throwVx * throwVx + throwVy * throwVy);
    if (speed > 80) {
      soundManager.playThrow();
      if (speed > maxSpeed) {
        throwVx = (throwVx / speed) * maxSpeed;
        throwVy = (throwVy / speed) * maxSpeed;
      }
      item.vx = throwVx;
      item.vy = throwVy;
    } else {
      // Gentle zero-g drift downward
      item.vx = (Math.random() - 0.5) * 40;
      item.vy = 45;
    }

    // Immediate check if released directly inside a bin zone
    for (const bin of this.bins) {
      if (
        item.x >= bin.x - 10 &&
        item.x <= bin.x + bin.width + 10 &&
        item.y >= bin.y - 15 &&
        item.y <= bin.y + bin.height + 25
      ) {
        this.processBinDeposit(item, bin);
        break;
      }
    }
  };

  // Rendering
  private render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Apply Camera Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Clear & Deep Space Background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Cosmic Nebula Glow
    const gradient = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.4,
      50,
      this.width * 0.5,
      this.height * 0.4,
      this.width * 0.9
    );
    gradient.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
    gradient.addColorStop(0.6, 'rgba(15, 23, 42, 0.35)');
    gradient.addColorStop(1, 'rgba(6, 10, 20, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars
    for (const star of this.stars) {
      const sx = star.x * this.width;
      const sy = star.y * this.height;
      const alpha = star.alpha * (0.6 + 0.4 * Math.sin(star.phase));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Danger Zone / Atmospheric Re-entry Breach Threshold Line
    const dangerY = this.height - 130;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(10, dangerY);
    ctx.lineTo(this.width - 10, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hull breach alert overlay flash
    if (this.breachDangerFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${(this.breachDangerFlash * 0.25).toFixed(2)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Render Recycling Bins at bottom
    this.renderBins(ctx);

    // Render Floating Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Debris Items
    for (const item of this.debrisList) {
      this.renderDebrisItem(ctx, item);
    }

    // Render Floating Text Popups
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${Math.round(15 * ft.scale)}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderBins(ctx: CanvasRenderingContext2D) {
    for (const bin of this.bins) {
      ctx.save();

      const pulse = Math.sin(Date.now() * 0.005) * 2;
      const isExpanded = bin.isHovered || bin.pulseTimer > 0;
      const lift = isExpanded ? 4 : 0;

      const bx = bin.x;
      const by = bin.y - lift;
      const bw = bin.width;
      const bh = bin.height;
      const radius = 12;

      // Bin Container Box
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);

      // Gradient Fill
      const bgGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      if (isExpanded) {
        bgGrad.addColorStop(0, bin.bgRgba);
        bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      } else {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
        bgGrad.addColorStop(1, 'rgba(6, 10, 20, 0.95)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // Border with Laser Acceptance Field
      ctx.lineWidth = isExpanded ? 2.5 : 1.5;
      ctx.strokeStyle = bin.borderHex;
      ctx.shadowColor = bin.glowColor;
      ctx.shadowBlur = isExpanded ? 16 + pulse : 6;
      ctx.stroke();

      // Top Laser Intake Beam
      ctx.beginPath();
      ctx.moveTo(bx + 12, by);
      ctx.lineTo(bx + bw - 12, by);
      ctx.lineWidth = 3;
      ctx.strokeStyle = bin.color;
      ctx.stroke();

      // Bin Header Icon & Name
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';

      // Icon
      ctx.font = '24px sans-serif';
      ctx.fillText(bin.icon, bx + bw / 2, by + 34);

      // Category Label
      ctx.font = `bold 12px 'Space Mono', monospace`;
      ctx.fillStyle = bin.color;
      ctx.fillText(bin.label, bx + bw / 2, by + 58);

      // Counter / Stats readout
      ctx.font = `500 11px 'Outfit', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(`Sorted: ${bin.totalSorted}`, bx + bw / 2, by + 76);

      ctx.restore();
    }
  }

  private renderDebrisItem(ctx: CanvasRenderingContext2D, item: DebrisItem) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.scale(item.scale, item.scale);

    const r = item.radius;

    // Glowing Aura for special powerups or dragged items
    if (item.isDragging || item.category === 'powerup') {
      ctx.shadowColor = item.glowColor;
      ctx.shadowBlur = item.isDragging ? 22 : 14;
    } else {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 6;
    }

    // Outer Bubble / Pressure Pod
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = item.bgColor;
    ctx.fill();

    // Border ring
    ctx.lineWidth = item.isDragging ? 2.5 : 1.5;
    ctx.strokeStyle = item.borderColor;
    ctx.stroke();

    // Specular Highlight
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.35, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Emoji glyph center
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(r * 1.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, 0, 1);

    ctx.restore();

    // If near the breach line, render a pulsating danger warning ring
    const distToBreach = this.height - 110 - item.y;
    if (distToBreach > 0 && distToBreach < 75 && !item.isDragging && !item.isAbsorbed) {
      ctx.save();
      const warningAlpha = Math.max(0, 1 - distToBreach / 75) * (0.5 + 0.5 * Math.sin(Date.now() * 0.015));
      ctx.strokeStyle = `rgba(239, 68, 68, ${warningAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
