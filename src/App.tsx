/**
 * Zero-Gravity Trash Sorter - Main Game Shell
 * Follows Game Craft Guidelines: Full-viewport shell, low-occlusion HUD,
 * 60fps isolated canvas physics loop, bespoke inline SVG title lockup, procedural Web Audio.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  Flame,
  Zap,
  HelpCircle,
  X,
  Radio,
} from 'lucide-react';
import { GameEngine } from './game/GameEngine';
import { GameState, GameStats } from './types/game';
import { soundManager } from './audio/soundManager';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Shell State
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('zerog_highscore') || '0');
    } catch {
      return 0;
    }
  });
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [sector, setSector] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.getMuted());
  const [showHowToPlayModal, setShowHowToPlayModal] = useState<boolean>(false);
  const [activeBuffMessage, setActiveBuffMessage] = useState<string | null>(null);
  const [finalStats, setFinalStats] = useState<GameStats>({
    totalSorted: 0,
    organicSorted: 0,
    metalSorted: 0,
    hazardSorted: 0,
    powerupsUsed: 0,
    maxCombo: 0,
  });

  // Keep track of new high score beat
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);

  // Initialize Game Engine on Canvas mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, {
      onScoreUpdate: (newScore, currentCombo, currentMaxCombo) => {
        setScore(newScore);
        setCombo(currentCombo);
        setMaxCombo(currentMaxCombo);

        setHighScore((prev) => {
          if (newScore > prev) {
            try {
              localStorage.setItem('zerog_highscore', String(newScore));
            } catch {
              // ignore
            }
            return newScore;
          }
          return prev;
        });
      },
      onLivesUpdate: (newLives) => {
        setLives(newLives);
      },
      onGameOver: (finalScore, stats) => {
        setScore(finalScore);
        setFinalStats(stats);
        setGameState('GAME_OVER');

        const savedHigh = Number(localStorage.getItem('zerog_highscore') || '0');
        if (finalScore > savedHigh) {
          setIsNewHighScore(true);
          try {
            localStorage.setItem('zerog_highscore', String(finalScore));
          } catch {
            // ignore
          }
          setHighScore(finalScore);
        } else {
          setIsNewHighScore(false);
        }
      },
      onPowerupActivated: (_type, message) => {
        setActiveBuffMessage(message);
        setTimeout(() => {
          setActiveBuffMessage(null);
        }, 3200);
      },
      onSectorChange: (newSector) => {
        setSector(newSector);
      },
    });

    engineRef.current = engine;
    engine.startTitlePreview();

    const handleResize = () => {
      engine.handleResize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.destroy();
    };
  }, []);

  // Keyboard Shortcuts (Space/Enter to start or unpause, Esc/P to pause, M to mute, R to restart)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid interference if modal is open or typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === 'TITLE_MENU') {
          e.preventDefault();
          handleStartGame();
        } else if (gameState === 'GAME_OVER') {
          e.preventDefault();
          handleStartGame();
        } else if (gameState === 'PAUSED') {
          e.preventDefault();
          handleResume();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING') {
          e.preventDefault();
          handlePause();
        } else if (gameState === 'PAUSED') {
          e.preventDefault();
          handleResume();
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.code === 'KeyR' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        e.preventDefault();
        handleStartGame();
      }
    };

    const handleBlur = () => {
      // Clear held state on blur
      if (gameState === 'PLAYING') {
        handlePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  const handleStartGame = useCallback(() => {
    if (!engineRef.current) return;
    setIsNewHighScore(false);
    setGameState('PLAYING');
    engineRef.current.start();
  }, []);

  const handlePause = useCallback(() => {
    if (!engineRef.current) return;
    setGameState('PAUSED');
    engineRef.current.setPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    if (!engineRef.current) return;
    setGameState('PLAYING');
    engineRef.current.setPaused(false);
  }, []);

  const handleReturnToTitle = useCallback(() => {
    if (!engineRef.current) return;
    setGameState('TITLE_MENU');
    engineRef.current.startTitlePreview();
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#050811] text-white overflow-hidden flex flex-col items-center justify-center select-none font-sans">
      {/* Game Window Container - Centered arcade frame with adaptive max width */}
      <main
        className="relative w-full max-w-[540px] h-full sm:h-[94vh] sm:max-h-[820px] bg-[#090d16] sm:rounded-2xl overflow-hidden sm:border sm:border-sky-500/30 sm:shadow-[0_0_50px_rgba(56,189,248,0.22)] flex flex-col"
        aria-label="Zero-Gravity Trash Sorter Game"
      >
        {/* ==================================================================== */}
        {/* 1. HUD: PERIMETER STATUS CLUSTERS (Low Occlusion, Pointer-Events-None) */}
        {/* ==================================================================== */}
        <header
          className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between border-b border-white/10 bg-slate-950/70 backdrop-blur-xs pointer-events-auto"
          aria-label="Game Status Bar"
        >
          {/* Left Cluster: Score & Streak */}
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] tracking-wider font-mono text-slate-400 uppercase">Score</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white leading-none">
                {score}
              </div>
            </div>

            {combo >= 2 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 animate-pulse text-xs font-mono font-bold">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{combo}x Streak</span>
              </div>
            )}
          </div>

          {/* Center Cluster: Sector Indicator */}
          <div className="hidden min-[380px]:flex flex-col items-center">
            <div className="text-[9px] tracking-wider font-mono text-sky-400 uppercase">Sector</div>
            <div className="text-xs font-mono font-bold text-sky-200">
              0{sector} · ORBIT
            </div>
          </div>

          {/* Right Cluster: Hull Integrity & Quick Controls */}
          <div className="flex items-center gap-3">
            {/* Hull Integrity (Lives) */}
            <div className="flex flex-col items-end">
              <div className="text-[10px] tracking-wider font-mono text-slate-400 uppercase">Hull Integrity</div>
              <div className="flex items-center gap-1.5 mt-0.5" title={`${lives}/3 Hull Integrity`}>
                {[1, 2, 3].map((shieldIdx) => {
                  const isActive = shieldIdx <= lives;
                  return (
                    <div
                      key={shieldIdx}
                      className={`w-4 h-4 rounded-xs flex items-center justify-center transition-colors duration-200 ${
                        isActive
                          ? lives === 1
                            ? 'bg-red-500/30 text-red-400 border border-red-500 animate-pulse'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-400/50'
                          : 'bg-slate-800/60 text-slate-600 border border-slate-700/50'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" fill={isActive ? 'currentColor' : 'none'} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sound & Pause Buttons */}
            <div className="flex items-center gap-1 border-l border-white/15 pl-2">
              <button
                type="button"
                onClick={handleToggleMute}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title={isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)'}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {gameState === 'PLAYING' && (
                <button
                  type="button"
                  onClick={handlePause}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Pause Game (P or Esc)"
                  aria-label="Pause game"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}

              {gameState === 'PAUSED' && (
                <button
                  type="button"
                  onClick={handleResume}
                  className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  title="Resume Game (Space)"
                  aria-label="Resume game"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Buff Banner Alert (Stasis, Repair, Grav-Pulse) */}
        {activeBuffMessage && (
          <div className="absolute top-16 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
            <div className="bg-sky-950/90 border border-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.4)] text-sky-200 text-xs font-mono font-bold px-3 py-1.5 rounded-md flex items-center gap-2 animate-bounce">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>{activeBuffMessage}</span>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 2. ISOLATED 60FPS CANVAS PLAYFIELD (React never re-renders physics)  */}
        {/* ==================================================================== */}
        <div className="relative flex-1 w-full h-full overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            className="w-full h-full block cursor-grab active:cursor-grabbing touch-none select-none"
          />
        </div>

        {/* ==================================================================== */}
        {/* 3. TITLE SCREEN MODAL (Bespoke SVG lockup, 30-40% negative space)    */}
        {/* ==================================================================== */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-xs flex flex-col justify-between p-6 sm:p-8 animate-in fade-in duration-300">
            {/* Top Bar inside title screen: High Score indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span>ORBITAL RECYCLING BAY 04</span>
              </div>
              {highScore > 0 && (
                <div className="flex items-center gap-1 text-amber-300 font-bold">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="tabular-nums">BEST: {highScore}</span>
                </div>
              )}
            </div>

            {/* Center Area: Title Lockup & Concept */}
            <div className="my-auto flex flex-col items-center text-center max-w-sm mx-auto">
              {/* Bespoke Inline SVG Emblem / Title Lockup */}
              <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                <svg
                  className="w-full h-full text-sky-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.6)]"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="50" cy="50" r="42" strokeDasharray="6 4" className="opacity-40 animate-spin" style={{ animationDuration: '24s' }} />
                  <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="2" className="opacity-80" />
                  <path d="M50 18 L50 32 M50 68 L50 82 M18 50 L32 50 M68 50 L82 50" strokeWidth="2.5" strokeLinecap="round" />
                  <polygon points="50,38 60,56 40,56" fill="rgba(56,189,248,0.3)" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 leading-none">
                Zero-G <span className="text-sky-400">Trash Sorter</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Floating space debris is breaching the orbital bay! <br />
                <span className="text-white font-medium">Drag, fling, and sort</span> each item into its matching pod before it drifts past.
              </p>

              {/* Pod Quick Legend Cards */}
              <div className="grid grid-cols-3 gap-2 w-full mb-6 text-left">
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                  <div className="text-lg">🌱</div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase font-mono">Organic</div>
                  <div className="text-[10px] text-slate-400 leading-tight">Banana, apple, moss spores</div>
                </div>

                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/30">
                  <div className="text-lg">🔩</div>
                  <div className="text-[11px] font-bold text-sky-400 uppercase font-mono">Metal</div>
                  <div className="text-[10px] text-slate-400 leading-tight">Bolts, cans, cogwheels</div>
                </div>

                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30">
                  <div className="text-lg">☢️</div>
                  <div className="text-[11px] font-bold text-rose-400 uppercase font-mono">Hazard</div>
                  <div className="text-[10px] text-slate-400 leading-tight">Nuclear, acid, fuel cells</div>
                </div>
              </div>

              {/* Start CTA Button */}
              <button
                type="button"
                onClick={handleStartGame}
                className="w-full py-3.5 px-6 rounded-xl bg-sky-400 hover:bg-sky-300 active:scale-98 text-slate-950 font-bold text-base transition-all duration-150 shadow-[0_0_30px_rgba(56,189,248,0.5)] cursor-pointer"
              >
                Start Protocol
              </button>
            </div>

            {/* Bottom Flat Control Hint Line */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-white/10 gap-2">
              <span className="font-mono">Click & Drag to Sort · Space to Pause · Esc Quit</span>
              <button
                type="button"
                onClick={() => setShowHowToPlayModal(true)}
                className="hover:text-sky-300 underline underline-offset-2 transition-colors cursor-pointer"
              >
                Rules & Power-ups
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. PAUSE SCREEN MODAL                                                */}
        {/* ==================================================================== */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-sky-500/10 border border-sky-400/40 flex items-center justify-center mb-4 text-sky-400">
              <Pause className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Sorting Suspended</h2>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              CURRENT SCORE: {score} · SECTOR 0{sector}
            </p>

            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                type="button"
                onClick={handleResume}
                className="w-full py-3 px-4 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-sm transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer"
              >
                Resume Protocol [Space]
              </button>

              <button
                type="button"
                onClick={handleStartGame}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Restart Sector [R]
              </button>

              <button
                type="button"
                onClick={handleReturnToTitle}
                className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
              >
                Abort to Main Menu
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 5. GAME OVER MODAL (Hull Breach Debriefing)                          */}
        {/* ==================================================================== */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-30 bg-slate-950/92 backdrop-blur-xs flex flex-col justify-between p-6 sm:p-8 text-center animate-in zoom-in-95 duration-250">
            {/* Header Breach Alert */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-mono font-bold tracking-wider uppercase mb-2 animate-pulse">
                Hull Integrity Depleted
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white mb-1">
                Recycling Bay Breached!
              </h2>
              <p className="text-xs text-slate-400">
                Critical debris overload occurred in Orbital Sector 0{sector}.
              </p>
            </div>

            {/* Score Showcase & Stats Table */}
            <div className="my-auto max-w-sm mx-auto w-full">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 mb-4 shadow-inner">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Final Score</div>
                <div className="text-4xl font-extrabold font-mono text-sky-400 tabular-nums">
                  {score}
                </div>

                {isNewHighScore && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-xs font-bold font-mono">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    NEW BEST RECORD!
                  </div>
                )}
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 text-left text-xs font-mono mb-4">
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="text-slate-400 text-[10px]">TOTAL RECYCLED</div>
                  <div className="text-white font-bold text-sm tabular-nums">
                    {finalStats.totalSorted} items
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="text-slate-400 text-[10px]">MAX COMBO STREAK</div>
                  <div className="text-amber-400 font-bold text-sm tabular-nums">
                    {finalStats.maxCombo}x streak
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5 col-span-2 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px]">CATEGORY SORTING:</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400 font-bold">🌱 {finalStats.organicSorted}</span>
                    <span className="text-sky-400 font-bold">🔩 {finalStats.metalSorted}</span>
                    <span className="text-rose-400 font-bold">☢️ {finalStats.hazardSorted}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="w-full py-3.5 px-6 rounded-xl bg-sky-400 hover:bg-sky-300 active:scale-98 text-slate-950 font-bold text-sm transition-all shadow-[0_0_25px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reboot System [Space or Enter]</span>
                </button>

                <button
                  type="button"
                  onClick={handleReturnToTitle}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Return to Menu
                </button>
              </div>
            </div>

            {/* Hint */}
            <div className="text-[11px] text-slate-500 font-mono">
              Flick debris swiftly with cursor velocity for high-speed sorting streaks!
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 6. RULES & POWERUPS MODAL                                            */}
        {/* ==================================================================== */}
        {showHowToPlayModal && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-sky-400/30 rounded-2xl p-5 max-w-sm w-full text-slate-200 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowHowToPlayModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-400" />
                <span>Station Flight Manual</span>
              </h3>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <h4 className="font-bold text-sky-300 uppercase tracking-wider text-[10px] font-mono mb-1">
                    Primary Directives
                  </h4>
                  <p className="text-slate-300">
                    Floating space debris drifts downwards due to zero-G exhaust currents. Drag or flick items into the correct recycling pod before they reach the bottom hull line.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌱</span>
                    <span className="font-bold text-emerald-400">Organic Pod:</span>
                    <span className="text-slate-400">Banana peels, apples, leaves, bio-moss</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔩</span>
                    <span className="font-bold text-sky-400">Metal Pod:</span>
                    <span className="text-slate-400">Bolts, cogs, soda cans, antennas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">☢️</span>
                    <span className="font-bold text-rose-400">Hazard Pod:</span>
                    <span className="text-slate-400">Toxic barrels, radioactive cells, acids</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sky-300 uppercase tracking-wider text-[10px] font-mono mb-1">
                    Special Station Supplies
                  </h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-base">🛠️</span>
                      <span><b>Nanite Repair Kit:</b> Drop into any bin to restore +1 Hull Life.</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-base">⏳</span>
                      <span><b>Stasis Field:</b> Drops debris drift velocity by 60% for 6 seconds.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>Misplaced item or breach = -1 Life</span>
                  <button
                    type="button"
                    onClick={() => setShowHowToPlayModal(false)}
                    className="px-3 py-1 bg-sky-400 text-slate-950 font-bold rounded-lg hover:bg-sky-300 transition-colors cursor-pointer"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
