// src/pages/Candidates.jsx
import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { useClientContext } from '../lib/clientContext';

function ScoreBar({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span><span>{v}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded">
        <div className="h-2 rounded" style={{ width: `${v}%`, backgroundColor: '#000' }} />
      </div>
    </div>
  );
}

export default function Candidates() {
  const { client } = useClientContext();
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await Api.candidates(client.id);
        setRows(list || []);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [client.id]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Candidates</h1>
      {!!error && <div className="text-red-600 mb-3">{error}</div>}
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-6 text-sm font-medium bg-gray-50 px-3 py-2">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Resume</div>
          <div>Interview</div>
          <div>Overall</div>
        </div>
        {rows.map(r => {
          const summary = r.analysis_summary || {};
          return (
            <div key={r.id} className="border-t">
              <button
                className="w-full grid grid-cols-6 px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
              >
                <div>{r.name || '—'}</div>
                <div>{r.email || '—'}</div>
                <div>{r.role_title || '—'}</div>
                <div>{(r.resume_score ?? summary.resume_score ?? '—')}</div>
                <div>{(r.interview_score ?? summary.interview_score ?? '—')}</div>
                <div>{(r.overall_score ?? summary.overall_score ?? '—')}</div>
              </button>

              {openId === r.id && (
                <div className="bg-white px-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">Resume Analysis</h3>
                      <ScoreBar label="Resume Score" value={summary.resume_score ?? r.resume_score} />
                      <ScoreBar label="Skills Match" value={summary.skills_match_percent} />
                      <ScoreBar label="Education Match" value={summary.education_match_percent} />
                      <ScoreBar label="Experience Match" value={summary.experience_match_percent} />
                      <ScoreBar label="Overall Resume Match" value={summary.overall_resume_match_percent} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Interview Analysis</h3>
                      <ScoreBar label="Interview Score" value={summary.interview_score ?? r.interview_score} />
                      <ScoreBar label="Clarity" value={summary.clarity_percent} />
                      <ScoreBar label="Confidence" value={summary.confidence_percent} />
                      <ScoreBar label="Body Language" value={summary.body_language_percent} />
                      <div className="mt-3 text-sm whitespace-pre-wrap">
                        {summary.summary || 'No summary available.'}
                      </div>
                    </div>
                  </div>

                  {!!r.report_id && (
                    <div className="mt-4">
                      <button
                        className="bg-black text-white rounded px-4 py-2"
                        onClick={() => Api.downloadReport(r.report_id)}
                      >
                        Download PDF Report
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
