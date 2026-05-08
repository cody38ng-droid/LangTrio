import * as React from 'react';

interface ChineseRubyTextProps {
  text: string;
  pinyin: string;
}

export const ChineseRubyText = ({ text, pinyin }: ChineseRubyTextProps) => {
  const pinyinWords = pinyin.split(' ');
  const chars = text.split('');
  
  let pIdx = 0;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
      {chars.map((char, index) => {
        if (/[，。！？“”：；（）、]/.test(char)) {
          return (
            <span key={index} className="text-4xl self-end mb-1 opacity-40">
              {char}
            </span>
          );
        }
        
        const currentPinyin = pinyinWords[pIdx];
        pIdx++;
        
        return (
          <div key={index} className="flex flex-col items-center min-w-[1.2em]">
            <span className="text-sm text-primary/70 font-medium mb-1 lowercase">
              {currentPinyin}
            </span>
            <span className="text-4xl tracking-tight text-foreground">
              {char}
            </span>
          </div>
        );
      })}
    </div>
  );
};
