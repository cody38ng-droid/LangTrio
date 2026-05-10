import * as React from 'react';

interface ChineseRubyTextProps {
  text: string;
  pinyin: string;
}

export const ChineseRubyText = ({ text, pinyin }: ChineseRubyTextProps) => {
  // Clean pinyin words of punctuation and split by spaces
  const pinyinWords = pinyin
    .split(/\s+/) // split by any whitespace
    .filter(word => word.length > 0)
    .map(word => word.replace(/[.,!?;:，。！？；：、]/g, '')); // remove punctuation from pinyin itself
  
  const chars = text.split('');
  
  let pIdx = 0;
  return (
    <div className="flex flex-wrap justify-center gap-x-1 sm:gap-x-2 md:gap-x-4 gap-y-6">
      {chars.map((char, index) => {
        // More comprehensive punctuation regex including Western characters
        if (/[，。！？“”：；（）、\s.,!?;:"'()]/.test(char)) {
          return (
            <span key={index} className="text-2xl md:text-4xl self-end mb-1 opacity-40">
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        }
        
        const currentPinyin = pinyinWords[pIdx] || '';
        pIdx++;
        
        return (
          <div key={index} className="flex flex-col items-center min-w-[0.8em] sm:min-w-[1.2em]">
            <span className="text-[10px] sm:text-xs md:text-sm text-primary/70 font-medium mb-1 lowercase">
              {currentPinyin}
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl tracking-tight text-foreground">
              {char}
            </span>
          </div>
        );
      })}
    </div>
  );
};
