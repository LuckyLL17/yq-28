import { useGameStore, WeaponType, MaterialType, BuildTool } from '@/store/gameStore';
import { Hammer, Circle, Bomb, RotateCcw, Building2, Castle, Eye, Undo2, Redo2, Trash2, Move, RotateCw, Plus, Box, Wrench, Swords, SprayCan } from 'lucide-react';

interface ControlPanelProps {
  onReset: () => void;
  onRegenerateBuilding: (type: 'building' | 'castle') => void;
  onClearBuild: () => void;
}

const weaponConfigs: { type: WeaponType; name: string; description: string; icon: typeof Hammer; color: string }[] = [
  {
    type: 'wreckingBall',
    name: '重力落锤',
    description: '点击推动沉重的铁球，利用重力和惯性进行大面积破坏',
    icon: Hammer,
    color: 'from-gray-500 to-gray-700',
  },
  {
    type: 'steelBall',
    name: '弹射钢球',
    description: '瞄准射击，高速穿透的精准打击武器',
    icon: Circle,
    color: 'from-cyan-500 to-blue-600',
  },
  {
    type: 'explosive',
    name: '定向爆破',
    description: '投掷爆炸物，巨大冲击力粉碎一切',
    icon: Bomb,
    color: 'from-orange-500 to-red-600',
  },
  {
    type: 'sprayPaint',
    name: '涂鸦喷枪',
    description: '在方块表面喷涂图案和颜色，破坏时碎片保留涂鸦',
    icon: SprayCan,
    color: 'from-pink-500 to-rose-600',
  },
];

const materialConfigs: { type: MaterialType; name: string; icon: typeof Box; color: string; bgClass: string }[] = [
  { type: 'wood', name: '木材', icon: Box, color: '#8B4513', bgClass: 'from-amber-700 to-amber-900' },
  { type: 'glass', name: '玻璃', icon: Box, color: '#88ccff', bgClass: 'from-cyan-400 to-blue-500' },
  { type: 'concrete', name: '混凝土', icon: Box, color: '#808080', bgClass: 'from-gray-500 to-gray-700' },
];

const toolConfigs: { type: BuildTool; name: string; icon: typeof Plus; color: string }[] = [
  { type: 'place', name: '放置', icon: Plus, color: 'from-emerald-500 to-green-600' },
  { type: 'move', name: '移动', icon: Move, color: 'from-blue-500 to-indigo-600' },
  { type: 'rotate', name: '旋转', icon: RotateCw, color: 'from-purple-500 to-violet-600' },
  { type: 'delete', name: '删除', icon: Trash2, color: 'from-red-500 to-rose-600' },
  { type: 'sprayPaint', name: '涂鸦', icon: SprayCan, color: 'from-pink-500 to-rose-600' },
];

const SPRAY_COLORS = [
  '#ff0066', '#ff3366', '#ff6633', '#ff9900', '#ffcc00',
  '#66ff33', '#00ff66', '#00ffcc', '#00ccff', '#3366ff',
  '#6633ff', '#cc33ff', '#ff33cc', '#ffffff', '#000000',
];

export function ControlPanel({ onReset, onRegenerateBuilding, onClearBuild }: ControlPanelProps) {
  const weapon = useGameStore((s) => s.weapon);
  const setWeapon = useGameStore((s) => s.setWeapon);
  const blocks = useGameStore((s) => s.blocks);
  const shootCooldown = useGameStore((s) => s.shootCooldown);
  const wreckingBallActive = useGameStore((s) => s.wreckingBallActive);
  const gameMode = useGameStore((s) => s.gameMode);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const buildMaterial = useGameStore((s) => s.buildMaterial);
  const setBuildMaterial = useGameStore((s) => s.setBuildMaterial);
  const buildTool = useGameStore((s) => s.buildTool);
  const setBuildTool = useGameStore((s) => s.setBuildTool);
  const undoStack = useGameStore((s) => s.undoStack);
  const redoStack = useGameStore((s) => s.redoStack);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const selectedBlockId = useGameStore((s) => s.selectedBlockId);
  const sprayColor = useGameStore((s) => s.sprayColor);
  const setSprayColor = useGameStore((s) => s.setSprayColor);
  const spraySize = useGameStore((s) => s.spraySize);
  const setSpraySize = useGameStore((s) => s.setSpraySize);

  const totalBlocks = blocks.size;

  if (gameMode === 'build') {
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">自由建造</h1>
                <p className="text-white/50 text-xs">点击网格 · 自由创造</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">材质选择</div>
              <div className="grid grid-cols-3 gap-2">
                {materialConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = buildMaterial === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setBuildMaterial(config.type)}
                      className={`relative group p-2.5 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.bgClass} border-white/30 shadow-lg scale-105`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">工具选择</div>
              <div className="grid grid-cols-4 gap-1.5">
                {toolConfigs.map((config) => {
                  const Icon = config.icon;
                  const isActive = buildTool === config.type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => setBuildTool(config.type)}
                      className={`relative group p-2 rounded-xl transition-all duration-300 border ${
                        isActive
                          ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {config.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-200 ${
                  undoStack.length > 0
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    : 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-4 h-4" />
                <span className="text-xs">撤销</span>
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-200 ${
                  redoStack.length > 0
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    : 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-4 h-4" />
                <span className="text-xs">重做</span>
              </button>
            </div>

            {buildTool === 'sprayPaint' && (
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">喷枪颜色</div>
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {SPRAY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSprayColor(color)}
                      className={`relative w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                        sprayColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/10 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">笔触大小</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={spraySize}
                    onChange={(e) => setSpraySize(parseInt(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${sprayColor} 0%, ${sprayColor} ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                  <span className="text-white text-xs font-mono w-10 text-right">{spraySize}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setGameMode('destroy')}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">切换到破坏模式</div>
                  <div className="text-white/50 text-xs">使用武器摧毁建筑</div>
                </div>
              </button>
              <button
                onClick={onClearBuild}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-white text-sm font-medium">清空建造</div>
                  <div className="text-white/50 text-xs">清除所有方块</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">已放置方块</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {totalBlocks}
                  </span>
                  <span className="text-white/40 text-sm">块</span>
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider">可撤销</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-white/80">{undoStack.length}</span>
                  <span className="text-white/40 text-sm">步</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
            <div className="space-y-2 text-sm">
              {buildTool === 'place' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>在网格上放置方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                    <span>缩放视角</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">右键拖动</span>
                    <span>旋转视角</span>
                  </div>
                </>
              )}
              {buildTool === 'move' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>选择方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">拖拽</span>
                    <span>移动选中方块</span>
                  </div>
                  {selectedBlockId && (
                    <div className="mt-2 p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <div className="text-blue-300 text-xs">已选中方块，拖拽移动</div>
                    </div>
                  )}
                </>
              )}
              {buildTool === 'rotate' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>选择方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">R</span>
                    <span>旋转90度</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">方向箭头</span>
                    <span>点击箭头旋转</span>
                  </div>
                </>
              )}
              {buildTool === 'delete' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键点击</span>
                    <span>删除方块</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Delete</span>
                    <span>删除选中</span>
                  </div>
                </>
              )}
              {buildTool === 'sprayPaint' && (
                <>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键按住</span>
                    <span>在方块表面喷涂</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">移动鼠标</span>
                    <span>绘制图案和文字</span>
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-pink-500/20 border border-pink-500/30">
                    <div className="text-pink-300 text-xs flex items-center gap-1">
                      <SprayCan className="w-3 h-3" />
                      在左侧面板选择颜色和笔触大小
                    </div>
                  </div>
                </>
              )}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Ctrl+Z</span>
                  <span>撤销</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 mt-1">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Ctrl+Y</span>
                  <span>重做</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 mt-1">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Esc</span>
                  <span>取消选择</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Hammer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">解压破坏场</h1>
              <p className="text-white/50 text-xs">无任务 · 无分数 · 尽情破坏</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">武器选择</div>
            <div className="grid grid-cols-3 gap-2">
              {weaponConfigs.map((config) => {
                const Icon = config.icon;
                const isActive = weapon === config.type;
                return (
                  <button
                    key={config.type}
                    onClick={() => setWeapon(config.type)}
                    className={`relative group p-3 rounded-xl transition-all duration-300 border ${
                      isActive
                        ? `bg-gradient-to-br ${config.color} border-white/30 shadow-lg scale-105`
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/70'}`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {config.name}
                      </span>
                    </div>
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-3 rounded-xl bg-gradient-to-r ${weaponConfigs.find(w => w.type === weapon)?.color} border border-white/20`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const Icon = weaponConfigs.find(w => w.type === weapon)?.icon || Hammer;
                  return <Icon className="w-4 h-4 text-white" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">
                  {weaponConfigs.find(w => w.type === weapon)?.name}
                </div>
                <div className="text-white/80 text-xs mt-0.5">
                  {weaponConfigs.find(w => w.type === weapon)?.description}
                </div>
              </div>
            </div>
          </div>

          {shootCooldown && weapon !== 'wreckingBall' && (
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-cyan-400 animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          {weapon === 'sprayPaint' && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">喷枪颜色</div>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {SPRAY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSprayColor(color)}
                    className={`relative w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                      sprayColor === color
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-white/10 hover:border-white/30 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">笔触大小</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={spraySize}
                  onChange={(e) => setSpraySize(parseInt(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${sprayColor} 0%, ${sprayColor} ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) ${((spraySize - 5) / 75) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <span className="text-white text-xs font-mono w-10 text-right">{spraySize}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="text-white/70 text-xs mb-3 font-medium uppercase tracking-wider">场景控制</div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setGameMode('build')}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">切换到建造模式</div>
                <div className="text-white/50 text-xs">自由建造创意建筑</div>
              </div>
            </button>
            <button
              onClick={() => onRegenerateBuilding('building')}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">生成办公楼</div>
                <div className="text-white/50 text-xs">多层现代建筑</div>
              </div>
            </button>
            <button
              onClick={() => onRegenerateBuilding('castle')}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Castle className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">生成城堡</div>
                <div className="text-white/50 text-xs">坚固的中世纪堡垒</div>
              </div>
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-pink-500/30 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">重置场景</div>
                <div className="text-white/50 text-xs">清除所有废墟</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider">剩余建筑方块</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {totalBlocks}
                </span>
                <span className="text-white/40 text-sm">块</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider">破坏进度</div>
              <div className="w-32 h-2 mt-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (1 - totalBlocks / 200) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl max-w-xs">
          <div className="text-white/70 text-xs mb-2 font-medium uppercase tracking-wider">操作提示</div>
          <div className="space-y-2 text-sm">
            {weapon === 'wreckingBall' ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键拖拽</span>
                  <span>瞄准落锤方向</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">释放</span>
                  <span>释放推动铁球</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">鼠标</span>
                  <span>拖动旋转视角</span>
                </div>
                {wreckingBallActive && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                    <div className="text-emerald-300 text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      拖拽瞄准 → 释放挥动
                    </div>
                  </div>
                )}
              </>
            ) : weapon === 'sprayPaint' ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键按住</span>
                  <span>在方块表面喷涂</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">移动鼠标</span>
                  <span>绘制图案和文字</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                  <span>缩放视角</span>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-pink-500/20 border border-pink-500/30">
                  <div className="text-pink-300 text-xs flex items-center gap-1">
                    <SprayCan className="w-3 h-3" />
                    破坏方块后碎片会保留涂鸦颜色
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">左键</span>
                  <span>
                    {weapon === 'steelBall' ? '发射钢球' : '投掷爆炸物'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">滚轮</span>
                  <span>缩放视角</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-xs">右键拖动</span>
                  <span>平移视角</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {weapon !== 'wreckingBall' && (
          <div className="relative">
            <div className="absolute w-6 h-0.5 bg-white/50 -left-3 top-1/2 -translate-y-1/2" />
            <div className="absolute w-0.5 h-6 bg-white/50 left-1/2 -top-3 -translate-x-1/2" />
            <div className={`w-3 h-3 rounded-full border-2 ${
              weapon === 'explosive' ? 'border-orange-400 bg-orange-400/30' : 'border-cyan-400 bg-cyan-400/30'
            } backdrop-blur-sm`} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ControlPanel;
