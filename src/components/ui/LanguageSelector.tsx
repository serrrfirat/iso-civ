'use client';

import React, { useState } from 'react';
import { useLocale, useSetLocale } from 'gt-next/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Language configuration with display names
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
] as const;

// Globe icon for language button
function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// Check icon for selected language
function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

interface LanguageSelectorProps {
  /** Show only an icon (for compact layouts like mobile) */
  iconOnly?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Variant for the button */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Size of the icon */
  iconSize?: number;
  /** Use drawer style instead of dropdown (for mobile) */
  useDrawer?: boolean;
}

export function LanguageSelector({ 
  iconOnly = false, 
  className = '',
  variant = 'ghost',
  iconSize = 16,
  useDrawer = false,
}: LanguageSelectorProps) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  const handleSelectLanguage = (code: string) => {
    setLocale(code);
    setIsOpen(false);
  };

  // Drawer mode for mobile
  if (useDrawer) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`h-6 w-5 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
          title="Change Language"
        >
          <GlobeIcon size={iconSize} />
        </button>

        {isOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <Card
              className="absolute bottom-0 left-0 right-0 rounded-t-xl rounded-b-none border-b-0 safe-area-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  Select Language
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.map((language) => (
                    <Button
                      key={language.code}
                      variant={locale === language.code ? 'default' : 'ghost'}
                      size="sm"
                      className="h-10 w-full text-xs justify-center"
                      onClick={() => handleSelectLanguage(language.code)}
                    >
                      {language.name}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }
  
  // Standard dropdown mode
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <button
            className={`h-6 w-6 p-0 m-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
            title="Change Language"
          >
            <GlobeIcon size={iconSize} />
          </button>
        ) : (
          <Button variant={variant} size="sm" className={`gap-2 ${className}`}>
            <GlobeIcon size={iconSize} />
            <span className="text-xs">{currentLanguage.name}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => setLocale(language.code)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span>{language.name}</span>
            {locale === language.code && (
              <CheckIcon size={14} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
