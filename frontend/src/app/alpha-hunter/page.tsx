"use client";

import { AlphaHunterProvider, AlphaHunterContent } from "@/features/alpha-hunter";

// Wrapper with Provider
export default function AlphaHunterPage() {
    return (
        <AlphaHunterProvider>
            <AlphaHunterContent />
        </AlphaHunterProvider>
    );
}
