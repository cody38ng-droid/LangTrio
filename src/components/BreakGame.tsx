import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Clock, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';

interface BreakGameProps {
  setShowBreakGame: (show: boolean) => void;
  timeLeft: number;
}

export const BreakGame = ({ setShowBreakGame, timeLeft }: BreakGameProps) => {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [snake, setSnake] = useState<{ x: number; y: number }[]>([]);
  const [food, setFood] = useState<{ x: number; y: number; color: string }[]>([]);
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [npcs, setNpcs] = useState<{ snake: { x: number; y: number }[]; angle: number; color: string; speed: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const mousePos = useRef({ x: 250, y: 250 });
  const containerRef = useRef<HTMLDivElement>(null);

  const SNAKE_SIZE = 12;
  const FOOD_COUNT = 150;
  const ARENA_SIZE = 2500;
  const NPC_COUNT = 8;

  const resetGame = () => {
    const startX = ARENA_SIZE / 2;
    const startY = ARENA_SIZE / 2;
    const initialSnake = [];
    for (let i = 0; i < 20; i++) {
      initialSnake.push({ x: startX - i * 5, y: startY });
    }
    setSnake(initialSnake);
    
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
    const initialFood = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      initialFood.push({
        x: Math.random() * ARENA_SIZE,
        y: Math.random() * ARENA_SIZE,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    setFood(initialFood);

    const initialNpcs = [];
    for (let i = 0; i < NPC_COUNT; i++) {
      const nx = Math.random() * ARENA_SIZE;
      const ny = Math.random() * ARENA_SIZE;
      const nSnake = [];
      for (let j = 0; j < 15; j++) {
        nSnake.push({ x: nx - j * 5, y: ny });
      }
      initialNpcs.push({
        snake: nSnake,
        angle: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 1.5 + Math.random() * 1.5
      });
    }
    setNpcs(initialNpcs);

    setScore(0);
    setGameState('START');
    setAngle(0);
    setSpeed(3.5);
  };

  useEffect(() => {
    if (timeLeft <= 0 && gameState === 'PLAYING') {
      setGameState('GAME_OVER');
      toast.info("Total break time is up! Time to get back to learning. 🥳");
    }
  }, [timeLeft, gameState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    resetGame();
  }, []);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      const mouseEvent = e as React.MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    mousePos.current = { x, y };
  };

  const update = () => {
    if (gameState !== 'PLAYING') return;

    setSnake(prev => {
      if (prev.length === 0) return prev;
      const head = prev[0];
      const targetAngle = Math.atan2(mousePos.current.y - 250, mousePos.current.x - 250);
      
      let diff = targetAngle - angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const newAngle = angle + diff * 0.1;
      setAngle(newAngle);

      const newHead = {
        x: head.x + Math.cos(newAngle) * speed,
        y: head.y + Math.sin(newAngle) * speed
      };

      if (newHead.x < 0 || newHead.x > ARENA_SIZE || newHead.y < 0 || newHead.y > ARENA_SIZE) {
        setGameState('GAME_OVER');
        toast.error("You hit the boundary! Back to study? 📚");
        return prev;
      }

      const newSnake = [newHead];
      for (let i = 1; i < prev.length; i++) {
        const dx = newSnake[i - 1].x - prev[i].x;
        const dy = newSnake[i - 1].y - prev[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = 5;
        
        if (distance > minDistance) {
          const angleToPrev = Math.atan2(dy, dx);
          newSnake.push({
            x: newSnake[i - 1].x - Math.cos(angleToPrev) * minDistance,
            y: newSnake[i - 1].y - Math.sin(angleToPrev) * minDistance
          });
        } else {
          newSnake.push(prev[i]);
        }
      }

      setFood(prevFood => {
        const nextFood = [...prevFood];
        for (let i = 0; i < nextFood.length; i++) {
          const f = nextFood[i];
          const dist = Math.sqrt(Math.pow(newHead.x - f.x, 2) + Math.pow(newHead.y - f.y, 2));
          if (dist < SNAKE_SIZE + 5) {
            nextFood[i] = {
              x: Math.random() * ARENA_SIZE,
              y: Math.random() * ARENA_SIZE,
              color: f.color
            };
            setScore(s => s + 1);
            for (let j = 0; j < 5; j++) {
              newSnake.push({ ...newSnake[newSnake.length - 1] });
            }
          }
        }
        return nextFood;
      });

      for (const npc of npcs) {
        for (let i = 0; i < npc.snake.length; i++) {
          const segment = npc.snake[i];
          const dist = Math.sqrt(Math.pow(newHead.x - segment.x, 2) + Math.pow(newHead.y - segment.y, 2));
          if (dist < SNAKE_SIZE) {
            setGameState('GAME_OVER');
            toast.error("You crashed into another snake! 🐍");
            const droppedFood = prev.filter((_, idx) => idx % 3 === 0).map(s => ({
              x: s.x + (Math.random() - 0.5) * 10,
              y: s.y + (Math.random() - 0.5) * 10,
              color: '#3b82f6'
            }));
            setFood(f => [...f, ...droppedFood]);
            return prev;
          }
        }
      }

      return newSnake;
    });

    setNpcs(prevNpcs => {
      return prevNpcs.map(npc => {
        let newAngle = npc.angle + (Math.random() - 0.5) * 0.2;
        const head = npc.snake[0];
        let nextHead = {
          x: head.x + Math.cos(newAngle) * npc.speed,
          y: head.y + Math.sin(newAngle) * npc.speed
        };

        if (nextHead.x < 0 || nextHead.x > ARENA_SIZE || nextHead.y < 0 || nextHead.y > ARENA_SIZE) {
          newAngle += Math.PI;
          nextHead = {
            x: head.x + Math.cos(newAngle) * npc.speed,
            y: head.y + Math.sin(newAngle) * npc.speed
          };
        }

        const newSnake = [nextHead];
        for (let i = 1; i < npc.snake.length; i++) {
          const dx = newSnake[i - 1].x - npc.snake[i].x;
          const dy = newSnake[i - 1].y - npc.snake[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = 5;
          if (distance > minDistance) {
            const angleToPrev = Math.atan2(dy, dx);
            newSnake.push({
              x: newSnake[i - 1].x - Math.cos(angleToPrev) * minDistance,
              y: newSnake[i - 1].y - Math.sin(angleToPrev) * minDistance
            });
          } else {
            newSnake.push(npc.snake[i]);
          }
        }

        for (let i = 0; i < snake.length; i++) {
          const pSegment = snake[i];
          const d = Math.sqrt(Math.pow(nextHead.x - pSegment.x, 2) + Math.pow(nextHead.y - pSegment.y, 2));
          if (d < SNAKE_SIZE) {
            const nx = Math.random() * ARENA_SIZE;
            const ny = Math.random() * ARENA_SIZE;
            const droppedFood = npc.snake.filter((_, idx) => idx % 2 === 0).map(s => ({
              x: s.x + (Math.random() - 0.5) * 10,
              y: s.y + (Math.random() - 0.5) * 10,
              color: npc.color
            }));
            setFood(f => [...f, ...droppedFood]);
            const respawnSnake = [];
            for (let j = 0; j < 15; j++) respawnSnake.push({ x: nx, y: ny });
            return { ...npc, snake: respawnSnake, angle: Math.random() * Math.PI * 2 };
          }
        }

        for (const otherNpc of prevNpcs) {
          if (otherNpc === npc) continue;
          for (let i = 0; i < otherNpc.snake.length; i++) {
            const segment = otherNpc.snake[i];
            const d = Math.sqrt(Math.pow(nextHead.x - segment.x, 2) + Math.pow(nextHead.y - segment.y, 2));
            if (d < SNAKE_SIZE) {
              const nx = Math.random() * ARENA_SIZE;
              const ny = Math.random() * ARENA_SIZE;
              const droppedFood = npc.snake.filter((_, idx) => idx % 2 === 0).map(s => ({
                x: s.x + (Math.random() - 0.5) * 10,
                y: s.y + (Math.random() - 0.5) * 10,
                color: npc.color
              }));
              setFood(f => [...f, ...droppedFood]);
              const respawnSnake = [];
              for (let j = 0; j < 15; j++) respawnSnake.push({ x: nx, y: ny });
              return { ...npc, snake: respawnSnake, angle: Math.random() * Math.PI * 2 };
            }
          }
        }
        return { ...npc, snake: newSnake, angle: newAngle };
      });
    });

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, angle, speed, snake, npcs, food]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const head = snake[0] || { x: ARENA_SIZE / 2, y: ARENA_SIZE / 2 };
    ctx.translate(250 - head.x, 250 - head.y);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5000, -5000, 10000, 5000);
    ctx.fillRect(-5000, ARENA_SIZE, 10000, 5000);
    ctx.fillRect(-5000, 0, 5000, ARENA_SIZE);
    ctx.fillRect(ARENA_SIZE, 0, 5000, ARENA_SIZE);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= ARENA_SIZE; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, ARENA_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(ARENA_SIZE, i);
      ctx.stroke();
    }

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 15;
    ctx.lineJoin = 'round';
    ctx.strokeRect(0, 0, ARENA_SIZE, ARENA_SIZE);

    food.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    npcs.forEach(npc => {
      npc.snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? npc.color : `${npc.color}99`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, SNAKE_SIZE - (i * 0.1 > 5 ? 5 : i * 0.1), 0, Math.PI * 2);
        ctx.fill();
      });
    });

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#3b82f6' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(s.x, s.y, SNAKE_SIZE - (i * 0.1 > 5 ? 5 : i * 0.1), 0, Math.PI * 2);
      ctx.fill();
      
      if (i === 0) {
        ctx.fillStyle = 'white';
        const eyeX = s.x + Math.cos(angle + 0.5) * 8;
        const eyeY = s.y + Math.sin(angle + 0.5) * 8;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        const eyeX2 = s.x + Math.cos(angle - 0.5) * 8;
        const eyeY2 = s.y + Math.sin(angle - 0.5) * 8;
        ctx.beginPath();
        ctx.arc(eyeX2, eyeY2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }, [snake, food, angle]);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-primary tracking-tight">Snake.io Break! 🐍</h2>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">Score: <span className="text-primary font-bold">{score}</span></p>
            <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${timeLeft < 30 ? 'bg-red-500 text-white animate-pulse' : 'bg-primary/10 text-primary'}`}>
              <Clock className="w-3 h-3" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowBreakGame(false)}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to Learning
        </Button>
      </div>
      
      <Card 
        ref={containerRef}
        className="overflow-hidden border-4 border-primary/20 shadow-2xl bg-slate-900 aspect-square max-w-[500px] mx-auto relative select-none touch-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseDown={() => gameState === 'PLAYING' && setSpeed(5)}
        onMouseUp={() => setSpeed(2)}
        onTouchStart={() => {
          if (gameState === 'START') setGameState('PLAYING');
          setSpeed(5);
        }}
        onTouchEnd={() => setSpeed(2)}
      >
        <canvas ref={canvasRef} width={500} height={500} className="w-full h-full" />
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-white text-center p-6">
            <Gamepad2 className="w-16 h-16 text-primary mb-4 animate-bounce" />
            <h3 className="text-3xl font-black mb-2">Snake.io Style</h3>
            <p className="mb-6 opacity-80">Move mouse to steer! Click to boost!</p>
            <Button onClick={() => setGameState('PLAYING')} size="lg" className="rounded-full font-bold">Start Slithering</Button>
          </div>
        )}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-500/60 backdrop-blur-md z-30 flex flex-col items-center justify-center text-white text-center p-6">
            <h3 className="text-5xl font-black mb-2">GAME OVER</h3>
            <p className="text-2xl mb-6 font-bold">Score: {score}</p>
            <div className="flex gap-4">
              <Button onClick={resetGame} size="lg" className="rounded-full bg-white text-red-600 hover:bg-white/90 font-bold">Try Again</Button>
              <Button onClick={() => setShowBreakGame(false)} variant="outline" size="lg" className="rounded-full border-white text-white hover:bg-white/20 font-bold">Back to Study</Button>
            </div>
          </div>
        )}
      </Card>
      
      <div className="text-center space-y-4">
        <p className="text-muted-foreground font-medium italic">"Slither around, eat dots, and refresh your mind!"</p>
        <Button 
          size="lg" 
          className="rounded-full px-12 font-bold text-lg shadow-xl hover:scale-105 transition-transform"
          onClick={() => {
            setShowBreakGame(false);
            toast.info("Welcome back! Let's get some studying done. 📚");
          }}
        >
          I'm Ready to Study Again
        </Button>
      </div>
    </div>
  );
};
