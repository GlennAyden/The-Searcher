import { RagChatInterface } from '@/features/rag-chat';

export default function RagChatPage() {
    return (
        <div className="flex flex-col gap-8 h-full">
            <h1 className="text-3xl font-bold">Intelligence Agent</h1>
            <div className="flex-1">
                <RagChatInterface />
            </div>
        </div>
    );
}
