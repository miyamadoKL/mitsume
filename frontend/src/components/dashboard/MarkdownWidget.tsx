import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownWidgetProps {
  content: string
}

export const MarkdownWidget: React.FC<MarkdownWidgetProps> = ({ content }) => {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No content
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-2 prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
