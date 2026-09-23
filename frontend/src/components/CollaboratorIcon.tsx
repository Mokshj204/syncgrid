import React from 'react';
import { 
  Zap, 
  Sparkles, 
  Flame, 
  Shield, 
  Compass, 
  Feather, 
  Star, 
  Rocket, 
  Sun, 
  Moon,
  User
} from 'lucide-react';

interface CollaboratorIconProps {
  name: string;
  size?: number;
  color?: string;
}

export const CollaboratorIcon: React.FC<CollaboratorIconProps> = ({ name, size = 14, color }) => {
  const iconProps = { size, color: color || 'currentColor' };

  switch (name) {
    case 'zap': return <Zap {...iconProps} />;
    case 'sparkles': return <Sparkles {...iconProps} />;
    case 'flame': return <Flame {...iconProps} />;
    case 'shield': return <Shield {...iconProps} />;
    case 'compass': return <Compass {...iconProps} />;
    case 'feather': return <Feather {...iconProps} />;
    case 'star': return <Star {...iconProps} />;
    case 'rocket': return <Rocket {...iconProps} />;
    case 'sun': return <Sun {...iconProps} />;
    case 'moon': return <Moon {...iconProps} />;
    default: return <User {...iconProps} />;
  }
};
