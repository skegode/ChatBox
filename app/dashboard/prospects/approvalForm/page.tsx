import React, { Suspense } from 'react';
import ApprovalFormClient from './ApprovalFormClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">Loading form...</div>}>
      <ApprovalFormClient />
    </Suspense>
  );
}