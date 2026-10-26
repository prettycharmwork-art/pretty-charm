/**
 * Studio-grade SVG illustrations encoded as self-contained data URIs for
 * Pretty Charm's blush-pink, warm cream, and rose-gold boutique aesthetic.
 * Ensures zero broken images offline or in hermetic sandboxes.
 */

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const ARTWORK = {
  heroBanner: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8f9"/>
          <stop offset="50%" stop-color="#fce9ee"/>
          <stop offset="100%" stop-color="#f5d5de"/>
        </linearGradient>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e3a5b0"/>
          <stop offset="50%" stop-color="#b76e79"/>
          <stop offset="100%" stop-color="#8c4a56"/>
        </linearGradient>
        <radialGradient id="glow" cx="72%" cy="48%" r="42%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#fce9ee" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <circle cx="860" cy="330" r="280" fill="url(#glow)"/>
      <ellipse cx="850" cy="515" rx="220" ry="32" fill="#d9a6b0" opacity="0.32"/>
      <!-- Keepsake Hamper Box -->
      <rect x="680" y="250" width="340" height="230" rx="18" fill="#fffdfb" stroke="#e4b7c0" stroke-width="4"/>
      <rect x="664" y="210" width="372" height="56" rx="12" fill="#f7dce2" stroke="#d59aa6" stroke-width="3"/>
      <!-- Vertical & Horizontal Rose Gold Satin Ribbon -->
      <rect x="832" y="210" width="36" height="270" fill="url(#rg)"/>
      <rect x="680" y="345" width="340" height="32" fill="url(#rg)"/>
      <!-- Satin Bow -->
      <path d="M850 212 C790 145 735 190 795 220 Z" fill="url(#rg)"/>
      <path d="M850 212 C910 145 965 190 905 220 Z" fill="url(#rg)"/>
      <circle cx="850" cy="212" r="16" fill="#8c4a56"/>
      <!-- Pearl & Rose Gold Accents -->
      <circle cx="620" cy="440" r="22" fill="#fffaf5" stroke="#d59aa6" stroke-width="2"/>
      <circle cx="660" cy="468" r="16" fill="#fffaf5" stroke="#d59aa6" stroke-width="2"/>
      <circle cx="1065" cy="435" r="26" fill="none" stroke="url(#rg)" stroke-width="8"/>
      <circle cx="1065" cy="404" r="9" fill="#fffaf5" stroke="#b76e79" stroke-width="2"/>
      <text x="850" y="318" font-family="Georgia, serif" font-size="26" fill="#8c4a56" text-anchor="middle" letter-spacing="4">PRETTY CHARM</text>
    </svg>
  `),

  hamperMini: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffaf9"/>
          <stop offset="100%" stop-color="#f9e2e7"/>
        </linearGradient>
        <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d88f9a"/>
          <stop offset="100%" stop-color="#9e5461"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg1)"/>
      <ellipse cx="400" cy="470" rx="190" ry="26" fill="#d9a6b0" opacity="0.3"/>
      <rect x="250" y="210" width="300" height="230" rx="20" fill="#fffdfb" stroke="#e4b7c0" stroke-width="4"/>
      <rect x="235" y="175" width="330" height="50" rx="12" fill="#f7dce2" stroke="#d59aa6" stroke-width="3"/>
      <rect x="384" y="175" width="32" height="265" fill="url(#rg1)"/>
      <path d="M400 175 C345 118 300 160 355 185 Z" fill="url(#rg1)"/>
      <path d="M400 175 C455 118 500 160 445 185 Z" fill="url(#rg1)"/>
      <circle cx="400" cy="175" r="13" fill="#7a3b47"/>
      <text x="400" y="330" font-family="Georgia, serif" font-size="24" fill="#7a3b47" text-anchor="middle" letter-spacing="3">MINI HAMPER</text>
      <text x="400" y="362" font-family="sans-serif" font-size="13" fill="#9e5461" text-anchor="middle" letter-spacing="2">CURATED GIFT BOX</text>
    </svg>
  `),

  hamperBestie: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8fa"/>
          <stop offset="100%" stop-color="#f6d5de"/>
        </linearGradient>
        <linearGradient id="rg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c97a85"/>
          <stop offset="100%" stop-color="#8c4a56"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg2)"/>
      <ellipse cx="400" cy="475" rx="205" ry="26" fill="#d9a6b0" opacity="0.32"/>
      <rect x="235" y="200" width="330" height="240" rx="22" fill="#fffdfb" stroke="#dca7b2" stroke-width="4"/>
      <rect x="235" y="305" width="330" height="28" fill="url(#rg2)"/>
      <rect x="385" y="200" width="30" height="240" fill="url(#rg2)"/>
      <circle cx="400" cy="182" r="28" fill="#f7dce2" stroke="url(#rg2)" stroke-width="4"/>
      <text x="400" y="270" font-family="Georgia, serif" font-size="25" fill="#7a3b47" text-anchor="middle" letter-spacing="3">BESTIE BOX</text>
      <text x="400" y="380" font-family="sans-serif" font-size="13" fill="#8c4a56" text-anchor="middle" letter-spacing="2">PRETTY CHARM EDITION</text>
    </svg>
  `),

  hamperPremium: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fdf4f6"/>
          <stop offset="100%" stop-color="#eed0d8"/>
        </linearGradient>
        <linearGradient id="rg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d4939d"/>
          <stop offset="50%" stop-color="#b76e79"/>
          <stop offset="100%" stop-color="#6e3540"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg3)"/>
      <ellipse cx="400" cy="480" rx="220" ry="28" fill="#c7929c" opacity="0.35"/>
      <rect x="215" y="185" width="370" height="260" rx="24" fill="#3a2227" stroke="url(#rg3)" stroke-width="5"/>
      <rect x="382" y="185" width="36" height="260" fill="url(#rg3)"/>
      <rect x="215" y="298" width="370" height="32" fill="url(#rg3)"/>
      <text x="400" y="258" font-family="Georgia, serif" font-size="26" fill="#fce9ee" text-anchor="middle" letter-spacing="4">PREMIUM BOX</text>
      <text x="400" y="382" font-family="sans-serif" font-size="13" fill="#f5d5de" text-anchor="middle" letter-spacing="3">LUXURY GIFT HAMPER</text>
    </svg>
  `),

  hamperCelebration: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff9f5"/>
          <stop offset="100%" stop-color="#f7dce2"/>
        </linearGradient>
        <linearGradient id="rg4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#df9ea8"/>
          <stop offset="100%" stop-color="#8c4a56"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg4)"/>
      <ellipse cx="400" cy="480" rx="220" ry="28" fill="#d9a6b0" opacity="0.32"/>
      <rect x="210" y="190" width="380" height="255" rx="24" fill="#fffdfb" stroke="url(#rg4)" stroke-width="5"/>
      <rect x="196" y="155" width="408" height="52" rx="14" fill="url(#rg4)"/>
      <circle cx="400" cy="318" r="76" fill="#fdf2f4" stroke="url(#rg4)" stroke-width="3"/>
      <text x="400" y="312" font-family="Georgia, serif" font-size="20" fill="#7a3b47" text-anchor="middle" letter-spacing="2">CELEBRATION</text>
      <text x="400" y="338" font-family="sans-serif" font-size="13" fill="#9e5461" text-anchor="middle" letter-spacing="3">HAMPER</text>
    </svg>
  `),

  hairPearlClaw: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffdfb"/>
          <stop offset="100%" stop-color="#f8e3e8"/>
        </linearGradient>
        <linearGradient id="rg5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e3a5b0"/>
          <stop offset="50%" stop-color="#b76e79"/>
          <stop offset="100%" stop-color="#8c4a56"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg5)"/>
      <ellipse cx="400" cy="450" rx="190" ry="24" fill="#d9a6b0" opacity="0.28"/>
      <!-- Rose Gold Claw Frame -->
      <path d="M230 330 Q400 180 570 330" fill="none" stroke="url(#rg5)" stroke-width="22" stroke-linecap="round"/>
      <path d="M250 350 Q400 265 550 350" fill="none" stroke="url(#rg5)" stroke-width="16" stroke-linecap="round"/>
      <!-- Claw Teeth -->
      <line x1="280" y1="320" x2="280" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <line x1="328" y1="295" x2="328" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <line x1="376" y1="282" x2="376" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <line x1="424" y1="282" x2="424" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <line x1="472" y1="295" x2="472" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <line x1="520" y1="320" x2="520" y2="390" stroke="url(#rg5)" stroke-width="10" stroke-linecap="round"/>
      <!-- Pearls -->
      <circle cx="265" cy="302" r="16" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <circle cx="315" cy="274" r="18" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <circle cx="370" cy="256" r="20" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <circle cx="430" cy="256" r="20" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <circle cx="485" cy="274" r="18" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <circle cx="535" cy="302" r="16" fill="#fffdf9" stroke="#e2c6cc" stroke-width="2"/>
      <text x="400" y="515" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">ROSE GOLD PEARL HAIR CLAW</text>
    </svg>
  `),

  hairSilkScrunchie: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg6" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffafb"/>
          <stop offset="100%" stop-color="#f7dde4"/>
        </linearGradient>
        <radialGradient id="silk" cx="50%" cy="45%" r="45%">
          <stop offset="0%" stop-color="#fbe5eb"/>
          <stop offset="65%" stop-color="#e7aab7"/>
          <stop offset="100%" stop-color="#b76e79"/>
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg6)"/>
      <ellipse cx="400" cy="465" rx="170" ry="22" fill="#d9a6b0" opacity="0.3"/>
      <circle cx="400" cy="290" r="135" fill="url(#silk)" stroke="#c97a85" stroke-width="4"/>
      <circle cx="400" cy="290" r="52" fill="#fffafb" stroke="#c97a85" stroke-width="4"/>
      <path d="M310 210 Q360 250 350 280" fill="none" stroke="#fffdfb" stroke-width="4" opacity="0.7"/>
      <path d="M475 205 Q435 245 450 285" fill="none" stroke="#fffdfb" stroke-width="4" opacity="0.7"/>
      <path d="M305 355 Q355 325 360 305" fill="none" stroke="#fffdfb" stroke-width="4" opacity="0.7"/>
      <path d="M495 355 Q445 325 440 305" fill="none" stroke="#fffdfb" stroke-width="4" opacity="0.7"/>
      <text x="400" y="515" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">MULBERRY SILK SCRUNCHIE TRIO</text>
    </svg>
  `),

  hairSatinBow: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bgBow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffdfb"/>
          <stop offset="100%" stop-color="#f7dce3"/>
        </linearGradient>
        <linearGradient id="bowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ecaec0"/>
          <stop offset="100%" stop-color="#b76e79"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bgBow)"/>
      <path d="M400 265 L310 445 L365 425 L400 325 Z" fill="url(#bowGrad)"/>
      <path d="M400 265 L490 445 L435 425 L400 325 Z" fill="url(#bowGrad)"/>
      <path d="M400 260 C260 150 220 310 385 280 Z" fill="url(#bowGrad)" stroke="#9e5461" stroke-width="3"/>
      <path d="M400 260 C540 150 580 310 415 280 Z" fill="url(#bowGrad)" stroke="#9e5461" stroke-width="3"/>
      <rect x="382" y="242" width="36" height="42" rx="10" fill="#8c4a56"/>
      <circle cx="400" cy="263" r="9" fill="#fffdf9"/>
      <text x="400" y="515" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">BLUSH SATIN PEARL BOW BARRETTE</text>
    </svg>
  `),

  jewelleryPearlEarrings: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg7" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffaf8"/>
          <stop offset="100%" stop-color="#f6dce2"/>
        </linearGradient>
        <linearGradient id="rg7" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e5a9b3"/>
          <stop offset="50%" stop-color="#b76e79"/>
          <stop offset="100%" stop-color="#7a3b47"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg7)"/>
      <rect x="200" y="110" width="400" height="350" rx="28" fill="#fffdfb" stroke="#e4b7c0" stroke-width="3"/>
      <!-- Left Earring -->
      <circle cx="330" cy="195" r="28" fill="none" stroke="url(#rg7)" stroke-width="10"/>
      <line x1="330" y1="223" x2="330" y2="265" stroke="url(#rg7)" stroke-width="5"/>
      <ellipse cx="330" cy="305" rx="34" ry="42" fill="#fffdf9" stroke="#d59aa6" stroke-width="3"/>
      <!-- Right Earring -->
      <circle cx="470" cy="195" r="28" fill="none" stroke="url(#rg7)" stroke-width="10"/>
      <line x1="470" y1="223" x2="470" y2="265" stroke="url(#rg7)" stroke-width="5"/>
      <ellipse cx="470" cy="305" rx="34" ry="42" fill="#fffdf9" stroke="#d59aa6" stroke-width="3"/>
      <text x="400" y="518" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">ROSE GOLD PEARL DROP HUGGIES</text>
    </svg>
  `),

  jewelleryCharmBracelet: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg8" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffdfb"/>
          <stop offset="100%" stop-color="#f5d5de"/>
        </linearGradient>
        <linearGradient id="rg8" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e3a5b0"/>
          <stop offset="50%" stop-color="#b76e79"/>
          <stop offset="100%" stop-color="#7a3b47"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg8)"/>
      <circle cx="400" cy="275" r="125" fill="none" stroke="url(#rg8)" stroke-width="10"/>
      <circle cx="400" cy="275" r="113" fill="none" stroke="#e4b7c0" stroke-width="2" stroke-dasharray="8 6"/>
      <!-- Heart & Pearl Charms -->
      <circle cx="400" cy="408" r="18" fill="#fffdf9" stroke="url(#rg8)" stroke-width="4"/>
      <circle cx="290" cy="355" r="15" fill="url(#rg8)"/>
      <circle cx="510" cy="355" r="15" fill="url(#rg8)"/>
      <circle cx="275" cy="245" r="14" fill="#fffdf9" stroke="url(#rg8)" stroke-width="3"/>
      <circle cx="525" cy="245" r="14" fill="#fffdf9" stroke="url(#rg8)" stroke-width="3"/>
      <text x="400" y="518" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">DAINTY ROSE GOLD CHARM BRACELET</text>
    </svg>
  `),

  jewelleryPendantNecklace: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg9" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffaf9"/>
          <stop offset="100%" stop-color="#f6dce3"/>
        </linearGradient>
        <linearGradient id="rg9" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e3a5b0"/>
          <stop offset="100%" stop-color="#8c4a56"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg9)"/>
      <path d="M220 120 Q400 430 580 120" fill="none" stroke="url(#rg9)" stroke-width="6"/>
      <path d="M250 120 Q400 360 550 120" fill="none" stroke="url(#rg9)" stroke-width="4" stroke-dasharray="6 4"/>
      <circle cx="400" cy="305" r="28" fill="#fffdf9" stroke="url(#rg9)" stroke-width="6"/>
      <circle cx="400" cy="305" r="12" fill="url(#rg9)"/>
      <text x="400" y="518" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">BLUSH QUARTZ LAYERED NECKLACE</text>
    </svg>
  `),

  comingSoonCosmetics: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#fdf2f4"/>
      <rect x="240" y="150" width="320" height="300" rx="24" fill="#fffdfb" stroke="#e4b7c0" stroke-width="3"/>
      <text x="400" y="285" font-family="Georgia, serif" font-size="28" fill="#8c4a56" text-anchor="middle" letter-spacing="3">COSMETICS &amp; BEAUTY</text>
      <text x="400" y="330" font-family="sans-serif" font-size="14" fill="#b76e79" text-anchor="middle" letter-spacing="4">COMING SOON</text>
    </svg>
  `),

  comingSoonFestive: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#fdf2f4"/>
      <rect x="240" y="150" width="320" height="300" rx="24" fill="#fffdfb" stroke="#e4b7c0" stroke-width="3"/>
      <text x="400" y="285" font-family="Georgia, serif" font-size="28" fill="#8c4a56" text-anchor="middle" letter-spacing="3">FESTIVE COLLECTION</text>
      <text x="400" y="330" font-family="sans-serif" font-size="14" fill="#b76e79" text-anchor="middle" letter-spacing="4">COMING SOON</text>
    </svg>
  `),

  cosmeticsLipTint: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="cbg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8f9"/>
          <stop offset="100%" stop-color="#fcedf1"/>
        </linearGradient>
        <linearGradient id="crg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e39aa7"/>
          <stop offset="100%" stop-color="#993d50"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#cbg1)"/>
      <ellipse cx="400" cy="460" rx="160" ry="22" fill="#d9a6b0" opacity="0.3"/>
      <rect x="330" y="190" width="60" height="230" rx="14" fill="#fffafb" stroke="url(#crg1)" stroke-width="4"/>
      <rect x="335" y="195" width="50" height="90" rx="8" fill="url(#crg1)"/>
      <rect x="410" y="210" width="60" height="210" rx="14" fill="#fffafb" stroke="#d58b99" stroke-width="4"/>
      <rect x="415" y="215" width="50" height="80" rx="8" fill="#d58b99"/>
      <circle cx="360" cy="360" r="12" fill="#e39aa7" opacity="0.7"/>
      <circle cx="440" cy="370" r="12" fill="#d58b99" opacity="0.7"/>
      <text x="400" y="495" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">VELVET LIP &amp; CHEEK TINT DUO</text>
      <text x="400" y="525" font-family="sans-serif" font-size="12" fill="#9e5461" text-anchor="middle" letter-spacing="3">COMING SOON · PREVIEW</text>
    </svg>
  `),

  cosmeticsGlowMist: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="cbg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffbfc"/>
          <stop offset="100%" stop-color="#f8e5eb"/>
        </linearGradient>
        <linearGradient id="crg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f2b6c1"/>
          <stop offset="100%" stop-color="#b24d62"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#cbg2)"/>
      <ellipse cx="400" cy="470" rx="140" ry="20" fill="#d9a6b0" opacity="0.28"/>
      <rect x="345" y="160" width="110" height="270" rx="20" fill="#ffffff" stroke="url(#crg2)" stroke-width="4"/>
      <rect x="375" y="115" width="50" height="45" rx="6" fill="#e69fad" stroke="#b24d62" stroke-width="2"/>
      <rect x="390" y="95" width="20" height="20" rx="3" fill="#b24d62"/>
      <circle cx="400" cy="270" r="28" fill="#fae8ec"/>
      <text x="400" y="276" font-family="Georgia, serif" font-size="18" fill="#8c4a56" text-anchor="middle">ROSE</text>
      <text x="400" y="500" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">DEWY ROSEWATER GLOW MIST</text>
      <text x="400" y="528" font-family="sans-serif" font-size="12" fill="#9e5461" text-anchor="middle" letter-spacing="3">COMING SOON · PREVIEW</text>
    </svg>
  `),

  festiveDiyaBox: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="fbg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff9f5"/>
          <stop offset="100%" stop-color="#fce2dc"/>
        </linearGradient>
        <linearGradient id="frg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e8a87c"/>
          <stop offset="50%" stop-color="#c35a6b"/>
          <stop offset="100%" stop-color="#802636"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#fbg1)"/>
      <ellipse cx="400" cy="465" rx="190" ry="24" fill="#d9a6b0" opacity="0.3"/>
      <polygon points="400,160 520,230 520,380 400,450 280,380 280,230" fill="#fffdfb" stroke="url(#frg1)" stroke-width="4"/>
      <!-- Gilded Diya Flame -->
      <path d="M400 230 C380 280 420 280 400 230 Z" fill="#e8a87c"/>
      <ellipse cx="400" cy="285" rx="30" ry="12" fill="#c35a6b"/>
      <text x="400" y="360" font-family="Georgia, serif" font-size="20" fill="#802636" text-anchor="middle" letter-spacing="3">FESTIVE KEEPSAKE</text>
      <text x="400" y="495" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">SHIMMERING DIYA &amp; DRY FRUIT BOX</text>
      <text x="400" y="525" font-family="sans-serif" font-size="12" fill="#9e5461" text-anchor="middle" letter-spacing="3">COMING SOON · PREVIEW</text>
    </svg>
  `),

  festivePotliSet: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="fbg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff8f9"/>
          <stop offset="100%" stop-color="#fad9e1"/>
        </linearGradient>
        <linearGradient id="frg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d4798a"/>
          <stop offset="100%" stop-color="#80283b"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#fbg2)"/>
      <ellipse cx="400" cy="460" rx="160" ry="22" fill="#d9a6b0" opacity="0.3"/>
      <!-- Potli Pouch Body -->
      <path d="M340 220 Q400 170 460 220 Q510 320 460 410 Q400 450 340 410 Q290 320 340 220 Z" fill="#fffcfd" stroke="url(#frg2)" stroke-width="4"/>
      <!-- Drawstring & Pearl Tassels -->
      <circle cx="340" cy="270" r="10" fill="#e8a87c"/>
      <circle cx="460" cy="270" r="10" fill="#e8a87c"/>
      <line x1="340" y1="280" x2="330" y2="330" stroke="#e8a87c" stroke-width="3"/>
      <line x1="460" y1="280" x2="470" y2="330" stroke="#e8a87c" stroke-width="3"/>
      <circle cx="330" cy="335" r="7" fill="#fffaf5" stroke="#b76e79" stroke-width="2"/>
      <circle cx="470" cy="335" r="7" fill="#fffaf5" stroke="#b76e79" stroke-width="2"/>
      <text x="400" y="350" font-family="Georgia, serif" font-size="18" fill="#80283b" text-anchor="middle" letter-spacing="2">ZARDOZI</text>
      <text x="400" y="495" font-family="Georgia, serif" font-size="22" fill="#7a3b47" text-anchor="middle" letter-spacing="2">EMBROIDERED FESTIVE POTLI HAMPER</text>
      <text x="400" y="525" font-family="sans-serif" font-size="12" fill="#9e5461" text-anchor="middle" letter-spacing="3">COMING SOON · PREVIEW</text>
    </svg>
  `),
};
