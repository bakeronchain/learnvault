export interface ForumThread {
    id: number
    course_id: string
    author_address: string
    title: string
    content: string
    created_at: string
    updated_at: string
    reply_count: number
}

export interface ForumReply {
    id: number
    thread_id: number
    author_address: string
    content: string
    created_at: string
    updated_at: string
}

export interface ForumThreadDetail extends ForumThread {
    replies: ForumReply[]
}
