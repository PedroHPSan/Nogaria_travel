import { EmojiImage } from './Avatar';

interface AchievementBadgeProps {
  percent: number;
}

export function AchievementBadge({ percent }: AchievementBadgeProps) {
  if (percent < 100) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-400 text-[10px] font-bold shadow-lg shadow-amber-400/10 animate-bounce">
      <EmojiImage emoji="🏆" className="w-3 h-3 object-contain" />
      <span>Dia Completo!</span>
    </div>
  );
}
