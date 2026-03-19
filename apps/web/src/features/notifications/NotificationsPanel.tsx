import type { NotificationSummary } from '@qq-classic-farm/protocol';

export function NotificationsPanel(props: { notices: readonly NotificationSummary[] }) {
  return (
    <section className="content-panel content-panel--notice" aria-label="通知">
      <div className="content-header">
        <strong>最新提醒</strong>
        <span>好友互动、成熟和任务提醒</span>
      </div>
      <div className="list-panel">
        {props.notices.map((notice) => (
          <article key={notice.noticeId} className="list-card">
            <strong>{notice.title}</strong>
            <span>{notice.notificationType}</span>
            <em>{notice.body}</em>
          </article>
        ))}
      </div>
    </section>
  );
}
