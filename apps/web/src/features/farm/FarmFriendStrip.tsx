import type { FriendSummary } from '@qq-classic-farm/protocol';

export function FarmFriendStrip(props: {
  friends: readonly FriendSummary[];
  onSelectFriend(userId: string): void;
}) {
  return (
    <div className="farm-scene__friend-entry" aria-label="好友农场切换">
      {props.friends.map((friend) => (
        <button key={friend.userId} type="button" className="farm-scene__friend-chip" onClick={() => props.onSelectFriend(friend.userId)}>
          <strong>{friend.nickname}</strong>
          <span>{friend.canVisit ? '可访问' : '忙碌中'}</span>
        </button>
      ))}
    </div>
  );
}
