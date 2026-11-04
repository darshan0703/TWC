import React from 'react';

// Minimal 2D navy line-art of a person relaxing with a warm ceramic cup of specialty coffee
export const CoffeeMomentIllustration = ({ className = "w-48 h-48", color = "#1C2A39" }) => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Minimal delicate café table line */}
    <path d="M20 165H180" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
    
    {/* Ceramic coffee mug with steam */}
    <rect x="75" y="115" width="40" height="38" rx="8" stroke={color} strokeWidth="2.2" fill="#FFFFFF" />
    <path d="M115 124C122 124 127 129 127 134C127 139 122 144 115 144" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* Saucer */}
    <path d="M68 153C68 153 80 157 95 157C110 157 122 153 122 153" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    
    {/* Delicate steam waves */}
    <path d="M86 105C84 100 88 95 86 90" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M95 107C93 101 97 96 95 89" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M104 105C102 100 106 95 104 90" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />

    {/* Minimalist 2D line art of coffee drinker */}
    {/* Head tilted down towards coffee */}
    <path d="M60 70C55 58 64 45 76 43C88 41 96 50 96 62" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* Hair flow */}
    <path d="M65 47C70 42 78 40 85 42C92 44 95 48 95 55C95 62 88 66 84 68" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Nose & chin profile */}
    <path d="M96 62C97 66 95 70 91 73C87 75 80 75 76 77" stroke={color} strokeWidth="2" strokeLinecap="round" />
    
    {/* Slanted neck & shoulder leaning in */}
    <path d="M72 78C62 85 45 100 40 120" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M78 77C85 86 92 98 94 110" stroke={color} strokeWidth="2" strokeLinecap="round" />
    
    {/* Arm gently cradling the cup */}
    <path d="M40 120C45 135 60 145 74 140" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M74 135C74 130 73 125 75 120" stroke={color} strokeWidth="2" strokeLinecap="round" />

    {/* Botanical leaf accent on table */}
    <path d="M142 165C144 155 152 148 160 146" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
    <path d="M147 155C153 154 158 157 160 162" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
    <path d="M152 148C156 142 163 140 168 143" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
  </svg>
);

// Minimal 2D navy line-art of two people enjoying coffee together (Third Wave social vibe)
export const CoffeeSocialIllustration = ({ className = "w-44 h-44", color = "#1C2A39" }) => (
  <svg
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Table line */}
    <path d="M15 135H185" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
    
    {/* Two coffee cups */}
    <rect x="70" y="105" width="24" height="26" rx="4" stroke={color} strokeWidth="2" fill="#FFFFFF" />
    <path d="M94 112C98 112 101 115 101 118C101 121 98 124 94 124" stroke={color} strokeWidth="2" strokeLinecap="round" />
    
    <rect x="108" y="105" width="24" height="26" rx="4" stroke={color} strokeWidth="2" fill="#FFFFFF" />
    <path d="M108 112C104 112 101 115 101 118C101 121 104 124 108 124" stroke={color} strokeWidth="2" strokeLinecap="round" />
    
    {/* Steam */}
    <path d="M82 98C81 94 84 90 82 86" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M120 98C119 94 122 90 120 86" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />

    {/* Person 1 (Left) */}
    <circle cx="50" cy="55" r="14" stroke={color} strokeWidth="2" />
    <path d="M50 70C40 76 30 88 28 110" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M53 70C60 78 66 90 70 105" stroke={color} strokeWidth="2" strokeLinecap="round" />

    {/* Person 2 (Right) */}
    <circle cx="150" cy="55" r="14" stroke={color} strokeWidth="2" />
    <path d="M150 70C160 76 170 88 172 110" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M147 70C140 78 134 90 130 105" stroke={color} strokeWidth="2" strokeLinecap="round" />

    {/* Coffee wave line between */}
    <path d="M75 145C90 140 110 148 125 143" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
  </svg>
);

// Minimal 2D line-art cup & croissant pastry
export const CoffeeAndPastryIllustration = ({ className = "w-32 h-32", color = "#1C2A39" }) => (
  <svg
    viewBox="0 0 140 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Cup */}
    <rect x="25" y="55" width="34" height="36" rx="6" stroke={color} strokeWidth="2" fill="#FFFFFF" />
    <path d="M59 64C64 64 68 68 68 72C68 76 64 80 59 80" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M20 92H64" stroke={color} strokeWidth="2" strokeLinecap="round" />
    
    {/* Steam */}
    <path d="M38 46C37 42 40 38 38 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M46 47C45 43 48 39 46 35" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />

    {/* Flaky Croissant */}
    <path d="M78 88C78 78 88 68 100 68C112 68 122 78 122 88C116 88 110 84 100 84C90 84 84 88 78 88Z" stroke={color} strokeWidth="2" fill="#F8F5EE" />
    <path d="M92 72C94 77 96 82 96 85" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M106 72C104 77 103 82 103 85" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />
    
    <path d="M15 102H125" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.3" />
  </svg>
);

