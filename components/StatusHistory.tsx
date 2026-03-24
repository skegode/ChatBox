import React from 'react';

export type StatusEntry = { status: string; note?: string; at: string };

export default function StatusHistory({ entries }: { entries: StatusEntry[] }) {
  return (
    <div>
      <h5>Status history</h5>
      {entries.length === 0 ? (
        <div className="text-muted">No history yet.</div>
      ) : (
        <ul className="list-group">
          {entries.map((e, i) => (
            <li key={i} className="list-group-item">
              <div><strong>{e.status}</strong> <small className="text-muted">{new Date(e.at).toLocaleString()}</small></div>
              {e.note && <div className="text-muted">{e.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
