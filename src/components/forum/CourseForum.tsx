import React, { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { getAuthToken } from "../../util/auth"
import { ThreadList } from "./ThreadList"
import { ThreadDetail } from "./ThreadDetail"

interface CourseForumProps {
    courseId: string
}

export const CourseForum: React.FC<CourseForumProps> = ({ courseId }) => {
    const [searchParams, setSearchParams] = useSearchParams()
    const threadIdParam = searchParams.get("thread")
    const threadId = threadIdParam ? parseInt(threadIdParam, 10) : null
    
    // Auth context
    const { address } = useWallet()
    
    let isAdmin = false
    try {
        const token = getAuthToken()
        if (token) {
            const payloadStr = atob(token.split('.')[1])
            const payload = JSON.parse(payloadStr)
            isAdmin = payload.role === 'admin' || payload.isAdmin === true
        }
    } catch (e) {
        // ignore
    }

    const handleSelectThread = (id: number) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set("thread", String(id))
            return next
        }, { replace: false })
    }

    const handleBackToList = () => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete("thread")
            return next
        }, { replace: false })
    }

    return (
        <div className="bg-[#070910] text-[#f1f5f9] rounded-2xl border border-white/10 p-6">
            {!threadId ? (
                <ThreadList 
                    courseId={courseId} 
                    onSelectThread={handleSelectThread} 
                    currentAddress={address ?? null}
                    isAdmin={isAdmin}
                />
            ) : (
                <ThreadDetail 
                    courseId={courseId} 
                    threadId={threadId} 
                    onBack={handleBackToList}
                    currentAddress={address ?? null}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    )
}
