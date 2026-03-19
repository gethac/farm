import type { FriendSummary } from '@qq-classic-farm/protocol';

export function FriendsDrawer(props: { friends: readonly FriendSummary[]; onVisitFriend(userId: string): void }) {
  return (
    <section className="content-panel" aria-label="好友">
      <div className="content-header">
        <strong>好友列表</strong>
        <span>查看可访问好友和最近往来</span>
      </div>
      <div className="list-panel">
        {props.friends.map((friend) => (
          <article key={friend.userId} className="list-card">
            <strong>{friend.nickname}</strong>
            <span>{friend.canVisit ? '可访问农场' : '暂不可访问'}</span>
            <em>{friend.lastVisitAt ? '最近来过' : '还未来访'}</em>
            {friend.canVisit ? (
              <button type="button" className="list-card__action" onClick={() => props.onVisitFriend(friend.userId)}>
                {`访问 ${friend.nickname}`}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
