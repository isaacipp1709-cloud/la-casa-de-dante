import React from 'react';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessageProps {
  role: Role;
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div
      className={`flex w-full mb-4 ${
        isUser ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'
      }`}
      role="listitem"
      aria-label={`Mensaje de ${role}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : isSystem
            ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 text-center text-xs'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
