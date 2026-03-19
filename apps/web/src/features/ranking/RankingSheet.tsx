import type { LeaderboardEntrySummary } from '@qq-classic-farm/protocol';

export function RankingSheet(props: { entries: readonly LeaderboardEntrySummary[] }) {
  return (
    <section className="content-panel" aria-label="排行">
      <div className="content-header">
        <strong>金币排行榜</strong>
        <span>查看本期金币积累情况</span>
      </div>
      <div className="list-panel">
        {props.entries.map((entry) => (
          <article key={`${entry.rank}-${entry.userId}`} className="list-card">
            <strong>第 {entry.rank} 名</strong>
            <span>{entry.nickname}</span>
            <em>{entry.value} 金币</em>
          </article>
        ))}
      </div>
    </section>
  );
}
