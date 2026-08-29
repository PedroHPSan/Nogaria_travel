import { useMemo, useState } from 'react';
import { parse } from 'twemoji-parser';
import type { Participant } from '../types/database.types';
import { diceBearAvatarUri } from '../services/avatarGenerator';

// Twemoji fixa o visual do emoji (Twitter/X, CC-BY 4.0) em vez de depender da
// fonte de emoji nativa do SO, que varia entre Windows/Android/macOS.
// Versão pinada via jsdelivr para não quebrar se o CDN oficial mudar.
const TWEMOJI_ASSET_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

function twemojiUrl(emoji: string): string | null {
  const [match] = parse(emoji, { assetType: 'svg' });
  if (!match) return null;
  const codepoint = match.url.split('/').pop();
  return codepoint ? `${TWEMOJI_ASSET_BASE}${codepoint}` : null;
}

export function EmojiImage({ emoji, className }: { emoji: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = !failed ? twemojiUrl(emoji) : null;

  if (!url) return <span className={className}>{emoji}</span>;

  return (
    <img
      src={url}
      alt={emoji}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function DiceBearAvatar({
  seed,
  className,
  title
}: {
  seed: string;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  // DiceBear gera o SVG inteiro no cliente — memoiza pra não recalcular a cada render.
  const dataUri = useMemo(() => diceBearAvatarUri(seed), [seed]);

  if (failed) {
    const initials = (title || '??').substring(0, 2).toUpperCase();
    return (
      <div className={className} title={title}>
        {initials}
      </div>
    );
  }

  return (
    <div className={className} title={title}>
      <img
        src={dataUri}
        alt={title || seed}
        className="w-[85%] h-[85%] object-contain"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

interface AvatarProps {
  participant: Participant | { 
    full_name: string; 
    nickname?: string; 
    avatar_preset_id?: string | null; 
    avatar_emoji?: string | null; 
    avatar_color?: string | null 
  };
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ participant, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-2xl'
  };

  const baseClasses = `rounded-full flex items-center justify-center shrink-0 font-medium ${sizeClasses[size]}`;
  const defaultColor = 'bg-slate-700 text-white';
  const colorClass = participant.avatar_color || defaultColor;
  const imgClasses = 'w-[65%] h-[65%] object-contain';

  // 1. Check if there's a DiceBear preset (avatar_preset_id holds the seed)
  if (participant.avatar_preset_id) {
    return (
      <DiceBearAvatar
        seed={participant.avatar_preset_id}
        className={`${baseClasses} ${colorClass}`}
        title={participant.nickname || participant.full_name}
      />
    );
  }

  // 2. Check if there's an emoji fallback
  if (participant.avatar_emoji) {
    return (
      <div className={`${baseClasses} ${colorClass}`} title={participant.nickname || participant.full_name}>
        <EmojiImage emoji={participant.avatar_emoji} className={imgClasses} />
      </div>
    );
  }

  // 3. Fallback to initials
  const initials = (participant.nickname || participant.full_name || '??')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`${baseClasses} ${colorClass} text-white`} title={participant.nickname || participant.full_name}>
      {initials}
    </div>
  );
}
