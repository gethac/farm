import type { TaskSummary } from '@qq-classic-farm/protocol';

const taskLabels: Record<string, string> = {
  'new-player-plant-first-crop': '新手种下第一株作物',
  'daily-water': '今日浇水 5 次',
};

export function TasksSheet(props: { tasks: readonly TaskSummary[]; onClaim(taskId: string): void }) {
  return (
    <section className="content-panel" aria-label="任务">
      <div className="content-header">
        <strong>任务清单</strong>
        <span>新手任务、日常任务和奖励进度</span>
      </div>
      <div className="list-panel">
        {props.tasks.map((task) => {
          const label = taskLabels[task.taskId] ?? task.taskId;
          const canClaim = !task.isClaimed && task.progress >= task.target;
          return (
            <article key={task.taskId} className="list-card">
              <strong>{label}</strong>
              <span>{task.isClaimed ? '已领取' : canClaim ? '可领取' : '进行中'}</span>
              <em>{task.progress} / {task.target}</em>
              {canClaim ? (
                <button type="button" className="list-card__action" onClick={() => props.onClaim(task.taskId)}>
                  {`领取 ${label}`}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
