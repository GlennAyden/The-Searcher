'use client';

import React from 'react';
import { DoneDetailPageHeader } from '@/features/done-detail/components/DoneDetailPageHeader';
import { DoneDetailSection } from '@/features/done-detail/components/DoneDetailSection';

export default function DoneDetailPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-gray-100 p-6">
            <DoneDetailPageHeader />

            {/* Main Content */}
            <DoneDetailSection ticker="" />
        </div>
    );
}
