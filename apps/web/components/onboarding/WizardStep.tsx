'use client';

import React from 'react';

interface WizardStepProps {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function WizardStep({ number, title, description, children }: WizardStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
            {number}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
        {description && <p className="text-gray-600 text-sm ml-11">{description}</p>}
      </div>
      <div className="ml-11">
        {children}
      </div>
    </div>
  );
}
